# dsh-client-ui-theme-cyberpunk

[English](README.md) | 中文

Profile Bundle 提供 **Curupira Forest** 浏览器主题：以深松林色表面和取自 CurupiraCode 标志的同系叶绿色为主，低调的琥珀色仅用于民俗细节与提醒状态。界面使用 Chakra Petch，展示级标题使用 Orbitron，代码使用 Share Tech Mono。该 bundle 向 @deepseek-ai/dsh-client-ui-theme 的运行时挂载一层令牌覆盖（override layer），并在其被组合期间保持生效；因此 bundle 的启用/停用就是总开关，移除后即可无残留地恢复原生的主题、字体与滚动条样式。

## 主题的表达方式

所有视觉内容都经由两条既有通道。调色板与字体栈 riding 在一层令牌覆盖上：ui-layout 的 presenter 将 `overrideTokens` 层折叠进组合后的活动快照，并把结果作为 body 上的内联 CSS 变量投影，因此移除该层即移除这些值——字体和颜色一样只是令牌，而非样式表补丁。只有无法成为变量的内容才放入 bundle 的细节样式表：Web 字体的 `@import`（来自 Google Fonts，离线时静默回退到原生后备字体栈）与伪元素装饰（`::selection`、渐变滚动条）。

标题类复合令牌按原度量重新声明（`700 24px/34px`……），仅替换字族，行网格与字号与原生主题逐像素一致。

## 激活模型

覆盖层位于任何已解析偏好之上——无论是存储的、启动中途从设置采纳的，还是在外观行中切换的——因为覆盖层的组合顺序发生在活动主题之后，与插件激活和设置交付的先后无关。bundle 处于组合状态时渲染即为 Curupira Forest；解除组合后控制权完全交还存储偏好，而该偏好本身从未被写入。

## Model Experience

无；本包不注册任何提示词、工具、消息或提供方请求。

#### KV Cache effect

无；本包从不组装模型输入。

## Known Limitations and Deferred Work

- **组合期间该层遮蔽所有主题** —— 外观行仍可切换底层偏好，但渲染效果在 bundle 移除前始终为 Curupira Forest；没有可切换的亮色对应版本。
- **Web 字体依赖网络** —— 字体从 Google Fonts 加载；离线时字体栈回退到系统字体，森林调色板仍然生效。
- **任意方案下的暗色取值** —— 该层对两种模式重复其暗色调校值，因此组合期间即使用户偏好为 light，也会渲染深林色表面。
