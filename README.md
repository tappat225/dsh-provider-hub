# dsh-provider-hub

DSH LLM **provider 中枢插件**：通过 DSH 左侧栏设置按钮上方的 **Provider Hub** 独立面板（卡片式控制台）配置**任意多个网关**（每个网关是一个 OpenAI / Anthropic 兼容端点，独立协议、独立 UA、独立 key、独立模型目录），启用内置的主流模型目录后，模型直接出现在 DSH 的模型选择器里——**不需要手写 `settings.yaml` 的 `llm-pi-ai.providers`**。

针对按 User-Agent 白名单校验客户端的网关：插件发出的请求携带每个网关完全自定义的 UA，绕开 DSH 强制的 `deepseek-harness/<version>` 归因头（该头在 `llm-pi-ai` 配置里是保留字段，无法覆盖）。多网关各自携带各自 UA，可同时接入多个 UA 白名单网关。

## 开发

TypeScript 源码在 `src/`，构建产物（esbuild 单文件 bundle）输出到 `lib/`：

```sh
npm run typecheck   # tsc --noEmit
npm run build       # esbuild bundle -> lib/index.js
npm test            # node test/plugin.test.mjs（测试内直连网关时需本机代理）
```

```
src/
├── index.ts            # 插件入口（host）：Config schema / apply / 凭据解析 / 注册
├── types.ts            # 本地类型（WireConfig / wire 事件形状）
├── catalog.ts          # 内置主流模型目录 + 条目解析（overrides/custom 合并）
├── adapter.ts          # GatewayAdapter（LlmAdapter 实现：三协议请求 + chunk 转换 + 凭据/请求头处理）
├── discovery.ts        # 模型发现（带自定义 UA 拉 GET {baseURL}/models）
├── probe.ts            # 连接测试第二段（/models 不通时经首选模型发 "hi" 实聊验证）
├── url.ts              # endpoint 规范化（/v1 自动补齐 / custom 完整地址，防 /v1/v1）
├── host/
│   ├── contract.ts     # Typert wire 契约（INVOCATIONS / TYPERT_MANIFEST，host+client 共享）
│   └── runtime.ts      # ProviderHubRuntime（Remote 服务：配置读写/模型管理/发现/连接测试）
├── client/
│   ├── static.tsx      # client 入口：挂载 Remote 命名空间 + 注册“Provider Hub”左侧面板与 shell overlay
│   ├── page.tsx        # 「Provider Hub」面板内容（卡片式网格 + cc-switch 风格编辑器：请求头行 / 模型行+目录联想下拉 / 配置 JSON 常驻参数框架双向同步）
│   ├── locales.ts      # 中/英词典
│   ├── page.css.ts     # 卡片式控制台样式（品牌 hero / 分段页签 / 卡片网格 / 双列表单，--dsw-alias-* tokens）
│   └── primitives.d.ts # 宿主 UI 原语类型 shim
├── client-runtime.d.ts # 宿主全局类型 shim
└── wire/
    ├── sse.ts          # 通用 SSE 解析器
    ├── anthropic.ts    # Anthropic 消息/工具转换 + SSE -> StreamChunk
    ├── openai.ts       # OpenAI 消息转换 + chat.completion.chunk -> StreamChunk
    └── responses.ts    # openai-responses 路径（input/usage/finish 转换）
```

构建产出两个 bundle：`lib/index.js`（host，node ESM）+ `lib/client.js`（client，ModuleLoader CJS）。

基于 DSH 标准插件能力：

| 能力 | 机制 |
|---|---|
| Provider Hub 面板 | 参考内置 `dsh-community-market`：`sidebar.footer.action` 注册设置按钮上方入口，`shell.overlay` 注册独立模态面板；面板为卡片式控制台（品牌 hero 状态卡、提供方/模型目录分段页签、响应式卡片网格、双列表单内联编辑器）；网关数据仍通过 `providerHub` Remote 读写 |
| 配置持久化/热更新 | `llm-provider-hub` settings 命名空间 → Host Remote 与 LLM 路由实时同步 |
| Models 页卡片 | `ctx.llm.registerConfigurableProviders([...])`（每网关一张卡片） |
| 模型进选择器 | `ctx.llm.registerAdapter(providers, adapter)` 一次注册全部网关路由（adapter 按 `options.provider` 选路） |
| 一键发现模型 | `ctx.llm.registerModelDiscovery(NS, discover)`：带自定义 UA 请求 `GET {baseURL}/models`，解析 `context_window`/`max_output_tokens` 等（按网关） |
| 内置模型参数 | `MODEL_CATALOG`：主流模型（GLM / Claude / GPT / Qwen / DeepSeek / Kimi / Gemini）的 contextWindow、maxTokens、输入模态、reasoningEfforts |

