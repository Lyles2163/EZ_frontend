<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basicSetup } from 'codemirror'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import {
  acceptCompletion,
  autocompletion,
  type Completion,
  type CompletionResult,
  type CompletionSource,
} from '@codemirror/autocomplete'
import { indentUnit } from '@codemirror/language'
import { java } from '@codemirror/lang-java'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'
import { oneDark } from '@codemirror/theme-one-dark'
import type { Theme } from '../../composables/useTheme'

const props = withDefaults(defineProps<{
  modelValue: string
  /** 与后端 JudgeLanguage 的 code 一致：java / python3 / cpp */
  language: string
  theme?: Theme
  disabled?: boolean
}>(), {
  theme: 'light',
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null

const keyword = (label: string): Completion => ({ label, type: 'keyword' })

const JAVA: Completion[] = [
  ...['public', 'private', 'protected', 'static', 'final', 'class', 'interface',
    'extends', 'implements', 'new', 'return', 'if', 'else', 'for', 'while',
    'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw',
    'package', 'import', 'instanceof', 'this', 'super'].map(keyword),
  ...['int', 'long', 'double', 'float', 'char', 'boolean', 'byte', 'short', 'void'].map(
    label => ({ label, type: 'type' })),
  { label: 'String', type: 'class', detail: 'java.lang' },
  { label: 'StringBuilder', type: 'class', detail: 'java.lang' },
  { label: 'Scanner', type: 'class', detail: 'java.util' },
  { label: 'ArrayList', type: 'class', detail: 'java.util' },
  { label: 'HashMap', type: 'class', detail: 'java.util' },
  { label: 'Arrays', type: 'class', detail: 'java.util' },
  { label: 'Collections', type: 'class', detail: 'java.util' },
  { label: 'System.out.println', type: 'method', apply: 'System.out.println()', detail: '打印并换行' },
  { label: 'System.out.print', type: 'method', apply: 'System.out.print()', detail: '打印' },
  { label: 'nextInt', type: 'method', detail: 'Scanner 读整数' },
  { label: 'nextLong', type: 'method', detail: 'Scanner 读长整数' },
  { label: 'nextLine', type: 'method', detail: 'Scanner 读一行' },
  { label: 'hasNext', type: 'method', detail: 'Scanner 是否还有输入' },
  { label: 'Integer.parseInt', type: 'method', apply: 'Integer.parseInt()', detail: '字符串转整数' },
  { label: 'Math.max', type: 'method', apply: 'Math.max()', detail: '取较大值' },
  { label: 'Math.min', type: 'method', apply: 'Math.min()', detail: '取较小值' },
  { label: 'Arrays.sort', type: 'method', apply: 'Arrays.sort()', detail: '数组排序' },
  { label: 'main', type: 'method', apply: 'main', detail: '程序入口' },
]

const PYTHON: Completion[] = [
  ...['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not',
    'and', 'or', 'is', 'import', 'from', 'as', 'try', 'except', 'finally', 'with',
    'lambda', 'yield', 'pass', 'break', 'continue', 'global', 'nonlocal',
    'True', 'False', 'None'].map(keyword),
  ...['print', 'input', 'len', 'range', 'enumerate', 'zip', 'sorted', 'reversed',
    'sum', 'min', 'max', 'abs', 'map', 'filter', 'int', 'float', 'str', 'list',
    'dict', 'set', 'tuple', 'any', 'all'].map(label => ({ label, type: 'function' })),
  { label: 'sys.stdin.read', type: 'method', apply: 'sys.stdin.read()', detail: '读全部输入' },
  { label: 'sys.stdin.readline', type: 'method', apply: 'sys.stdin.readline()', detail: '读一行' },
  { label: 'sys.stdout.write', type: 'method', apply: 'sys.stdout.write()', detail: '不换行输出' },
  { label: 'split', type: 'method', detail: '字符串分割' },
  { label: 'strip', type: 'method', detail: '去首尾空白' },
  { label: 'join', type: 'method', detail: '拼接' },
  { label: 'append', type: 'method', detail: '列表追加' },
]

const CPP: Completion[] = [
  ...['include', 'define', 'using', 'namespace', 'class', 'struct', 'public',
    'private', 'protected', 'const', 'constexpr', 'static', 'return', 'if', 'else',
    'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'auto',
    'template', 'typename', 'nullptr', 'true', 'false'].map(keyword),
  ...['int', 'long', 'long long', 'double', 'float', 'char', 'bool', 'void',
    'unsigned', 'size_t'].map(label => ({ label, type: 'type' })),
  { label: 'std::string', type: 'class', detail: '#include <string>' },
  { label: 'std::vector', type: 'class', detail: '#include <vector>' },
  { label: 'std::map', type: 'class', detail: '#include <map>' },
  { label: 'std::set', type: 'class', detail: '#include <set>' },
  { label: 'std::cout', type: 'variable', apply: 'std::cout << ', detail: '标准输出' },
  { label: 'std::cin', type: 'variable', apply: 'std::cin >> ', detail: '标准输入' },
  { label: 'std::endl', type: 'variable', detail: '换行并刷新' },
  { label: 'std::sort', type: 'function', apply: 'std::sort()', detail: '排序' },
  { label: 'std::max', type: 'function', apply: 'std::max()', detail: '取较大值' },
  { label: 'std::min', type: 'function', apply: 'std::min()', detail: '取较小值' },
  { label: '#include <iostream>', type: 'keyword', detail: '输入输出' },
  { label: '#include <vector>', type: 'keyword', detail: '动态数组' },
  { label: '#include <algorithm>', type: 'keyword', detail: 'sort / max / min' },
]

const SYNTAX: Record<string, () => Extension> = { java, python3: python, cpp }
const COMPLETIONS: Record<string, Completion[]> = { java: JAVA, python3: PYTHON, cpp: CPP }

/* 三个可热切换的配置：语言+补全、可编辑性、明暗主题。
   用 Compartment 而不是重建 EditorView，切换时不会丢掉光标位置与撤销历史。 */
const languageBox = new Compartment()
const editableBox = new Compartment()
const themeBox = new Compartment()

function completionSourceFor(language: string): CompletionSource {
  const options = COMPLETIONS[language] ?? JAVA
  return (context): CompletionResult | null => {
    const word = context.matchBefore(/[\w:.#]+/)
    if (!word || (word.from === word.to && !context.explicit)) return null
    return { from: word.from, options, validFor: /^[\w:.#]*$/ }
  }
}

function languageExtension(language: string): Extension {
  const syntax = SYNTAX[language] ?? java
  return [
    syntax(),
    autocompletion({
      override: [completionSourceFor(language)],
      activateOnTyping: true,
      icons: true,
    }),
  ]
}

function themeExtension(theme: Theme): Extension {
  return theme === 'dark' ? oneDark : []
}

function extensions(): Extension[] {
  return [
    // 必须排在 basicSetup 前面：CodeMirror 按键位顺序取第一个返回 true 的绑定。
    // 补全面板打开时 Tab 接受补全（acceptCompletion 返回 true），
    // 没打开时它返回 false，落到 indentWithTab 插入缩进 —— 一个键两种行为。
    keymap.of([{ key: 'Tab', run: acceptCompletion }, indentWithTab]),
    basicSetup,
    indentUnit.of('    '),
    languageBox.of(languageExtension(props.language)),
    editableBox.of(EditorView.editable.of(!props.disabled)),
    themeBox.of(themeExtension(props.theme)),
    EditorView.updateListener.of(update => {
      if (!update.docChanged) return
      emit('update:modelValue', update.state.doc.toString())
    }),
    EditorView.theme({
      '&': { height: '100%' },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '13px',
        lineHeight: '1.7',
      },
    }),
  ]
}

function createEditor(): void {
  if (!host.value) return
  view?.destroy()
  view = new EditorView({
    state: EditorState.create({ doc: props.modelValue, extensions: extensions() }),
    parent: host.value,
  })
}

/**
 * 外部改值（换语言贴模板 / 换题）时整篇替换。
 * 判"是不是自己发出去的回声"只靠内容相等，不用"刚改过"这类标志位：
 * 标志位一旦与 Vue 的异步 watcher 时序错开，就会把一次真实的换模板吞掉，
 * 表现出来正是"切了语言但代码没变"。
 */
watch(() => props.modelValue, next => {
  if (!view) return
  if (next === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } })
})

watch(() => props.disabled, next => {
  view?.dispatch({ effects: editableBox.reconfigure(EditorView.editable.of(!next)) })
})

watch(() => props.theme, next => {
  view?.dispatch({ effects: themeBox.reconfigure(themeExtension(next)) })
})

watch(() => props.language, next => {
  view?.dispatch({ effects: languageBox.reconfigure(languageExtension(next)) })
})

onMounted(createEditor)
onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div
      ref="host"
      class="code-editor"
      :class="{ 'code-editor--disabled': disabled }"
  />
</template>

<style scoped>
.code-editor {
  flex: 1; min-height: 320px; overflow: hidden;
  border: 1px solid var(--glass-border); border-radius: 10px;
  background: var(--bg-base);
}
.code-editor--disabled { opacity: 0.65; pointer-events: none; }
.code-editor :deep(.cm-editor) { height: 100%; min-height: 320px; }
.code-editor :deep(.cm-scroller) { max-height: 52vh; }
.code-editor :deep(.cm-tooltip-autocomplete) { border-radius: 8px; overflow: hidden; }

@media (max-width: 1023px) {
  .code-editor, .code-editor :deep(.cm-editor) { min-height: 240px; }
}
</style>
