# Vue 前端设计文档：白绿玻璃双主题响应式方案

## 一、设计概览

### 1.1 项目定位

本文档定义一套基于 Vue 3 + vue-bits 组件库的前端视觉与交互规范。核心设计语言为**玻璃拟态（Glassmorphism）** ，通过半透明毛玻璃质感营造轻盈、现代的界面层次。系统提供两套主题：亮色主题以白色、绿色为基调，暗色主题以黑色、浅绿色为基调，所有页面均支持主题切换，并适配电脑、平板、手机三端。

### 1.2 设计原则

- **玻璃为核心质感**：所有容器类组件（卡片、面板、导航栏、弹窗）统一使用毛玻璃效果，形成一致的视觉识别。
- **绿色为强调色**：亮色主题用深绿作为主色，暗色主题用浅绿作为主色，保证在各自背景上的对比度与辨识度。
- **性能分级**：不是所有玻璃元素都使用同等强度的效果，根据组件重要性和面积分配性能档位。
- **响应式优先**：所有布局采用移动优先策略，断点设计覆盖主流设备。


## 二、设计令牌（Design Tokens）

所有视觉变量以 CSS 自定义属性（CSS Variables）的形式定义在 `:root` 和 `[data-theme="dark"]` 下，组件中仅引用变量，不硬编码颜色值。这是主题切换的基础机制。

### 2.1 亮色主题令牌

```css
:root {
  /* ---- 背景层 ---- */
  --bg-base: #f5f7f5;           /* 页面底色，带极轻微绿调的灰白 */
  --bg-elevated: #ffffff;        /* 浮起层底色 */

  /* ---- 玻璃层 ---- */
  --glass-bg: rgba(255, 255, 255, 0.55);
  --glass-bg-hover: rgba(255, 255, 255, 0.70);
  --glass-border: rgba(255, 255, 255, 0.60);
  --glass-border-strong: rgba(255, 255, 255, 0.85);
  --glass-shadow: rgba(0, 60, 20, 0.08);
  --glass-blur: 16px;
  --glass-saturate: 180%;

  /* ---- 主色（绿色系）---- */
  --primary-50: #f0faf4;
  --primary-100: #dcf5e6;
  --primary-300: #7ed9a6;
  --primary-500: #2ecc71;        /* 主绿 */
  --primary-600: #27ae60;        /* 悬停绿 */
  --primary-700: #1e8449;        /* 按下绿 */
  --primary-contrast: #ffffff;   /* 主色上的文字色 */

  /* ---- 文字 ---- */
  --text-primary: #1a2e1e;       /* 近黑，带绿调 */
  --text-secondary: #4a6b52;
  --text-muted: #8aa892;
  --text-on-glass: #1a2e1e;

  /* ---- 语义色 ---- */
  --success: #27ae60;
  --warning: #f39c12;
  --error: #e74c3c;
  --info: #3498db;
}
```

### 2.2 暗色主题令牌

```css
[data-theme="dark"] {
  /* ---- 背景层 ---- */
  --bg-base: #0a0f0c;           /* 深黑，带极微绿调 */
  --bg-elevated: #131a15;

  /* ---- 玻璃层 ---- */
  --glass-bg: rgba(20, 40, 25, 0.50);
  --glass-bg-hover: rgba(25, 50, 30, 0.65);
  --glass-border: rgba(100, 200, 140, 0.20);
  --glass-border-strong: rgba(100, 200, 140, 0.35);
  --glass-shadow: rgba(0, 0, 0, 0.40);
  --glass-blur: 18px;
  --glass-saturate: 200%;

  /* ---- 主色（浅绿色系）---- */
  --primary-50: #0d1f14;
  --primary-100: #1a3d27;
  --primary-300: #4a9e6d;
  --primary-500: #6ee7a0;        /* 主浅绿 */
  --primary-600: #5dd18e;        /* 悬停 */
  --primary-700: #4cbb7c;        /* 按下 */
  --primary-contrast: #0a0f0c;   /* 浅绿上的文字用深色 */

  /* ---- 文字 ---- */
  --text-primary: #e6f5ea;
  --text-secondary: #a3c9af;
  --text-muted: #6b8f76;
  --text-on-glass: #e6f5ea;

  /* ---- 语义色 ---- */
  --success: #6ee7a0;
  --warning: #fbbf24;
  --error: #f87171;
  --info: #60a5fa;
}
```