## 安装

### 方式一（官方，推荐）：dsh plugin add

```sh
# 本地路径（开发/测试）
dsh plugin --profile desktop add /path/to/dsh-provider-hub

# 推送 GitHub 后（仓库须打 dsh-plugin topic）
dsh plugin --profile web add github:tappat225/dsh-provider-hub
# 或指定版本 tarball
dsh plugin --profile web add https://github.com/tappat225/dsh-provider-hub/archive/refs/tags/v0.5.0.tar.gz
```

`dsh plugin add` 会把参数转发给 profile 目录里的 pnpm（需先 `npm install -g pnpm`）。
包的 `dsh.bundle.patch` + `cordis.patch.yml` 会让加载器自动挂载插件；重启并刷新 DSH Web 后，左侧栏的设置按钮上方会出现入口 **Provider Hub**。

npm 包名为 **`@tappat225/dsh-provider-hub`**（用户名 scope，避免与其他同名项目冲突；`npm pack` 产物相应为 `tappat225-dsh-provider-hub-<版本>.tgz`）。正式发布渠道为 GitHub tag；若发布 npm，需 scope 所有者账号 + `--access public`。

> **从旧包名 `dsh-provider-hub` 升级**：包名已 scoped，旧安装不会自动迁移——重新执行 `dsh plugin --profile <profile> add`（或把 profile `package.json` 里 bundles/dependencies 的旧条目替换为 `@tappat225/dsh-provider-hub` 后 `pnpm install`），再重启。后台配置（命名空间 `llm-provider-hub`）与网关配置不受影响。

### 方式二：手动 bundle（pnpm workspace）

1. `~/.dsh/profiles/desktop/package.json`：

   ```json
   {
     "dsh": { "profile": { "bundles": [ "...", "@tappat225/dsh-provider-hub" ] } },
     "dependencies": { "...", "@tappat225/dsh-provider-hub": "file:/path/to/dsh-provider-hub" }
   }
   ```

   在 `~/.dsh/profiles/desktop` 下 `pnpm install`，重启 DSH Desktop。

2. 打开左侧栏设置按钮上方的 **Provider Hub** 面板：hero 卡的“添加提供方”（或网格末尾的虚线卡）新建提供方，点卡片上的“编辑”展开配置页。配置页为 cc-switch 风格：基础字段（Base URL / 协议 / 端点模式 / User-Agent / API Key / Key 环境变量）→ **请求头** 键值行（添加请求头 / 行内删除）→ **模型配置** 简表（每行 模型 ID + 显示名称；“拉取模型列表”从上游 `/models` 拉取后点选即加入列表，“添加模型”手动加行）→ **配置 JSON** 详细参数页 → 页尾唯一的 **保存**。
   **模型 ID 联想（点选才套用）**：在模型 ID 输入框打字，从**第一个字符**起出现内置目录联想下拉（前缀匹配优先、包含匹配次之，同时匹配显示名；↑↓ 高亮、Enter 选中、Esc 关闭）。**只有点选下拉条目（或 ↑↓+Enter）才写入完整的目录参数**（contextWindow / maxTokens / input / reasoningEfforts 显式展开，可直接修改）——哪怕手动输完整个目录模型名，也不会自动填参，仅预留全字段参数框架。
   **配置 JSON = 常驻完整参数框架 + 独立编辑面**：每个模型组始终保留完整字段框架 `name` / `contextWindow` / `maxTokens` / `input` / `reasoningEfforts`，`null` = 未设置（内置模型保存时继承目录值；自定义模型需填 contextWindow 与 maxTokens，除非网关配置了 `defaultContextWindow` / `defaultMaxTokens`）。列表与 JSON **双向同步**：列表增删改行会迁移 JSON 组；在 JSON 中**手写新组即新增模型**（组内 `name` 即显示名）、**删除组即删除模型**——完全可以不碰模型列表，直接在 JSON 里逐项填参。JSON 文本无效时锁定列表编辑（不覆盖正在编辑的文本），修正后自动解锁。一次保存同时提交基础字段（save-config）与整份模型列表+参数（save-models，写前经模型解析校验）。

