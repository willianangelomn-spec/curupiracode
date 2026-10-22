# Agent Note：CurupiraCode 浏览器扩展预览执行器

状态：已实现

[English](2026-08-31-curupiracode-browser-extension.md) | 中文

## 问题

CurupiraCode 需要一款开放的浏览器扩展，把用户指令转换为当前页面上的操作，同时不能让页面内容取得对 agent（智能体）的指挥权，也不能静默暴露宿主计算机。第一版必须能在全新安装中使用，复用本地 harness 已配置的模型，不内嵌 API key，并让每一次页面修改都可先审阅。

普通 Web API 按设计拒绝扩展来源。若使用 `Access-Control-Allow-Origin: *` 或 `<all_urls>` 将其全面开放，会削弱现有的 DNS rebinding 与跨站请求边界。挂载普通 agent preset 还会向一个本只需把有界页面快照转换成 JSON 的任务暴露 Bash、文件系统、Curupira Memória 和无关工具。

## 决策

`apps/browser-extension` 提供一款面向 Chrome 与 Edge 116 及以上版本的 Chromium Manifest V3 侧边栏扩展。浏览器操作按钮打开侧边栏。只有用户手势发生后，`activeTab` 与 `scripting` 才注入 content script；manifest 不授予 `<all_urls>`，唯一持久 host permission 是 `127.0.0.1` 与 `localhost` 的 HTTP 回环地址。公开 manifest key 固定扩展 id，使本地桥可以识别一个可复现来源，而无需分发私钥材料。

content script 捕获标题、URL、选中文本、有界的可见页面文本，以及有界的交互元素列表；它从不捕获字段当前值。元素获得仅对本次快照有效的短 id，模型不编写 CSS selector。新的 `browser` agent preset 只包含一份完整 persona，不含模型可见工具或运行时上下文，并把全部页面文本与标签视为不可信数据。Curupira Memória 的模型可见插件从进程全局组合迁入普通的 `standard`、`ptc` 与 `cordis` agent scope；因此受限 preset 保持为空，而底层 knowledge 服务仍然共享。

侧边栏将 **Conversa（对话）** 与 **Automação（自动化）** 分开。对话会创建或恢复一个持久 Harness 会话，扩展存储中只保存其 session id，并从桥接的 `sessions/messages` 投影用户与 assistant 消息；内部页面包装不会显示在对话记录中。可选的页面上下文复选框会在发送时捕获当前页面。独立的 `browser-chat` preset 不含工具，以巴西葡萄牙语进行对话，拒绝捕获页面数据中嵌入的指令，并把修改页面的请求引导到 Automação。新建对话只让面板脱离上一会话，不会删除其持久 history。

扩展创建本地 `browser` 会话，请用户已配置的 provider 仅生成一个 JSON 计划，轮询桥接的 `sessions/reply`，读取该 prompt 的 `requestId` 所进入的 turn，解析并校验响应，然后显示人类可读的预览。只有另一次单独的 **执行已批准操作** 手势，才会依据当前快照中的 id 执行 `click`、`fill`、`select`、`check` 或 `scroll`。密码、支付卡字段、验证码、文件上传和浏览器内部页面始终被阻止。提交类或其他有后果的操作会标记风险，并要求额外勾选和确认。页面一旦导航，快照便失效，必须重新捕获并规划。

专用的 **填写表单** 路径会复用受限规划器，但把可接受的结果进一步缩小为 `fill`、`select` 和 `check`。请求只包含符合条件的字段元数据，并明确将用户提供的事实与不可信的表单文本分开。它禁止编造个人事实，要求回答置信度，并忽略不支持或敏感的字段。预览为每个动作提供批准开关和可编辑值；低置信度答案默认关闭。即使模型输出具有对抗性，本地校验器也会在渲染前拒绝整个结果，因此该模式无法点击提交控件。

