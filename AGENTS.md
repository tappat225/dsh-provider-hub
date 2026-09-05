# AGENTS.md

本文件是本仓库（dsh-provider-hub / npm 包 `@tappat225/dsh-provider-hub`）的项目说明入口，供协作者与 AI agent 快速了解项目背景、架构与约束。用户侧文档见 [README.md](README.md)；接手开发需先读 `note/memory/` 长期记忆（本地私有，不入 git，见下方「记忆记录规则」）。

## 项目是什么

DSH（DeepSeek Harness）LLM **provider 中枢插件**：通过 DSH 左侧栏的 **Provider Hub** 独立面板（卡片式控制台）配置**任意多个网关**（每个网关是一个 OpenAI / Anthropic 兼容端点，独立协议、独立 UA、独立 key、独立模型目录），启用内置主流模型目录后，模型直接出现在 DSH 的模型选择器里——**不需要手写 `settings.yaml` 的 `llm-pi-ai.providers`**。

核心特色：针对按 User-Agent 白名单校验客户端的网关，插件发出的请求携带每个网关**完全自定义的 UA**（绕开 DSH 强制的归因头），多网关可同时接入多个 UA 白名单网关。

## 整体架构：host/client 双半区 + 三协议 wire 层

单一包、两份构建产物（esbuild 双 bundle），源码都在 `src/`：

| 半区 | 源码 | 产物 | 职责 |
|---|---|---|---|
| host | `src/index.ts` + `src/host/` | `lib/index.js`（node ESM） | DSH 宿主进程：Config schema（`gateways` 数组）、apply、凭据解析、LLM 路由注册、`ProviderHubRuntime`（typert Remote：配置读写/模型管理/发现） |
| client | `src/client/` | `lib/client.js`（ModuleLoader CJS） | 渲染进程：Provider Hub 面板 UI（React 是宿主全局，卡片式控制台） |

- `src/wire/` 是协议层：`anthropic-messages` / `openai-completions` / `openai-responses` 三协议的消息转换 + SSE→StreamChunk；`src/adapter.ts` 按 `options.provider` 选路派发。`src/wire/failure.ts` 是三协议与 HTTP 边界共用的**失败分类单一入口**：宿主的重试执行器只按 `failure.code` 决定是否重发，码不在可重试集合里就直接结束本轮（表现为要用户手动输「继续」），所以新增失败路径时必须给它一个分类码，不要直接用兜底的 `UPSTREAM_ERROR`。
- `lib/` 是构建产物且入库（历史如此）：**绝不手改**，改 `src/` 后必须重建（见「开发与验证」）。
- 与宿主交互的关键机制（settings 读写范式、client bundle 注册格式、remote `$mount` 范式等）的踩坑结论沉淀在 `note/memory/KEY.md`，动手前先读。

## 最高优先级规则：任务收尾必须自动写入记忆

**每完成一个任务/子任务（含修复、调研、交接），AI agent 必须自动向 `note/memory/MEMORY.md` 追加一条流水账——不需要请示、不需要用户确认，收尾即写；跳过这一步视为任务未收尾。**

收尾的固定动作序列：改动落盘 → 验证通过（`npm run check`）→ 如实报告结果与 `git status` → **自动追加 MEMORY.md** → 停下等用户决定是否提交。

定位到的 issue/bug **根因**，只有在用户认可这确实是根因之后才能写入 `note/memory/KEY.md`；未经确认的猜测一律不进 KEY。完整格式与写入纪律见下方「记忆记录规则」。

注意：`note/` 整个目录在 `.gitignore` 中（不入 git），记忆文件是**本机私有文件**。

## 最高优先级规则：commit 与 push 需用户明确要求才能执行

**除非用户在当次对话中主动要求，AI agent 不应在任务收尾时自动创建本地 commit，更不能自动 push 到远程。** 完成一项改动后，正确的收尾方式是：改动落盘、验证通过、如实报告当前 `git status`、写入记忆，然后停下等待用户决定，而不是默认执行 `git commit`。