3. （可选）点提供方卡片或配置页的“测试连接”，**两段式判定**：先查上游 `/models`——通了即判定可用（横幅显示延迟/模型数，并自动填充下方模型下拉，**不再发对话请求**）；`/models` 不通才回退为**经当前首选模型**（配置页取模型列表第一个非空行——未保存也可测；卡片取已保存配置的第一个已解析模型）直接发送一条 `"hi"` 对话请求，按真实回应判定——横幅显示延迟/所用模型/回复片段与 token 用量。**两段都失败才判定 provider 不可用**（错误信息同时列出两段原因）。

4. 在模型选择器里切到该 provider 下的模型即可使用。

## 配置项（后台 settings namespace）

配置是一个**网关列表**（`gateways`），每个网关独立一套下列字段：

| 字段 | 默认 | 说明 |
|---|---|---|
| `provider` | `hub-gateway`（自动去重为 hub-gateway-1…） | 提供方 ID（跨网关唯一，改名实时生效、无需重启；重名或空名在保存时拒绝。前缀 `hub-` 标识本插件，避免与其他 provider 插件路由名冲突） |
| `displayName` | `Gateway` | 选择器显示名 |
| `baseURL` | 空（必填） | 上游地址 |
| `api` | `anthropic-messages` | 或 `openai-completions`（后者按模型 `reasoningEfforts` 映射派发 `reasoning_effort`，语义见「思考强度派发」） |
| `userAgent` | `claude-cli/2.0.1 (external, cli)` | wire UA（可完全自定义，每网关独立；留空自动回退默认值，面板内置常见客户端 UA 预设一键填写） |
| `apiKeyEnv` | `GATEWAY_API_KEY` | credential-ref 环境变量名 |
| `apiKey` | 空 | 字面量 key，优先于 apiKeyEnv（面板默认掩码显示，可切换明文） |
| `extraHeaders` | `{}` | 附加请求头 |
| `systemRole` | `system` | OpenAI 路径系统提示词角色；`developer` 可修复只认 developer 角色的严格网关（GPT 系） |
| `enabledModels` | `["glm-5.3"]` | 从内置目录勾选 |
| `modelOverrides` | `{}` | 按模型 id 对内置目录做字段级参数覆盖（contextWindow/maxTokens/input/reasoningEfforts/name） |
| `customModels` | `[]` | 自定义模型（id/name/contextWindow/maxTokens/input/reasoningEfforts；映射语义见下方「思考强度派发」） |

## 内置模型目录（MODEL_CATALOG）

GLM-5.3 / GLM-5.3-Flash / Claude Opus 4.8·4.6 / Sonnet 5·4.6 / Haiku 4.5 / GPT-5.6 Sol·Luna·Terra / GPT-4o·4o-mini / Qwen3.8-Max·27B / DeepSeek V4 Flash·Pro·Flash-Vision-Exp / V3·R1 / Kimi K2 / Gemini 3.8 Flash·3.7 Flash·3.1 Pro ——含 contextWindow、maxTokens、模态与 reasoningEfforts（GLM-5.3 为纯文本、GLM-5.3-Flash 支持图片；DeepSeek V4 Flash·Pro 为纯文本、图片输入在 Flash-Vision-Exp 变体；GLM-5.3·Flash 按官方规格为 1M 上下文 / 128K 输出，思考始终启用故仅提供 `low`/`high`/`max`；DeepSeek V4 家族为 1M 上下文 / 384K 输出，推理档仅 Non-think/High/Max；其余推理模型 `off` 到 `max`；GPT-4o·4o-mini·DeepSeek V3 为非推理模型，无映射）。参数为公开规格，网关实际能力以"发现模型"结果为准。

