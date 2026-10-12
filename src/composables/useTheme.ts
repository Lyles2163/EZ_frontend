// src/composables/useTheme.ts
import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export type Theme = 'light' | 'dark'

/**
 * 读取全局主题（由 App.vue 挂在 <html data-theme> 上），
 * 并通过 MutationObserver 保持同步。只读，不改。
 */
export function useTheme(): Ref<Theme> {
    const theme = ref<Theme>('light')

    const sync = () => {
        const val = document.documentElement.getAttribute('data-theme')
        if (val === 'light' || val === 'dark') theme.value = val
    }

    let observer: MutationObserver | null = null

    onMounted(() => {
        sync()
        observer = new MutationObserver(sync)
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        })
    })

    onUnmounted(() => {
        observer?.disconnect()
        observer = null
    })

    return theme
}