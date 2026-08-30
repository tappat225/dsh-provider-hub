# dsh-provider-hub

DSH LLM **provider 中枢插件**：在 DSH 的插件配置栏里配置**任意多个网关**（每个网关是一个 OpenAI / Anthropic 兼容端点，独立协议、独立 UA、独立 key、独立模型目录），启用内置的主流模型目录后，模型直接出现在 DSH 的模型选择器里——**不需要手写 `settings.yaml` 的 `llm-pi-ai.providers`**。

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
├── index.ts          # 插件入口（host）：Config schema / apply / 凭据解析 / 注册
├── types.ts          # 本地类型（WireConfig / wire 事件形状）
├── catalog.ts        # 内置主流模型目录 + 条目解析（overrides/custom 合并）
├── adapter.ts        # GatewayAdapter（LlmAdapter 实现：双协议请求 + chunk 转换）
├── discovery.ts      # 模型发现（带自定义 UA 拉 GET {baseURL}/models）
├── host/
│   ├── contract.ts   # Typert wire 契约（INVOCATIONS / TYPERT_MANIFEST，host+client 共享）
│   └── runtime.ts    # ProviderHubRuntime（Remote 服务：配置读写/模型管理/发现）
├── client/
│   ├── static.tsx    # client 入口：挂载 Remote 命名空间 + 注册设置页插槽
│   ├── page.tsx      # 「Provider Hub」设置页组件（网关配置 + 模型管理）
│   ├── locales.ts    # 中/英词典
│   └── page.css.ts   # 页面样式
└── wire/
    ├── sse.ts         # 通用 SSE 解析器
    ├── anthropic.ts   # Anthropic 消息/工具转换 + SSE -> StreamChunk
    └── openai.ts      # OpenAI 消息转换 + chat.completion.chunk -> StreamChunk