### 2.3 令牌使用规范

| 场景 | 使用的令牌 | 说明 |
|---|---|---|
| 玻璃容器背景 | `--glass-bg` | 卡片、面板、导航栏 |
| 玻璃悬停态 | `--glass-bg-hover` | 可交互玻璃元素 |
| 玻璃边框 | `--glass-border` | 常规边框 |
| 玻璃高亮边框 | `--glass-border-strong` | 聚焦、激活状态 |
| 主按钮背景 | `--primary-500` | CTA 按钮 |
| 主按钮文字 | `--primary-contrast` | 亮色主题白字，暗色主题黑字 |
| 正文 | `--text-primary` | — |
| 辅助说明 | `--text-secondary` | — |
| 禁用/占位 | `--text-muted` | — |


## 三、主题切换架构

### 3.1 切换机制

主题状态通过 Vue 组合式函数 `useTheme` 管理，核心逻辑如下：

```typescript
// composables/useTheme.ts
import { ref, watch, onMounted } from 'vue'

type Theme = 'light' | 'dark'

const theme = ref<Theme>('light')

export function useTheme() {
  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  const setTheme = (t: Theme) => {
    theme.value = t
  }

  // 同步到 HTML 属性，CSS 变量自动生效
  watch(theme, (val) => {
    document.documentElement.setAttribute('data-theme', val)
    localStorage.setItem('app-theme', val)
  }, { immediate: true })

  // 首次加载读取本地偏好，否则跟随系统
  onMounted(() => {
    const saved = localStorage.getItem('app-theme') as Theme | null
    if (saved) {
      theme.value = saved
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme.value = 'dark'
    }
  })

  return { theme, toggleTheme, setTheme }
}
```

### 3.2 切换原理

主题切换的本质是**切换 `data-theme` 属性**，CSS 变量随之变化，所有引用变量的组件自动更新样式。vue-bits 的玻璃组件本身也通过 CSS 变量或 `prefers-color-scheme` 来适配暗色模式，但我们采用**属性驱动**而非媒体查询驱动，以便手动切换。

### 3.3 主题切换按钮设计

切换按钮本身也应为玻璃材质，放置在全局导航栏右侧。亮色主题下显示🌙图标，暗色主题下显示☀️图标。切换时添加 `transition: background 0.3s, color 0.3s` 过渡，避免视觉跳变。


## 四、玻璃拟态实现规范

### 4.1 基础玻璃样式

所有玻璃容器类组件共享以下基础样式：

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 32px var(--glass-shadow);
  border-radius: 16px;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.glass:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-strong);
}

/* 浏览器不支持 backdrop-filter 时的降级 */
@supports not (backdrop-filter: blur(1px)) {
  .glass {
    background: var(--bg-elevated);
    opacity: 0.95;
  }
}
```

### 4.2 性能分级策略

参考 vue-bits 液态玻璃组件的性能优化实践，玻璃效果不应“一刀切”。根据组件在页面中的角色和面积，定义三个性能档位：

| 档位 | 适用场景 | 实现方式 | 性能成本 |
|---|---|---|---|
| **high** | 全局导航栏、核心 CTA、大面积面板 | SVG Filter 位移 + 模糊（vue-bits Liquid Glass） | 高 |
| **standard** | 卡片、弹窗、侧边栏 | `backdrop-filter: blur(16px) saturate(180%)` | 中 |
| **lite** | 小按钮、图标按钮、列表项、大量重复元素 | `backdrop-filter: blur(8px)`，不加 saturate | 低 |

**推荐分配方案**：Project Card、导航栏等高视觉权重区域使用 high 档；按钮和 IconButton 使用 standard 或 lite 档；列表中的大量重复项统一使用 lite 档。

### 4.3 液态玻璃组件接入（vue-bits）

vue-bits 提供 `LiquidGlass` / `FluidGlass` 组件，可通过 jsrepo CLI 安装：

```bash
npx jsrepo@latest add https://vue-bits.dev/r/FluidGlass
```

引入方式：

```vue
<template>
  <FluidGlass quality="high">
    <!-- 内容 -->
  </FluidGlass>