表单宏提供一条不调用模型的独立确定性路径。用户明确启动 **复制宏** 录制后，扩展会捕获已授权标签页中的非敏感字段更改，以及中间的下一步、继续或前进控件。字段指纹组合语义标签、问题上下文、类型、名称、无障碍属性和序号，而不使用屏幕坐标或可执行 selector。service worker 通过 session storage 串行化录制更新，在现有 `activeTab` 授权下同源导航后将录制器重新注入每个已授权 frame，完成后再把带版本的宏持久化到本地。开始和结束时也会枚举所有可注入 frame，以便嵌入式表单在校验前完成刷新。回放会以只读方式对每个 frame 中的已录制步骤评分，选择最匹配的 frame，解析其指纹，并且绝不离开录制时的来源。每个文档都有独立 token，因此即使 URL 和字段签名不变，也能区分完整重载。校验器会移除最后一个已知页面上的所有前进动作，包括从文件导入的宏，因此回放无法提交表单的最后一步。

宏是可移植的 JSON，并支持显式导出和导入。导入只接受带版本的 `fill`、`select`、`check` 与中间 `advance` 动作集合，限制页面数、动作数和值的长度，并要求所有页面使用同一个 HTTP 来源。密码、支付卡、验证码和上传控件会在捕获时排除，并在回放时再次检查。由于导出的值可能包含个人信息，UI 与 README 会明确说明该文件是由用户控制的本地数据，而不是可以安全共享的模板。

扩展通过 Host [扩展桥接](../../../../packages/host/extension-bridge/README.zh.md)连接服务器；Web bundle 以由 manifest 推导的来源以及 `browser` 和 `browser-chat` preset 挂载它。DeepSeek Harness 0.2 的连接只接受携带浏览器 cookie 或 Peer 凭据的同源 `/api` 请求，接纳扩展来源的 `trustedExtensionIds` 例外已撤回；[0.2 基础说明](../architecture/2026-10-22-curupiracode-dsh-0-2-base.zh.md)记录了原因。可见配对取代了它。面板的 **Parear** 按钮用 `chrome.tabs.create` 打开 `/extension-bridge/pair`，因此这次导航会携带 SameSite=Strict 浏览器 cookie；页面只通过 Connection 的 `admit` 接纳已登录的浏览器，由用户在那里批准该来源。页面只显示一次 32 字节的 token，用户把它粘贴到面板中，面板将其存入 `chrome.storage.local` 并作为 bearer token 发送。桥接只在绑定该来源的凭据 grant 记录中保存 token 的 SHA-256 摘要，重新批准时替换它，撤销一旦提交就不再接受它，包括其他进程写入的撤销。

桥接的 `v1` 端点要求回环 Host、精确的允许 Origin 和该来源的 token，并且不发送 CORS 头，因为扩展页面通过其 host permission 访问回环地址。端点集合是固定的：状态、用获准 preset 创建带标题的会话、携带客户端生成的 `requestId` 发送 prompt、读取该 prompt 的回复、读取最近消息、取消，以及向 Curupira Memória 导入一个文档。每个会话范围的调用都会先读取会话当前的 `agentPreset` 投影，因此即使知道带工具会话的 id，扩展也无法访问它。会话调用以桥接自己的 owner Peer（禁用交互）经由 Typert Gateway 执行；宏的录制和回放不需要配对。

## 可移植性

扩展只存储本地回环 base URL 和配对 token，默认 `http://127.0.0.1:3080`，并拒绝非回环配置。产物中没有个人路径、provider 凭据、模型名称或 API key。`pnpm --filter @deepseek-ai/dsh-browser-extension build` 会在 `apps/browser-extension/dist` 生成自包含的未打包扩展；同一目录可载入 Chrome 与 Edge。Firefox build 保持独立，因为其侧边栏 manifest API 与 Chromium 的 `sidePanel` API 不兼容。

## 验证

