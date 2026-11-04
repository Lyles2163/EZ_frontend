import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { isPidAlive, petServer, readPetRuntime, resolvePetPort, PET_DEFAULT_PORT } from '../petServer.ts'

/** 造一个临时运行清单，返回它的路径。 */
function manifestWith(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pet-runtime-'))
  const file = join(dir, 'standalone-runtime.json')
  writeFileSync(file, content, 'utf8')
  return file
}

test('readPetRuntime 解析出端口、令牌和 pid', () => {
  const file = manifestWith(JSON.stringify({ port: 3081, token: 'tk-1', pid: 4242 }))
  assert.deepEqual(readPetRuntime(file), { port: 3081, token: 'tk-1', pid: 4242 })
})

test('readPetRuntime 对缺失、损坏、字段类型不符一律返回 null 而不抛', () => {
  assert.equal(readPetRuntime(join(tmpdir(), 'no-such-pet-runtime.json')), null)
  assert.equal(readPetRuntime(manifestWith('{ 半截')), null)
  assert.equal(readPetRuntime(manifestWith('{"port":"3080","token":"t","pid":1}')), null)
  assert.equal(readPetRuntime(manifestWith('{"port":3080,"token":"t"}')), null)
})

test('isPidAlive 认自己的 pid，拒掉不存在和非法的', () => {
  assert.equal(isPidAlive(process.pid), true)
  assert.equal(isPidAlive(0), false)
  assert.equal(isPidAlive(-1), false)
  assert.equal(isPidAlive(1.5), false)
  assert.equal(isPidAlive(2_147_483_646), false)
})

test('resolvePetPort 只认活着的那个实例的端口', () => {
  const dead = manifestWith(JSON.stringify({ port: 3099, token: 't', pid: 2_147_483_646 }))
  assert.equal(resolvePetPort(dead), PET_DEFAULT_PORT)
  const alive = manifestWith(JSON.stringify({ port: 3099, token: 't', pid: process.pid }))
  assert.equal(resolvePetPort(alive), 3099)
})

/** 只用来观察插件的护栏：不真起进程，所以 httpServer 留空。 */
function fakeServer(root: string) {
  const lines: string[] = []
  return {
    lines,
    config: {
      root,
      logger: {
        info: (m: string) => lines.push(`info ${m}`),
        warn: (m: string) => lines.push(`warn ${m}`),
        error: (m: string) => lines.push(`error ${m}`),
      },
    },
    httpServer: undefined,
  }
}

/** configureServer 是 ObjectHook，取函数形态来调。 */
function runConfigureServer(root: string) {
  const server = fakeServer(root)
  const hook = petServer().configureServer
  const fn = typeof hook === 'function' ? hook : hook.handler
  fn(server as never)
  return server.lines.join('\n')
}

test('pet-server 目录不存在时只告警，不去 spawn', () => {
  const root = mkdtempSync(join(tmpdir(), 'pet-root-'))
  assert.match(runConfigureServer(root), /未找到 .*standalone\.js/)
  rmSync(root, { recursive: true, force: true })
})

test('缺 node_modules 时提示 npm install --prefix，不去 spawn', () => {
  const root = mkdtempSync(join(tmpdir(), 'pet-root-'))
  mkdirSync(join(root, 'pet-server', 'lib'), { recursive: true })
  writeFileSync(join(root, 'pet-server', 'lib', 'standalone.js'), '', 'utf8')
  assert.match(runConfigureServer(root), /npm install --prefix pet-server/)
  rmSync(root, { recursive: true, force: true })
})