</template>

<script setup>
import { FluidGlass } from 'vue3-bits'
</script>
```

使用建议：
- **导航栏**：`quality="high"`，仅一个实例，性能可控。
- **卡片列表**：不使用 LiquidGlass，改用 `.glass` 标准 CSS 类。
- 组件离开视口后 vue-bits 会自动降级为 lite 档，恢复时重新提升，无需手动干预。

### 4.4 色彩与玻璃的配合

玻璃效果需要**有内容的背景**才能显现层次感。纯色平面上玻璃几乎不可见。因此：

- 页面背景层使用**微妙的绿色径向渐变**，而非纯白/纯黑：

```css
/* 亮色主题背景 */
body {
  background: radial-gradient(ellipse at 20% 0%, #e8f5ec 0%, transparent 50%),
              radial-gradient(ellipse at 80% 100%, #d4f0de 0%, transparent 50%),
              var(--bg-base);
}

/* 暗色主题背景 */
[data-theme="dark"] body {
  background: radial-gradient(ellipse at 20% 0%, #0f2318 0%, transparent 50%),
              radial-gradient(ellipse at 80% 100%, #0a1a10 0%, transparent 50%),
              var(--bg-base);
}
```

- 绿色主色在亮色主题中用作按钮和链接，在暗色主题中**同时用作玻璃边框的色相参考**（`rgba(100, 200, 140, 0.2)`），使暗色玻璃带有绿色微光。


## 五、响应式布局规范

### 5.1 断点定义

| 设备 | 断点 | 容器最大宽度 | 栅格列数 |
|---|---|---|---|
| 手机（小） | < 480px | 100% | 1 列 |
| 手机（大）/ 小平板 | 480px – 767px | 100% | 2 列 |
| 平板 | 768px – 1023px | 720px | 8 列 |
| 电脑（小） | 1024px – 1279px | 960px | 12 列 |
| 电脑（大） | ≥ 1280px | 1200px | 12 列 |

### 5.2 布局策略

**移动优先**：CSS 默认按手机布局写，通过 `min-width` 媒体查询向上适配。

```css
/* 默认：手机 */
.container {
  padding: 0 16px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* 平板 */
@media (min-width: 768px) {
  .container {
    padding: 0 24px;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

/* 电脑 */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
}
```

### 5.3 vue-bits 组件的响应式适配

vue-bits 自身已对移动端做了一定适配，例如侧边栏在移动端重建为全宽玻璃抽屉，修复了标签在移动端的溢出问题。但业务层仍需注意：

- **LiquidGlass / FluidGlass 组件**：在手机端降低 `quality` 到 `"medium"` 或 `"lite"`，因为移动端 GPU 性能有限，且屏幕像素密度高，backdrop-filter 的开销更大。
- **动画组件**：使用 `motion-v` 的响应式 API，根据视口宽度调整动画参数。例如 Carousel 在手机端减少同时可见的项数。
- **触摸交互**：vue-bits 组件默认支持触摸拖拽（如 Carousel 的 `drag="x"`），在手机端确保 `touch-action` 不被父容器阻止。

### 5.4 三端布局差异表

| 区域 | 电脑 | 平板 | 手机 |
|---|---|---|---|
| 导航栏 | 水平完整导航 + 主题切换按钮 | 水平导航精简版 + 汉堡菜单 | 仅汉堡菜单 + 主题切换按钮 |
| 玻璃卡片 | 3 列网格 | 2 列网格 | 1 列全宽 |
| 侧边栏 | 固定左侧，玻璃面板 | 抽屉式，玻璃滑出 | 全宽玻璃抽屉 |
| 弹窗 | 居中，最大宽 560px | 居中，最大宽 480px | 底部滑出，全宽 |
| 字体 | 16px 基准 | 15px 基准 | 14px 基准 |
| 玻璃模糊 | 16px | 14px | 10px（节省 GPU） |


## 六、组件级规范

### 6.1 导航栏

- **材质**：high 档 LiquidGlass 或 standard `.glass`（顶部固定，`position: sticky`）。
- **亮色**：玻璃底色 `rgba(255,255,255,0.6)`，底部 1px 边框 `--glass-border`。
- **暗色**：玻璃底色 `rgba(20,40,25,0.55)`，边框带绿色微光。
- **手机**：高度从 64px 降至 56px，Logo 缩小，导航项收进汉堡菜单。

### 6.2 卡片

- **材质**：standard `.glass`。
- **内边距**：电脑 24px，平板 20px，手机 16px。
- **悬停**：背景提升至 `--glass-bg-hover`，`transform: translateY(-2px)`，阴影增强。

### 6.3 按钮

| 类型 | 材质 | 亮色主色 | 暗色主色 |
|---|---|---|---|
| 主按钮（CTA） | 实色，非玻璃 | `--primary-500` 底 + 白字 | `--primary-500` 浅绿底 + 黑字 |
| 次按钮 | lite 玻璃 | `--glass-bg` + 绿字 | `--glass-bg` + 浅绿字 |
| 图标按钮 | lite 玻璃 | 圆形，36px | 圆形，36px |

### 6.4 输入框

- 亮色：玻璃底 `rgba(255,255,255,0.5)`，聚焦时边框变为 `--primary-500`。
- 暗色：玻璃底 `rgba(20,40,25,0.4)`，聚焦时边框变为 `--primary-500`（浅绿）。
- 统一 `border-radius: 12px`。


## 七、性能与降级

### 7.1 backdrop-filter 性能注意事项

`backdrop-filter` 会触发合成层的额外渲染。以下措施控制性能开销：

- **避免在滚动容器内大量使用 standard 档玻璃**：滚动时每帧都要重新计算模糊。列表项使用 lite 档。
- **不永久添加 `will-change: backdrop-filter`** ：vue-bits 液态玻璃组件的优化策略中明确指出了这一点，只在需要时通过 class 切换。
- **固定尺寸的玻璃元素不创建 ResizeObserver**。
- **移动端自动降级**：通过 CSS 媒体查询在 `max-width: 767px` 下降低 `--glass-blur` 值，减少 GPU 负担。

### 7.2 三层降级策略

```css
/* 第一层：完整玻璃 */
.glass {
  backdrop-filter: blur(16px) saturate(180%);
}

/* 第二层：不支持 backdrop-filter */
@supports not (backdrop-filter: blur(1px)) {
  .glass {
    background: var(--bg-elevated);
  }
}

/* 第三层：用户偏好减少动态效果 */
@media (prefers-reduced-motion: reduce) {
  .glass {
    transition: none;
  }
}
```

### 7.3 主题切换的性能

主题切换通过 CSS 变量实现，切换时**不会触发组件重渲染**，仅浏览器重新计算样式。注意在根元素上添加 `transition: background-color 0.3s ease, color 0.3s ease`，使切换过程平滑，但**不对 backdrop-filter 做过渡**（会引发大量重绘）。


## 八、文件与代码组织

```
src/
├── composables/
│   └── useTheme.ts            # 主题状态管理
├── styles/
│   ├── tokens.css              # CSS 变量（亮色 + 暗色）
│   ├── glass.css               # 玻璃基础样式 + 性能档位
│   └── responsive.css          # 断点媒体查询
├── components/
│   ├── GlassCard.vue           # 玻璃卡片封装
│   ├── GlassButton.vue         # 玻璃按钮
│   ├── ThemeToggle.vue         # 主题切换按钮
│   └── glass/                  # vue-bits 玻璃组件
│       └── FluidGlass.vue
└── App.vue
```


## 九、验收清单

- [ ] 亮色主题下所有玻璃组件底色为白色半透明，边框可见
- [ ] 暗色主题下所有玻璃组件底色为深绿黑半透明，边框带绿色微光
- [ ] 主题切换按钮在所有页面可见且可操作，切换无闪烁
- [ ] 主题偏好持久化到 localStorage，刷新后保持
- [ ] 手机（375px 宽）下无横向滚动，导航折叠为汉堡菜单
- [ ] 平板（768px 宽）下卡片为 2 列布局，侧边栏为抽屉式
- [ ] 电脑（1280px+）下容器居中，最大宽 1200px
- [ ] 列表项使用 lite 档玻璃，滚动流畅无卡顿
- [ ] 不支持 backdrop-filter 的浏览器降级为实色背景