# Agent Note：CurupiraCode 浏览器扩展预览执行器

状态：已实现

[English](2026-08-31-curupiracode-browser-extension.md) | 中文

## 问题

CurupiraCode 需要一款开放的浏览器扩展，把用户指令转换为当前页面上的操作，同时不能让页面内容取得对 agent（智能体）的指挥权，也不能静默暴露宿主计算机。第一版必须能在全新安装中使用，复用本地 harness 已配置的模型，不内嵌 API key，并让每一次页面修改都可先审阅。

普通 Web API 按设计拒绝扩展来源。若使用 `Access-Control-Allow-Origin: *` 或 `<all_urls>` 将其全面开放，会削弱现有的 DNS rebinding 与跨站请求边界。挂载普通 agent preset 还会向一个本只需把有界页面快照转换成 JSON 的任务暴露 Bash、文件系统、Curupira Memória 和无关工具。

## 决策

`apps/browser-extension` 提供一款面向 Chrome 与 Edge 116 及以上版本的 Chromium Manifest V3 侧边栏扩展。浏览器操作按钮打开侧边栏。只有用户手势发生后，`activeTab` 与 `scripting` 才注入 content script；manifest 不授予 `<all_urls>`，唯一持久 host permission 是 `127.0.0.1` 与 `localhost` 的 HTTP 回环地址。公开 manifest key 固定扩展 id，使本地桥可以识别一个可复现来源，而无需分发私钥材料。

content script 捕获标题、URL、选中文本、有界的可见页面文本，以及有界的交互元素列表；它从不捕获字段当前值。元素获得仅对本次快照有效的短 id，模型不编写 CSS selector。新的 `browser` agent preset 只包含一份完整 persona，不含模型可见工具或运行时上下文，并把全部页面文本与标签视为不可信数据。Curupira Memória 的模型可见插件从进程全局组合迁入普通的 `standard`、`code` 与 `cordis` agent scope；因此受限 preset 保持为空，而底层 knowledge 服务仍然共享。

侧边栏将 **Conversa（对话）** 与 **Automação（自动化）** 分开。对话会创建或恢复一个持久 Harness 会话，扩展存储中只保存其 session id，并从 `session.history` 投影用户与 assistant 消息；内部页面包装不会显示在对话记录中。可选的页面上下文复选框会在发送时捕获当前页面。独立的 `browser-chat` preset 不含工具，以巴西葡萄牙语进行对话，拒绝捕获页面数据中嵌入的指令，并把修改页面的请求引导到 Automação。新建对话只让面板脱离上一会话，不会删除其持久 history。

扩展创建本地 `browser` 会话，请用户已配置的 provider 仅生成一个 JSON 计划，轮询持久 history，解析并校验响应，然后显示人类可读的预览。只有另一次单独的 **执行已批准操作** 手势，才会依据当前快照中的 id 执行 `click`、`fill`、`select`、`check` 或 `scroll`。密码、支付卡字段、验证码、文件上传和浏览器内部页面始终被阻止。提交类或其他有后果的操作会标记风险，并要求额外勾选和确认。页面一旦导航，快照便失效，必须重新捕获并规划。

专用的 **填写表单** 路径会复用受限规划器，但把可接受的结果进一步缩小为 `fill`、`select` 和 `check`。请求只包含符合条件的字段元数据，并明确将用户提供的事实与不可信的表单文本分开。它禁止编造个人事实，要求回答置信度，并忽略不支持或敏感的字段。预览为每个动作提供批准开关和可编辑值；低置信度答案默认关闭。即使模型输出具有对抗性，本地校验器也会在渲染前拒绝整个结果，因此该模式无法点击提交控件。

表单宏提供一条不调用模型的独立确定性路径。用户明确启动 **复制宏** 录制后，扩展会捕获已授权标签页中的非敏感字段更改，以及中间的下一步、继续或前进控件。字段指纹组合语义标签、问题上下文、类型、名称、无障碍属性和序号，而不使用屏幕坐标或可执行 selector。service worker 通过 session storage 串行化录制更新，在现有 `activeTab` 授权下同源导航后将录制器重新注入每个已授权 frame，完成后再把带版本的宏持久化到本地。开始和结束时也会枚举所有可注入 frame，以便嵌入式表单在校验前完成刷新。回放会以只读方式对每个 frame 中的已录制步骤评分，选择最匹配的 frame，解析其指纹，并且绝不离开录制时的来源。每个文档都有独立 token，因此即使 URL 和字段签名不变，也能区分完整重载。校验器会移除最后一个已知页面上的所有前进动作，包括从文件导入的宏，因此回放无法提交表单的最后一步。