- "用户要求做某个功能/修复"不等于"用户要求 commit"，两者是分开的授权，不能因为改动已经完成就顺带提交
- 若用户说"提交"/"commit"但未提及 push，只执行 commit，不执行 push
- push 必须已有明确的 push 指示（远程为 SSH，偶发连接中断重试即可）；push 时按用户指示打 tag（`git push origin master --tags`）
- commit message 用英文、描述完整；历史保持干净，不提压缩/squash 等操作痕迹
- 版本 bump（`package.json` + `dsh.plugin.json` + README tarball 行三处同步）是独立的小 commit，commit 前让用户确认

## 铁律：全通用项目，不出现第三方特定名称

**本插件是全通用项目，任何入库文件（README、代码注释、`package.json`/`dsh.plugin.json` description、commit message）不得出现第三方特定站点、插件、产品名**（如具体网关域名、其他具体插件名）。模型名（GLM / Claude / GPT / Qwen / DeepSeek 等）是公开通用信息，允许。本地私有文件（`note/` 等，不入 git）不受此限。

## 目录结构

```
.
├── AGENTS.md                     # 本文件
├── README.md                     # 用户文档：功能/安装/配置项/思考强度派发/限制（与 src/catalog.ts 等保持同步）
├── package.json                  # @tappat225/dsh-provider-hub；scripts；dsh.bundle/dsh.client 声明
├── dsh.plugin.json               # DSH 插件描述（id=包名；版本与 package.json 同步）
├── cordis.patch.yml              # bundle 挂载 patch（name=npm 包名，带引号；id=provider-hub 为 fiber id）
├── build.mjs                     # esbuild 双 bundle 构建（CLIENT_LOADER_ID=包名）
├── tsconfig.json
├── src/                          # TypeScript 源码
│   ├── index.ts                  # host 入口：Config schema（gateways 数组）/ apply / 注册 / settings 命名空间
│   ├── types.ts                  # 本地类型（WireConfig / GatewayConfig / wire 事件形状）
│   ├── catalog.ts                # 内置模型目录 MODEL_CATALOG + 条目解析（overrides/custom 合并）
│   ├── adapter.ts                # GatewayAdapter：三协议请求派发 + chunk 转换 + 凭据/请求头处理
│   ├── discovery.ts              # 模型发现（带自定义 UA 拉 GET {baseURL}/models）
│   ├── probe.ts                  # 连接测试第二段（/models 不通时经首选模型发 "hi" 实聊验证）
│   ├── url.ts                    # endpoint 规范化（/v1 自动补齐，防 /v1/v1）+ 凭据 URL 遮蔽
│   ├── host/
│   │   ├── contract.ts           # typert wire 契约（INVOCATIONS / TYPERT_MANIFEST / METHODS 三处同步）
│   │   └── runtime.ts            # ProviderHubRuntime（Remote：配置读写/模型管理/发现/连接测试）
│   ├── client/
│   │   ├── static.tsx            # client 入口：remote $mount + Provider Hub 面板注册
│   │   ├── page.tsx              # 面板内容（卡片式网格 + 编辑器）
│   │   ├── locales.ts            # 中/英词典（键必须成对）
│   │   ├── page.css.ts           # 卡片式控制台样式
│   │   └── primitives.d.ts       # 宿主 UI 原语类型 shim
│   ├── client-runtime.d.ts       # 宿主全局类型 shim
│   └── wire/
│       ├── failure.ts            # 失败分类：HTTP 状态 / 传输抛错 / 上游原生码 / 流终局 → DSH 失败码（重试的唯一路由依据，见 README「失败分类与自动重试」）
│       ├── sse.ts                # 通用 SSE 解析器 + 终局 chunk 构造
│       ├── openai.ts             # openai-completions 消息转换 + chunk 转换
│       ├── responses.ts          # openai-responses 路径
│       └── anthropic.ts          # anthropic-messages 转换 + SSE -> StreamChunk
├── lib/                          # 构建产物（esbuild 双 bundle + sourcemap），入库但绝不手改
├── test/                         # 离线单测：plugin / wire / responses / client-loader / client-page
│   └── helpers/react-shim.cjs    # 渲染冒烟测试用的极简 React shim
├── note/                         # 开发协作记录与历史归档（gitignored，本机私有，不入 git）
│   ├── archive/                  # 历史归档笔记（只读不新增），见 archive/README.md
│   └── memory/                   # AI agent 长期记忆，见下方「记忆记录规则」
│       ├── MEMORY.md             # 任务流水账（收尾自动写入）
│       └── KEY.md                # 已确认根因（需用户确认后写入）
├── reference/                    # 只读参考代码副本（gitignored，不参与构建）
├── temp/                         # 临时探针/脚本（gitignored）
└── node_modules/                 # 依赖（npm install --no-save，不入库）
```