## 思考强度派发（reasoningEfforts）

映射语义（对照 llm-pi-ai 参考实现）：**键 = 选择器提供的档位，值 = 线上发送的拼写**。

- 非 `off` 档位必须带 wire 值；选中的档位按其值派发——如 `high: 'ultra'` 在 openai 路径发送 `reasoning_effort: "ultra"`（网关方言拼写）。
- `off` 留空（null）= 支持"关闭"，省略参数（保留 provider 默认行为）；`off` 带值（如 `off: 'none'`）= 显式发送该关闭拼写。
- 未声明的档位（以及无映射模型收到任何档位）在**发请求前**以 `UNSUPPORTED_REASONING_EFFORT` 拒绝，不透传给网关。
- 仅含 `off` 的映射会被解析拒绝——非推理模型不要声明映射（内置 GPT-4o / GPT-4o mini / DeepSeek V3 已无映射）；`reasoningEfforts: {}` 与缺省等价（无推理能力）。
- 校验在模型解析期进行（fail-loud）：非 off 空值 / 空字符串 / 仅含 off 的映射都以带网关+模型+档位名的诊断拒绝。
- Anthropic 路径：选中非 `off` 档位时，适配器自动按原生 Anthropic `thinking` 预算派发；`off` 不发送 `thinking`。
- `modelOverrides` 的 `reasoningEfforts` 整体替换内置映射（字典无删除语义；留空 `{}` 视为未设置，保留内置映射）。
- 模型配置面板可在**配置 JSON** 中按模型 id 编辑 `reasoningEfforts`（组内写该字段即生效，未写保留原值）；删除该字段则回落内置映射。

## 验证

- 单测（`test/plugin.test.mjs`，全过）：Config schema（多网关）、多网关注册（`registerConfigurableProviders`/`registerAdapter` 各 2 路由）、网关隔离（`listModels` A 不含 B 的模型）、内置+自定义模型解析、`listModels`/`resolveModel`（含 UNKNOWN_MODEL 拒绝）、`prepareCall`、两种协议的 SSE→chunk 转换（文本、流式 tool_use、流式 tool_calls、reasoning_content）、模型发现字段映射、思考强度派发（wire 拼写、off 显式关闭、未声明/未映射档位请求前拒绝、map 校验、lone-off 清理）、runtime 按网关 index 的增删改/provider 改名实时生效（重名/空名拒绝）/自定义、**两段式连接测试**（/models 优先且成功即止——仅一次请求；/models 不通回退三协议 "hi" 实聊探测、首选模型选取、草稿 model 原样派发、/models 不通且无模型的引导失败、两段皆败合并报错、坏 URL/CRLF 请求头拒绝、上游 401 回显脱敏、凭据 URL 掩码、custom 模式两段各自 verbatim 端点）。
- 渲染冒烟（`test/client-page.test.mjs`，全过）：面板结构（hero/页签/卡片/编辑器）与模型列表 ⇄ 配置 JSON 双向契约——常驻完整参数框架（null=未设置、目录值不泄漏）、手动输完整目录 id 不自动填参、点选下拉/↑↓+Enter 才套用预设、JSON 手写组重建列表行、无效 JSON 锁定列表编辑。
- live（假 key）：对按 UA 白名单校验的网关，自定义 UA 生效（UA 关通过、key 关拒绝）；配真 key 即可用。

## 限制

- `anthropic-messages` 路径会根据模型选择的 reasoning 档位自动处理原生 `thinking`；无需单独配置开关。
- `openai-completions` 路径按 `reasoningEfforts` 映射派发 `reasoning_effort`（语义见「思考强度派发」；未声明档位请求前拒绝，不做网关侧猜测）。
- 模型发现拉取的 `/models` 若网关也做 UA 校验，插件已带自定义 UA，可正常访问。
- 网关路由名改动实时生效（面板保存时立即重新注册路由）；多网关路由名不能重复（面板会自动生成去重名，重名保存被拒绝）。
