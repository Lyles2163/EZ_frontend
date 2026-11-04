import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/** 桌宠独立模式的默认监听端口。 */
export const PET_DEFAULT_PORT = 3080

/**
 * 独立模式进程自己写的运行清单（端口 + 每次启动都换的新令牌）。
 * 位置按用户主目录定位，与桌宠代码放在哪无关，所以换目录不用迁状态。
 */
const MANIFEST = join(homedir(), '.dsh', 'dsh-pet', 'standalone-runtime.json')

export type PetRuntime = { port: number; token: string; pid: number }

/** 读运行清单。文件缺失、JSON 损坏或字段类型不对都按「没读到」返回 null，不抛。 */
export function readPetRuntime(file: string = MANIFEST): PetRuntime | null {
  let raw: string
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    return null
  }
  try {
    const data = JSON.parse(raw) as Partial<PetRuntime>
    if (
      typeof data.port === 'number' &&
      typeof data.token === 'string' &&
      typeof data.pid === 'number'
    ) {
      return { port: data.port, token: data.token, pid: data.pid }
    }
  } catch {
    /* 半截写入或损坏，按没读到处理 */
  }
  return null
}

/**
 * 进程是否还活着。process.kill(pid, 0) 不发信号只做存在性检查，Windows 上同样有效。
 * 桌宠被强杀时不会清运行清单，所以清单里的 pid 可能是陈旧的，必须这样验一次。
 */
export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * 代理该绑到哪个端口：有活着的实例就用它实际的端口，否则用默认端口
 * （插件也会按这个默认端口去起子进程，两边不会算出不同的值）。
 */
export function resolvePetPort(file: string = MANIFEST): number {
  const runtime = readPetRuntime(file)
  return runtime && isPidAlive(runtime.pid) ? runtime.port : PET_DEFAULT_PORT
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * dev server 启动时把桌宠服务带起来，退出时收掉自己拉起的那个实例。
 *
 * 令牌每次桌宠启动都会换，所以代理不能把它读死——这里只负责进程，
 * 令牌由代理在每个请求上现读（见 vite.config.ts）。
 */
export function petServer(options: { dir?: string } = {}): Plugin {
  return {
    name: 'pet-server',
    apply: 'serve',
    configureServer(server) {
      const dir = options.dir ?? join(server.config.root, 'pet-server')
      const log = server.config.logger
      const entry = join(dir, 'lib', 'standalone.js')

      if (!existsSync(entry)) {
        log.warn(`[pet] 未找到 ${entry}，桌宠覆盖层不可用`)
        return
      }
      // 独立模式是打包产物，但 openai/zod 仍是外部依赖，没有 node_modules 起不来。
      if (!existsSync(join(dir, 'node_modules', 'openai'))) {
        log.warn('[pet] pet-server/node_modules 缺失，先执行：npm install --prefix pet-server')
        return
      }

      const existing = readPetRuntime()
      if (existing && isPidAlive(existing.pid)) {
        log.info(`[pet] 复用已在跑的桌宠服务 pid=${existing.pid} port=${existing.port}`)
        return
      }

      let child: ChildProcess | undefined
      try {
        child = spawn(process.execPath, [entry, '--port', String(PET_DEFAULT_PORT)], {
          cwd: dir,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch (e) {
        log.error(`[pet] 启动失败：${e instanceof Error ? e.message : String(e)}`)
        return
      }

      const pipe = (stream: NodeJS.ReadableStream | null, level: 'info' | 'warn') => {
        if (!stream) return
        let rest = ''
        stream.setEncoding('utf8')
        stream.on('data', (chunk: string) => {
          const lines = (rest + chunk).split(/\r?\n/)
          rest = lines.pop() ?? ''
          for (const line of lines) if (line.trim()) log[level](`[pet] ${line}`)
        })
      }
      pipe(child.stdout, 'info')
      pipe(child.stderr, 'warn')
      child.on('error', (e) => log.error(`[pet] 子进程错误：${e.message}`))

      const spawnedPid = child.pid
      void (async () => {
        for (let i = 0; i < 150; i += 1) {
          const runtime = readPetRuntime()
          if (runtime && runtime.pid === spawnedPid) {
            if (runtime.port === PET_DEFAULT_PORT) {
              log.info(`[pet] 已启动 pid=${runtime.pid} port=${runtime.port}`)
            } else {
              // 默认端口被别的进程占着，桌宠会顺延，而代理的目标端口是启动时定死的。
              log.warn(
                `[pet] 端口 ${PET_DEFAULT_PORT} 被占用，实际落在 ${runtime.port}；` +
                  '释放该端口后重启 dev server，代理才能对上。',
              )
            }
            return
          }
          if (child && child.exitCode !== null) break
          await wait(100)
        }
        log.error('[pet] 启动超时或已退出，桌宠覆盖层将连不上（见上方 [pet] 日志）')
      })()

      let closing = false
      const shutdown = () => {
        if (closing || !child || child.exitCode !== null) return
        closing = true
        try {
          child.kill()
        } catch {
          /* 已经没了 */
        }
        // Windows 上 kill 是硬终止，桌宠来不及自清运行清单，会留下指着自己 pid 的僵尸记录。
        const runtime = readPetRuntime()
        if (runtime && runtime.pid === spawnedPid) {
          try {
            unlinkSync(MANIFEST)
          } catch {
            /* 已被清或无权限 */
          }
        }
      }
      server.httpServer?.once('close', shutdown)
      process.once('exit', shutdown)
    },
  }
}