## 记忆记录规则（自动记忆）

`note/memory/` 下两个文件是 AI agent 的长期记忆（`note/` 不入 git，本机私有），记录动机与触发条件不同，不要混用：

| 文件 | 记录什么 | 触发时机 | 是否需要用户确认 |
|---|---|---|---|
| `MEMORY.md` | 完成一个任务/子任务后的流水账：做了什么、为什么、结果如何 | 每次任务收尾时，AI 自动写入 | 不需要，收尾即写 |
| `KEY.md` | 造成某个 issue/bug 的**根因**，聚焦"这个坑是什么、下次别再犯" | 根因被定位到、且用户认可这确实是根因之后 | 需要，未经确认的猜测不写入 |

**写入纪律**：

- MEMORY.md 是收尾动作的一部分（见上方最高优先级规则）；纯问答/无代码改动的轮次也写一行简报，保持时间线完整
- 新条目一律**追加到文件末尾**，不改写、不删除历史条目
- KEY.md 只收"高置信度、已验证、用户确认过"的根因，不是所有 debug 过程都升级成 KEY 条目；KEY 是 MEMORY 的精选子集，数量应远少于 MEMORY
- **不再创建时间戳工作笔记**（`note/YYYY-MM-DD-HH-mm-ss-*.md`）；历史笔记（HANDOFF / roadmap / 各轮工作笔记）已冻结归档到 `note/archive/`（只读，仅作查阅，不新增）。所有记忆只落在下方两个文件。

**MEMORY.md 格式**：

```
[YYYY-MM-DD HH:MM] [git <branch>] [<可选模块标签，如 host/client/wire/catalog>] <正文，陈述做了什么/为什么/结果>
【反馈】情绪:正面/负面 | 分类:<简短分类> | 原话:"<用户原话，仅负面或强烈反馈时记>" | 表现:<用户表现的简述>
§

[YYYY-MM-DD HH:MM] ... 下一条目
```

- 正文一句话到几句话，是完整时间线，不追求精炼
- `【反馈】` 整块可选，只有当用户在本次任务中表达了明显情绪（尤其负面）时才附加，用于避免后续重复触发同类不满；日常无情绪波动的任务不需要这一行
- 条目间用 `§` 单独一行分隔，**`§` 之后再空一行**才写下一条目（即每个记忆块 = 正文 + `§` + 空行，文件末尾条目同理）

**KEY.md 格式**：

```
[YYYY-MM-DD] [summary:一句话概括根因+影响面]
<正文，详细描述根因、修复方式、根治方向>
§
```

- `summary` 要能让人一眼看出"这是什么坑"，正文再展开技术细节
- 条目间用 `§` 单独一行分隔

**记忆的消费侧（开工先读）**：记忆只写不读等于没有。接手任何任务前，先读 `note/memory/KEY.md` 全文（避免重复踩已定位的坑）→ `note/memory/MEMORY.md` 最近若干条（当前进度、未推送 commit 状态），再动手。历史背景如需追溯，可查 `note/archive/` 只读归档。