宏是可移植的 JSON，并支持显式导出和导入。导入只接受带版本的 `fill`、`select`、`check` 与中间 `advance` 动作集合，限制页面数、动作数和值的长度，并要求所有页面使用同一个 HTTP 来源。密码、支付卡、验证码和上传控件会在捕获时排除，并在回放时再次检查。由于导出的值可能包含个人信息，UI 与 README 会明确说明该文件是由用户控制的本地数据，而不是可以安全共享的模板。

Host connection 新增 `trustedExtensionIds`，默认值为从 manifest 推导的 CurupiraCode id。只有精确的 `chrome-extension://<id>` 来源，且 `Host` 为回环地址时，才可进行预检和 POST。扩展 GET、WebSocket upgrade、格式错误或未声明的 id、普通跨站页面以及非回环 host 仍被拒绝。特权 RPC 保留内层同源回环检查，因此扩展 CORS 无法打开配置、凭据、原生桌面操作或 preset 创作。这里依赖的是已安装来源身份，只是一条开发桥梁，不是用户认证；token 配对仍属于 roadmap 工作。

## 可移植性

扩展只存储本地回环 base URL，默认 `http://127.0.0.1:3080`，并拒绝非回环配置。产物中没有个人路径、provider 凭据、模型名称或 API key。`pnpm --filter @deepseek-ai/dsh-browser-extension build` 会在 `apps/browser-extension/dist` 生成自包含的未打包扩展；同一目录可载入 Chrome 与 Edge。Firefox build 保持独立，因为其侧边栏 manifest API 与 Chromium 的 `sidePanel` API 不兼容。

## 验证

单元测试固定了回环 URL 归一化、原生 Fetch 调用、完整 RPC 信封、chat 会话创建、不泄露页面包装的对话投影、严格 JSON 规划、有界元素 id、敏感字段拒绝、风险分类、仅表单动作的强制约束、有效的选择项、从表单 prompt 排除敏感与提交控件、宏事件去重、可移植 schema 校验、同源强制约束、可执行动作拒绝以及最终步骤的前进动作移除。真实发布组合的 e2e 会同时挂载 `browser` 与 `browser-chat`，断言其精确 prompt 快照与空工具目录，并另外证明普通 preset 仍保留 Curupira Memória。Host 测试覆盖有效和无效扩展 id、仅限回环的来源识别、允许的预检 header 与冒充者拒绝。本地重启构建后的 Host 后，发布来源的预检收到 204，`host.describe` 收到 200，未声明扩展 id 收到 403，实时 preset 名单也暴露两个受限浏览器模式。Manifest 验证会推导并固定稳定 id，并拒绝非回环 host permission。

## 考虑过的替代方案

**让扩展使用普通 Web 来源。** 已拒绝，因为扩展页面不与 served application 同源；假装同源是在绕过而不是扩展现有信任边界。

**允许所有扩展来源或所有网站。** 已拒绝，因为本地可达且未认证的 RPC endpoint 不应变成整个浏览器的环境能力。本原型同时强制精确的已安装来源识别与回环限制。

**挂载 standard agent，再要求它不要使用工具。** 已拒绝，因为 prompt 指令不是能力边界。受限 preset 的工具目录在结构上就是空的。

**整体嵌入现有扩展。** Page Assist（MIT）、Nanobrowser（Apache-2.0）与 WebBrain（当前版本为 GPL-3.0）证明了侧边栏对话和 Ask/Act 分离的产品方向，但它们各自拥有 provider、会话、权限与 agent loop。替换这些层会重复或绕过 Harness。其公开产品模式为分离界面提供参考；本实现没有复制第三方源码。

**立即执行模型输出。** 已拒绝，因为页面解释可能错误或受到对抗内容影响。校验、预览和显式执行手势是三个分离并被强制的状态。

**确认后自动填写密码、支付和上传。** 已暂缓，因为这些能力需要更强的策略、字段级披露、token 配对与专用对抗测试。

## 后果

该原型现已能利用用户现有的 CurupiraCode provider，在当前页面上进行持久对话与有界自动化，不需要额外 API 凭据。回复目前会在持久 turn 完成后整体出现，而不是逐 token 流式显示。它有意一次只处理一个已捕获页面；流式输出、多标签比较、持久引用、可恢复导航工作流、本地操作日志查看器、token 配对、商店打包与 Firefox 支持仍是未来工作。公开 manifest key 能稳定身份，却不能认证一个人，因此桥保持仅限回环，也不得被复用为远程访问安全机制。
