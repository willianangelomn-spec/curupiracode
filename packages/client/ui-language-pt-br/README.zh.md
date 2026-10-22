---
description: "Web 客户端的巴西葡萄牙语语言包，面向使用葡萄牙语界面的用户，以及新增或更新其翻译的维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-language-pt-br

[English](README.md) | 中文

## 摘要

此包在语言选择中加入 **Português (Brasil)**，并为每个内置界面命名空间注册 pt-BR 词典。请求 `pt-BR` 或单独 `pt` 的浏览器会以葡萄牙语打开；词典中缺少的键回退到英语。它没有运行时状态，也不影响模型请求。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发者备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

CurupiraCode Web 组合包在 locale 插件之后挂载该语言包：

```yaml
- id: ui-language-pt-br
  name: '@deepseek-ai/dsh-client-ui-language-pt-br'
```

在 **设置 → 通用 → 语言** 中选择该语言，或交由浏览器的语言列表决定。

### 更新翻译

[`src/client/dictionaries/`](src/client/dictionaries/) 下的每个词典模块对应一个所属包，并用 `satisfies LocaleDictOf<namespace>` 检查：所属包新增、重命名或删除键时，客户端类型检查会指出这里需要翻译的具体条目。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

[`src/client/index.ts`](src/client/index.ts) 以英语为回退调用 `ctx.locale.addLanguage()`，并以单语言形式 `ctx.locale.register(namespace, 'pt-BR', dictionary)` 注册每个词典，每个命名空间一个 effect，因此释放插件会移除该语言和全部词典。node 半边是空的 Loader 席位。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [locale](../locale/README.zh.md)——语言注册表、语言包和逐键回退链。
- [Web 客户端架构](../../../docs/subsystems/web-client.zh.md)——浏览器插件行如何加载。

-----

<a id="model-experience"></a>
## 模型体验

无，此包只提供浏览器展示；这里的内容不会进入模型请求。

#### KV Cache 影响

无；此包既不组装也不发送提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- **实验插件保持英语**——`packages/experimental` 下各包的命名空间没有 pt-BR 词典。
- **包元数据保持英语**——插件标题和描述来自各包的 `locale/<language>.json`，此语言包不扩展它们。

<a id="dev-note"></a>
### 开发者备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