```

构建产出两个 bundle：`lib/index.js`（host，node ESM）+ `lib/client.js`（client，ModuleLoader CJS）。

基于 DSH 标准插件能力：

| 能力 | 机制 |
|---|---|
| 插件配置栏 | `Config` schemastery schema → DSH 插件设置页自动渲染表单（多网关列表） |
| 配置持久化/热更新 | `installSettingsSection(ctx, 'llm-provider-hub', ...)` → settings 命名空间 |
| Models 页卡片 | `ctx.llm.registerConfigurableProviders([...])`（每网关一张卡片） |
| 模型进选择器 | `ctx.llm.registerAdapter(providers, adapter)` 一次注册全部网关路由（adapter 按 `options.provider` 选路） |
| 一键发现模型 | `ctx.llm.registerModelDiscovery(NS, discover)`：带自定义 UA 请求 `GET {baseURL}/models`，解析 `context_window`/`max_output_tokens` 等（按网关） |
| 内置模型参数 | `MODEL_CATALOG`：主流模型（GLM / Claude / GPT / Qwen / DeepSeek）的 contextWindow、maxTokens、输入模态、reasoningEfforts |

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
包的 `dsh.bundle.patch` + `cordis.patch.yml` 会让加载器自动挂载插件，重启后即出现在插件设置页。

npm 包名为 **`@tappat225/dsh-provider-hub`**（用户名 scope，避免与其他同名项目冲突；`npm pack` 产物相应为 `tappat225-dsh-provider-hub-<版本>.tgz`）。正式发布渠道为 GitHub tag；若发布 npm，需 scope 所有者账号 + `--access public`。

> **从旧包名 `dsh-provider-hub` 升级**：包名已 scoped，旧安装不会自动迁移——重新执行 `dsh plugin --profile <profile> add`（或把 profile `package.json` 里 bundles/dependencies 的旧条目替换为 `@tappat225/dsh-provider-hub` 后 `pnpm install`），再重启。插件设置（命名空间 `llm-provider-hub`）与网关配置不受影响。

### 方式二：手动 bundle（pnpm workspace）

1. `~/.dsh/profiles/desktop/package.json`：

   ```json
   {
     "dsh": { "profile": { "bundles": [ "...", "@tappat225/dsh-provider-hub" ] } },
     "dependencies": { "...", "@tappat225/dsh-provider-hub": "file:/path/to/dsh-provider-hub" }
   }
   ```

   在 `~/.dsh/profiles/desktop` 下 `pnpm install`，重启 DSH Desktop。

2. 打开 **插件设置页** 找到 `provider-hub`：填 `baseURL`、API key（`apiKey` 直接填，或 `apiKeyEnv` 指向环境变量）、勾选要启用的模型（`enabledModels`），必要时 `extraHeaders`。

3. （可选）在 Models 页该 provider 卡片上点"发现模型"，从网关 `/models` 拉取并采纳。

4. 在模型选择器里切到该 provider 下的模型即可使用。

## 配置项（插件面板）

配置是一个**网关列表**（`gateways`），每个网关独立一套下列字段：

| 字段 | 默认 | 说明 |
|---|---|---|
| `provider` | `hub-gateway`（自动去重为 hub-gateway-1…） | 提供方 ID（跨网关唯一，改名实时生效、无需重启；重名或空名在保存时拒绝。前缀 `hub-` 标识本插件，避免与其他 provider 插件路由名冲突） |
| `displayName` | `Gateway` | 选择器显示名 |
| `baseURL` | 空（必填） | 上游地址 |
| `api` | `anthropic-messages` | 或 `openai-completions`（后者按模型 `reasoningEfforts` 映射派发 `reasoning_effort`，语义见「思考强度派发」） |
| `userAgent` | `claude-cli/2.0.1 (external, cli)` | wire UA（可完全自定义，每网关独立；留空自动回退默认值，设置页内置常见客户端 UA 预设一键填写） |
| `apiKeyEnv` | `GATEWAY_API_KEY` | credential-ref 环境变量名 |
| `apiKey` | 空 | 字面量 key，优先于 apiKeyEnv（设置页默认掩码显示，可切换明文） |
| `extraHeaders` | `{}` | 附加请求头 |
| `systemRole` | `system` | openai 路径系统提示词角色；`developer` 可修复只认 developer 角色的严格网关（GPT 系） |
| `anthropicThinking` | `false` | anthropic 路径是否把选中的思考档位透传为 `thinking: {type:'enabled', budget_tokens: N}`（档位→预算：minimal 512 / low 1024 / medium 4096 / high 8192 / xhigh 16384 / max 24576；`max_tokens` 自动抬高到 `budget+1024` 以上；未映射档位在请求前拒绝） |
| `enabledModels` | `["glm-5.3"]` | 从内置目录勾选 |
| `modelOverrides` | `{}` | 按模型 id 对内置目录做字段级参数覆盖（contextWindow/maxTokens/input/reasoningEfforts/name） |
| `customModels` | `[]` | 自定义模型（id/name/contextWindow/maxTokens/input/reasoningEfforts；映射语义见下方「思考强度派发」） |

## 内置模型目录（MODEL_CATALOG）

GLM-5.3 / GLM-5.3-Flash / Claude Opus 4.8 / Claude Sonnet 4.6 / Claude Haiku 4.5 / GPT-5.6 Sol·Luna·Terra / GPT-4o·4o-mini / Qwen3.8-Max·27B / DeepSeek V3·R1·V4 Flash / Kimi K2 / ——含 contextWindow、maxTokens、模态与 reasoningEfforts（推理模型 `off` 到 `max`；GPT-4o·4o-mini·DeepSeek V3 为非推理模型，无映射）。参数为公开规格，网关实际能力以"发现模型"结果为准。

## 思考强度派发（reasoningEfforts）

映射语义（对照 llm-pi-ai 参考实现）：**键 = 选择器提供的档位，值 = 线上发送的拼写**。

- 非 `off` 档位必须带 wire 值；选中的档位按其值派发——如 `high: 'ultra'` 在 openai 路径发送 `reasoning_effort: "ultra"`（网关方言拼写）。
- `off` 留空（null）= 支持"关闭"，省略参数（保留 provider 默认行为）；`off` 带值（如 `off: 'none'`）= 显式发送该关闭拼写。
- 未声明的档位（以及无映射模型收到任何档位）在**发请求前**以 `UNSUPPORTED_REASONING_EFFORT` 拒绝，不透传给网关。
- 仅含 `off` 的映射会被解析拒绝——非推理模型不要声明映射（内置 GPT-4o / GPT-4o mini / DeepSeek V3 已无映射）；`reasoningEfforts: {}` 与缺省等价（无推理能力）。
- 校验在模型解析期进行（fail-loud）：非 off 空值 / 空字符串 / 仅含 off 的映射都以带网关+模型+档位名的诊断拒绝。
- anthropic 路径：开启 `anthropicThinking` 后按档位映射 `thinking` 预算（预算表见配置表）；`off` 不发送 thinking；未映射档位在请求前拒绝。
- `modelOverrides` 的 `reasoningEfforts` 整体替换内置映射（字典无删除语义；留空 `{}` 视为未设置，保留内置映射）。
- 设置页暂无该映射的编辑入口，需在 settings.yaml 中手改。

## 验证

- 单测（`test/plugin.test.mjs`，全过）：Config schema（多网关）、多网关注册（`registerConfigurableProviders`/`registerAdapter` 各 2 路由）、网关隔离（`listModels` A 不含 B 的模型）、内置+自定义模型解析、`listModels`/`resolveModel`（含 UNKNOWN_MODEL 拒绝）、`prepareCall`、两种协议的 SSE→chunk 转换（文本、流式 tool_use、流式 tool_calls、reasoning_content）、模型发现字段映射、思考强度派发（wire 拼写、off 显式关闭、未声明/未映射档位请求前拒绝、map 校验、lone-off 清理）、runtime 按网关 index 的增删改/provider 改名实时生效（重名/空名拒绝）/自定义。
- live（假 key）：对按 UA 白名单校验的网关，自定义 UA 生效（UA 关通过、key 关拒绝）；配真 key 即可用。

## 限制

- `anthropic-messages` 路径默认不透传思考档位；开启 `anthropicThinking` 后按档位映射为 `thinking`（网关兼容层行为不一，默认关闭更安全）。
- `openai-completions` 路径按 `reasoningEfforts` 映射派发 `reasoning_effort`（语义见「思考强度派发」；未声明档位请求前拒绝，不做网关侧猜测）。
- 模型发现拉取的 `/models` 若网关也做 UA 校验，插件已带自定义 UA，可正常访问。
- 网关路由名改动实时生效（保存时立即重新注册路由）；多网关路由名不能重复（设置页会自动生成去重名，重名保存被拒绝）。