单元测试固定了回环 URL 归一化、配对代码校验、原生 Fetch 调用、发往桥接端点的 bearer 请求、按 request id 轮询回复、chat 会话创建、不泄露页面包装的对话投影、严格 JSON 规划、有界元素 id、敏感字段拒绝、风险分类、仅表单动作的强制约束、有效的选择项、从表单 prompt 排除敏感与提交控件、宏事件去重、可移植 schema 校验、同源强制约束、可执行动作拒绝以及最终步骤的前进动作移除。真实发布组合的 e2e 会同时挂载 `browser` 与 `browser-chat`，断言其精确 prompt 快照与空工具目录，并另外证明普通 preset 仍保留 Curupira Memória。Manifest 验证会推导并固定稳定 id，拒绝非回环 host permission，并检查 Web bundle 的桥接行允许推导出的来源。桥接包的单元测试固定了 Host、Origin 与 token 准入、只存摘要、轮换与撤销、失败即关闭的重新加载、preset 检查、失败状态码以及拆除。CLI e2e 用 mock provider 启动真实的 `dsh --profile web`，通过已登录页面完成配对，在 `browser-chat` 会话中对话（其模型请求只携带进程全局的 `working_directory` 工具），导入一个文档，拒绝其他来源、伪造的 Host、缺失与已撤销的 token 以及 `standard` 会话，并在重启后保留配对。

## 考虑过的替代方案

**让扩展使用普通 Web 来源。** 已拒绝，因为扩展页面不与 served application 同源；假装同源是在绕过而不是扩展现有信任边界。

**允许所有扩展来源或所有网站。** 已拒绝，因为本地可达且未认证的 RPC endpoint 不应变成整个浏览器的环境能力。精确的已安装来源识别、回环限制和已批准的配对 token 三者缺一不可。

**挂载 standard agent，再要求它不要使用工具。** 已拒绝，因为 prompt 指令不是能力边界。受限 preset 的工具目录在结构上就是空的。

**整体嵌入现有扩展。** Page Assist（MIT）、Nanobrowser（Apache-2.0）与 WebBrain（当前版本为 GPL-3.0）证明了侧边栏对话和 Ask/Act 分离的产品方向，但它们各自拥有 provider、会话、权限与 agent loop。替换这些层会重复或绕过 Harness。其公开产品模式为分离界面提供参考；本实现没有复制第三方源码。

**立即执行模型输出。** 已拒绝，因为页面解释可能错误或受到对抗内容影响。校验、预览和显式执行手势是三个分离并被强制的状态。

**确认后自动填写密码、支付和上传。** 已暂缓，因为这些能力需要更强的策略、字段级披露与专用对抗测试。

**不带 token 接纳扩展 id。** 已拒绝，因为 manifest key 是公开的，任何未打包扩展都能声明同一个 id，而且 id 不记录任何人的批准。在已登录页面签发并绑定来源的 token 同时满足这两点。

**用短配对码换取 token。** 已拒绝，因为扩展要在持有任何凭据之前到一个端点兑换短码，这个端点需要自己的过期与尝试次数限制。复制完整 token 能让每个桥接请求都经过认证。

**给扩展一个 `/connect` 操作员凭据。** 已拒绝，因为 `/connect` 需要进程启动 token，它每次启动都会变化，而且其 Peer 能访问所有 owner Remote，包括带工具的会话和设置。

**接受扩展提供的任何会话 id。** 已拒绝，因为那样对无工具 preset 的限制就只能依赖扩展自身的代码。桥接在每个会话范围的调用上都会读取会话当前的 preset。

## 后果

该原型现已能利用用户现有的 CurupiraCode provider，在当前页面上进行持久对话与有界自动化，不需要额外 API 凭据。回复目前会在持久 turn 完成后整体出现，而不是逐 token 流式显示。它有意一次只处理一个已捕获页面；流式输出、多标签比较、持久引用、可恢复导航工作流、本地操作日志查看器、商店打包与 Firefox 支持仍是未来工作。配对让每个浏览器配置文件多出一次批准步骤，并且在用户撤销之前，任何能访问该配置文件的人都能读取 token。配对证明有人批准了该来源；它不限制已配对的扩展，因为其回环 host permission 也允许它对已登录的 Web 界面执行脚本。