## 开发与验证

```sh
npm run typecheck   # tsc --noEmit（零错误是硬要求）
npm run build       # node build.mjs && tsc --noEmit（产出 lib/index.js + lib/client.js + sourcemap）
npm test            # 依次跑 plugin / wire / responses / client-loader / client-page 五个测试文件
npm run check       # typecheck + build + test 一键全绿（改动的验收标准）
```

- **改 `src/` 后必须先重建 `lib/` 再跑测试**，否则测试跑的是旧产物
- 测试中直连真实网关的用例需本机代理（如 `127.0.0.1:7890`）：`$env:HTTPS_PROXY='http://127.0.0.1:7890'; $env:NODE_USE_ENV_PROXY='1'`；不设代理时 live 用例网络失败属正常（其余用例仍过）
- node 直接跑 `.ts` 靠类型剥离，字面量漏字段运行时发现不了——改完必须 `tsc --noEmit` 验证
- esbuild 子进程在受限沙箱内可能被拦，此时改用 `node node_modules/esbuild/bin/esbuild` CLI 方式构建（历史经验见 `note/memory/`）
- 依赖安装用 `npm install --no-save`（`node_modules/` 与 `package-lock.json` 均不入库）
- 每次改动的验收清单：typecheck 零错误 / build 双 bundle + map 同步 / test 全绿 / locales zh-en 键成对 / README 与代码保持同步

## 协作须知

- **阅读顺序**：新 agent 接手先读 本文件 → [README.md](README.md) → `note/memory/KEY.md` → `note/memory/MEMORY.md` 最近若干条，再动手。
- **身份四件套硬耦合**：`package.json` name == `cordis.patch.yml` name（带引号，前导 `@` 是 YAML 保留字符）== `build.mjs` 的 CLIENT_LOADER_ID == `dsh.plugin.json` id，改包名四处一起改（`test/plugin.test.mjs` 有一致性守卫测试）；typert 贡献的 `package` 字段 = npm 包名。刻意不改：`cordis.patch.yml` 的 `id: provider-hub`（插件 fiber id）、settings 命名空间 `llm-provider-hub`、wire typeSymbol 前缀。
- **契约三处同步**：`src/host/contract.ts` 新增/修改 remote 方法时，`METHODS` / `INVOCATIONS` / `TYPERT_MANIFEST` 三处必须同步，且 `src/host/runtime.ts` 与 `src/client/page.tsx` 同步消费。
- **文档同步**：README.md 的配置表、内置目录、限制章节与 `src/catalog.ts`、`src/index.ts` 保持一致；`dsh.plugin.json` 版本与 `package.json` 同步。
- **note/ 体系**：长期记忆只写 `note/memory/MEMORY.md` 与 `KEY.md`（规则见上方「记忆记录规则」，不要混用）；`note/archive/` 下既有历史记录（HANDOFF / roadmap / 各轮笔记与索引）仅作查阅，**只读不新增**。
- **reference/ 只读**：只作对照/审计参考，不参与构建，不把其中代码连同其私有耦合拷进 `src/`。
- **不入 git 的目录**（见 `.gitignore`）：`note/`、`temp/`、`reference/`、`node_modules/`、`.claude/`、`.agents/`——均为本机工作区内容，clone 后不存在属正常。
- **环境事实**（DSH Desktop 安装位置、本机 profile 与插件符号链接——重启 DSH 即加载最新构建、代理细节）见 `note/archive/` 下历史 HANDOFF §7（本地私有，只读归档）。
- 深层技术坑（client bundle 注册格式、remote `$mount` 范式、settings 读写范式、react-shim 单实例等）优先查 `note/memory/KEY.md`；历史细节可查 `note/archive/` 下 HANDOFF §6（只读）。
