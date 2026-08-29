// src/index.ts
import z from "@deepseek-ai/schemastery";
import { LlmError as LlmError3, assertUsableApiKey } from "@deepseek-ai/dsh-llm";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";

// src/adapter.ts
import {
  LlmAdapter,
  LlmError,
  resolveRetryPolicy
} from "@deepseek-ai/dsh-llm";

// src/catalog.ts
import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
var MODEL_CATALOG = {
  "glm-5.3": {
    name: "GLM-5.3",
    contextWindow: 2e5,
    maxTokens: 131072,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium", high: "high" }
  },
  "glm-5.3-flash": {
    name: "GLM-5.3-Flash",
    contextWindow: 1e6,
    maxTokens: 131072,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", high: "high", max: "max" }
  },
  "claude-opus-4-8": {
    name: "Claude Opus 4.8",
    contextWindow: 1e6,
    maxTokens: 32768,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }
  },
  "claude-sonnet-4-6": {
    name: "Claude Sonnet 4.6",
    contextWindow: 1e6,
    maxTokens: 32768,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium", high: "high", max: "max" }
  },
  "gpt-5.6-sol": {
    name: "GPT-5.6 Sol",
    contextWindow: 1e6,
    maxTokens: 32768,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }
  },
  "gpt-5.6-luna": {
    name: "GPT-5.6 Luna",
    contextWindow: 1e6,
    maxTokens: 32768,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium", high: "high", max: "max" }
  },
  "gpt-5.6-terra": {
    name: "GPT-5.6 Terra",
    contextWindow: 1e6,
    maxTokens: 32768,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }
  },
  "qwen3.8-max": {
    name: "Qwen3.8-Max",
    contextWindow: 256e3,
    maxTokens: 32768,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium", xhigh: "xhigh" }
  },
  "qwen3.8-27b": {
    name: "Qwen3.8-27B",
    contextWindow: 256e3,
    maxTokens: 32768,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium", xhigh: "xhigh" }
  },
  "deepseek-v4-flash": {
    name: "DeepSeek V4 Flash",
    contextWindow: 128e3,
    maxTokens: 8192,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium", high: "high", max: "max" }
  },
  // --- 2026-08 catalog expansion: parameters from public specs / provider listings ---
  "claude-haiku-4-5": {
    name: "Claude Haiku 4.5",
    contextWindow: 2e5,
    maxTokens: 8192,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium" }
  },
  "deepseek-v3": {
    name: "DeepSeek V3",
    contextWindow: 128e3,
    maxTokens: 8192,
    input: ["text"],
    reasoning: { off: null }
  },
  "deepseek-r1": {
    name: "DeepSeek R1",
    contextWindow: 128e3,
    maxTokens: 8192,
    input: ["text"],
    reasoning: { off: null, low: "low", medium: "medium", high: "high", max: "max" }
  },
  "kimi-k2": {
    name: "Kimi K2",
    contextWindow: 128e3,
    maxTokens: 16384,
    input: ["text", "image"],
    reasoning: { off: null, low: "low", medium: "medium", high: "high", max: "max" }
  },
  "gpt-4o": {
    name: "GPT-4o",
    contextWindow: 128e3,
    maxTokens: 16384,
    input: ["text", "image"],
    reasoning: { off: null }
  },
  "gpt-4o-mini": {
    name: "GPT-4o mini",
    contextWindow: 128e3,
    maxTokens: 16384,
    input: ["text", "image"],
    reasoning: { off: null }
  }
};
function isUnset(value) {
  if (value === void 0 || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return value === "";
}
function resolveModelEntries(gw, presetEntry) {
  const out = [];
  const overrides = gw.modelOverrides ?? {};
  for (const id of gw.enabledModels ?? []) {
    const entry = MODEL_CATALOG[id];
    if (entry === void 0) continue;
    const ov = overrides[id];
    out.push({
      id,
      name: entry.name,
      contextWindow: entry.contextWindow,
      maxTokens: entry.maxTokens,
      input: [...entry.input],
      reasoning: entry.reasoning,
      ...ov === void 0 ? {} : {
        ...isUnset(ov.name) ? {} : { name: ov.name },
        ...isUnset(ov.contextWindow) ? {} : { contextWindow: ov.contextWindow },
        ...isUnset(ov.maxTokens) ? {} : { maxTokens: ov.maxTokens },
        ...isUnset(ov.input) ? {} : { input: [...ov.input] },
        ...isUnset(ov.reasoningEfforts) ? {} : { reasoning: ov.reasoningEfforts }
      }
    });
  }
  for (const custom of gw.customModels ?? []) {
    out.push({
      id: custom.id,
      name: custom.name || custom.id,
      contextWindow: custom.contextWindow,
      maxTokens: custom.maxTokens,
      input: custom.input ?? ["text"],
      reasoning: custom.reasoningEfforts
    });
  }
  if (presetEntry !== void 0 && !out.some((entry) => entry.id === presetEntry.id)) {
    out.push(presetEntry);
  }
  return out;
}
function catalogEntryFor(gw, model, presetEntry) {
  return resolveModelEntries(gw, presetEntry).find((entry) => entry.id === model);
}
function reasoningMetadata(entry) {
  const map = entry.reasoning;
  if (map === void 0 || Object.keys(map).length === 0) return void 0;
  const efforts = Object.keys(map).map((id) => ({ id: ReasoningEffortId(id), name: id }));
  return { efforts, defaultEffort: efforts[0]?.id === "off" ? void 0 : efforts[0]?.id };
}

// src/wire/sse.ts
async function* iterateSse(response, signal) {
  const reader = response.body?.getReader();
  if (reader === void 0) return;
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = "message";
        const data = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).trim());
        }
        if (data.length > 0) yield { event, data: data.join("\n") };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
function errorFinish(message) {
  return {
    type: "finish",
    reason: { kind: "error", failure: { code: "UPSTREAM_ERROR", message } }
  };
}

// src/wire/anthropic.ts
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
function toAnthropicMessages(messages) {
  const wire = [];
  for (const message of messages) {
    const blocks = message.content;
    const list = typeof blocks === "string" ? [{ type: "text", text: blocks }] : blocks;
    if (message.role === "user") {
      const content = [];
      for (const block of list) {
        if (block.type === "text") {
          content.push({ type: "text", text: block.text });
        } else if (block.type === "image") {
          const source = extractInlineImage(block);
          if (source !== void 0) content.push({ type: "image", source });
        } else if (block.type === "tool-result") {
          content.push({
            type: "tool_result",
            tool_use_id: block.toolCallId,
            ...block.isError ? { is_error: true } : {},
            content: serializeToolResult(block.content)
          });
        }
      }
      wire.push({ role: "user", content });
    } else if (message.role === "assistant") {
      const content = [];
      for (const block of list) {
        if (block.type === "text") {
          content.push({ type: "text", text: block.text });
        } else if (block.type === "reasoning") {
          content.push({ type: "text", text: block.text });
        } else if (block.type === "tool-call") {
          content.push({
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: safeJsonParse(block.arguments ?? "{}")
          });
        }
      }
      wire.push({ role: "assistant", content });
    }
  }
  return wire;
}
function extractInlineImage(block) {
  const candidate = block.source;
  if (typeof candidate === "string" && candidate.length > 0) {
    return {
      type: "base64",
      media_type: block.mediaType ?? "image/png",
      data: candidate
    };
  }
  if (candidate !== null && typeof candidate === "object") {
    const obj = candidate;
    if (obj.type === "base64" && typeof obj.data === "string" && obj.data.length > 0) {
      return {
        type: "base64",
        media_type: typeof obj.media_type === "string" ? obj.media_type : "image/png",
        data: obj.data
      };
    }
  }
  return void 0;
}
function serializeToolResult(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part !== null && typeof part === "object" && part.type === "text") {
        return part.text ?? "";
      }
      return JSON.stringify(part);
    }).join("\n");
  }
  return JSON.stringify(content ?? "");
}
function toAnthropicTools(tools) {
  return (tools ?? []).map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: tool.parameters ?? { type: "object", properties: {} }
  }));
}
async function* anthropicSseToChunks(response, signal) {
  const partials = /* @__PURE__ */ new Map();
  let sawStop = false;
  try {
    for await (const sse of iterateSse(response, signal)) {
      if (sse.event === "error") {
        yield errorFinish(sse.data);
        return;
      }
      let payload;
      try {
        payload = JSON.parse(sse.data);
      } catch {
        continue;
      }
      switch (payload.type) {
        case "content_block_start": {
          const index = payload.index;
          if (payload.content_block.type === "tool_use") {
            partials.set(index, {
              blockType: "tool-call",
              text: "",
              toolId: payload.content_block.id,
              toolName: payload.content_block.name,
              arguments: ""
            });
            yield { type: "block-start", index, blockType: "tool-call" };
          } else if (payload.content_block.type === "text") {
            partials.set(index, { blockType: "text", text: "", arguments: "" });
            yield { type: "block-start", index, blockType: "text" };
          } else if (payload.content_block.type === "thinking") {
            partials.set(index, { blockType: "reasoning", text: "", arguments: "" });
            yield { type: "block-start", index, blockType: "reasoning" };
          }
          break;
        }
        case "content_block_delta": {
          const index = payload.index;
          const partial = partials.get(index);
          if (partial === void 0) break;
          if (payload.delta.type === "text_delta" && payload.delta.text !== void 0) {
            partial.text += payload.delta.text;
            yield { type: "text-delta", index, text: payload.delta.text };
          } else if (payload.delta.type === "thinking_delta" && payload.delta.thinking !== void 0) {
            partial.text += payload.delta.thinking;
            yield { type: "reasoning-delta", index, text: payload.delta.thinking };
          } else if (payload.delta.type === "input_json_delta" && payload.delta.partial_json !== void 0) {
            partial.arguments += payload.delta.partial_json;
            yield {
              type: "tool-call-delta",
              index,
              id: partial.toolId,
              name: partial.toolName,
              argumentsDelta: payload.delta.partial_json
            };
          }
          break;
        }
        case "content_block_stop": {
          const index = payload.index;
          const partial = partials.get(index);
          if (partial === void 0) break;
          const block = partial.blockType === "tool-call" ? { type: "tool-call", id: partial.toolId, name: partial.toolName ?? "", arguments: partial.arguments } : partial.blockType === "reasoning" ? { type: "reasoning", text: partial.text } : { type: "text", text: partial.text };
          yield { type: "block-end", index, block };
          partials.delete(index);
          break;
        }
        case "message_delta": {
          if (payload.usage !== void 0) {
            yield {
              type: "usage",
              usage: {
                inputTokens: payload.usage.input_tokens ?? 0,
                outputTokens: payload.usage.output_tokens ?? 0,
                ...payload.usage.cache_read_input_tokens === void 0 ? {} : { cacheReadTokens: payload.usage.cache_read_input_tokens },
                ...payload.usage.cache_creation_input_tokens === void 0 ? {} : { cacheWriteTokens: payload.usage.cache_creation_input_tokens }
              }
            };
          }
          if (payload.delta?.stop_reason === "max_tokens") {
            yield { type: "finish", reason: { kind: "max-tokens" } };
            sawStop = true;
            return;
          }
          break;
        }
        case "message_stop": {
          yield { type: "finish", reason: { kind: "stop" } };
          sawStop = true;
          return;
        }
        default:
          break;
      }
    }
  } catch (error) {
    if (signal?.aborted) yield { type: "finish", reason: { kind: "aborted", failure: { code: "ABORTED", message: "aborted" } } };
    else yield errorFinish(error instanceof Error ? error.message : String(error));
    return;
  }
  if (!sawStop) yield { type: "finish", reason: { kind: "stop" } };
}

// src/wire/openai.ts
function toOpenAIMessages(messages) {
  return messages.map((message) => {
    const blocks = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content;
    const text = (blocks ?? []).map((block) => {
      if (block.type === "text") return block.text ?? "";
      if (block.type === "reasoning") return "";
      if (block.type === "tool-call") return "";
      if (block.type === "tool-result") {
        const payload = typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "");
        return `[tool result of ${block.callId ?? "?"}: ${payload}]`;
      }
      return "";
    }).filter((part) => part.length > 0).join("\n");
    return { role: message.role === "assistant" ? "assistant" : "user", content: text };
  });
}
function toOpenAITools(tools) {
  return (tools ?? []).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.parameters ?? { type: "object", properties: {} }
    }
  }));
}
function toTokenUsage(usage) {
  if (usage === void 0) return void 0;
  const total = usage.prompt_tokens ?? 0;
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const uncached = Math.max(0, total - cached);
  return {
    inputTokens: uncached,
    outputTokens: usage.completion_tokens ?? 0,
    ...cached > 0 ? { cacheReadTokens: cached } : {}
  };
}
async function* openaiCompletionsToChunks(response, signal) {
  let nextIndex = 0;
  let textIndex = -1;
  let reasoningIndex = -1;
  let text = "";
  let reasoning = "";
  let sawText = false;
  let sawReasoning = false;
  let sawToolCall = false;
  let finished = false;
  let usage;
  const toolCalls = /* @__PURE__ */ new Map();
  try {
    for await (const sse of iterateSse(response, signal)) {
      if (sse.data === "[DONE]") break;
      let payload;
      try {
        payload = JSON.parse(sse.data);
      } catch {
        continue;
      }
      if (payload.usage !== void 0) usage = toTokenUsage(payload.usage);
      const choice = payload.choices?.[0];
      if (finished) continue;
      const delta = choice?.delta;
      if (delta === void 0) continue;
      if (delta.reasoning_content !== void 0) {
        if (reasoningIndex < 0) reasoningIndex = nextIndex++;
        sawReasoning = true;
        reasoning += delta.reasoning_content;
        yield { type: "reasoning-delta", index: reasoningIndex, text: delta.reasoning_content };
        continue;
      }
      if (delta.content !== void 0) {
        if (textIndex < 0) textIndex = nextIndex++;
        sawText = true;
        text += delta.content;
        yield { type: "text-delta", index: textIndex, text: delta.content };
      }
      if (delta.tool_calls !== void 0) {
        for (const call of delta.tool_calls) {
          if (call === void 0) continue;
          const wireIndex = call.index ?? 0;
          let partial = toolCalls.get(wireIndex);
          if (partial === void 0) {
            partial = { dshIndex: nextIndex++, id: call.id ?? "", name: "", arguments: "" };
            toolCalls.set(wireIndex, partial);
            sawToolCall = true;
            yield { type: "block-start", index: partial.dshIndex, blockType: "tool-call" };
            if (call.id !== void 0) {
              partial.id = call.id;
              yield { type: "tool-call-delta", index: partial.dshIndex, id: call.id, argumentsDelta: "" };
            }
          }
          if (call.function?.name !== void 0 && partial.name === "") {
            partial.name = call.function.name;
            yield { type: "tool-call-delta", index: partial.dshIndex, id: partial.id, name: partial.name, argumentsDelta: "" };
          }
          if (call.function?.arguments !== void 0) {
            partial.arguments += call.function.arguments;
            yield { type: "tool-call-delta", index: partial.dshIndex, id: partial.id, name: partial.name, argumentsDelta: call.function.arguments };
          }
        }
      }
      if (choice?.finish_reason === "tool_calls") {
        finished = true;
      }
    }
  } catch (error) {
    if (signal?.aborted) yield { type: "finish", reason: { kind: "aborted", failure: { code: "ABORTED", message: "aborted" } } };
    else yield errorFinish(error instanceof Error ? error.message : String(error));
    return;
  }
  const closes = [];
  if (sawReasoning) closes.push({ type: "block-end", index: reasoningIndex, block: { type: "reasoning", text: reasoning } });
  if (sawText) closes.push({ type: "block-end", index: textIndex, block: { type: "text", text } });
  for (const partial of [...toolCalls.values()].sort((a, b) => a.dshIndex - b.dshIndex)) {
    closes.push({
      type: "block-end",
      index: partial.dshIndex,
      block: { type: "tool-call", id: partial.id, name: partial.name, arguments: partial.arguments }
    });
  }
  for (const chunk of closes.sort((a, b) => a.index - b.index)) yield chunk;
  if (usage !== void 0) yield { type: "usage", usage };
  yield {
    type: "finish",
    reason: sawToolCall ? { kind: "tool-calls" } : { kind: "stop" }
  };
}

// src/adapter.ts
var GatewayAdapter = class _GatewayAdapter extends LlmAdapter {
  deps;
  constructor(deps) {
    super();
    this.deps = deps;
  }
  providerInfo(provider) {
    const gw = this.deps.gatewayFor(provider);
    return { id: provider, name: gw?.displayName || provider };
  }
  providerRetryPolicy() {
    return resolveRetryPolicy(void 0, "llm-provider-hub retryPolicy");
  }
  listModels(provider) {
    const gw = this.deps.gatewayFor(provider);
    if (gw === void 0) return Promise.resolve([]);
    return Promise.resolve(resolveModelEntries(gw, this.deps.preset(provider)).map((entry) => ({
      provider,
      id: entry.id,
      name: entry.name
    })));
  }
  resolveModel(provider, model, _signal) {
    const gw = this.deps.gatewayFor(provider);
    if (gw === void 0) {
      return Promise.reject(new LlmError(
        `llm-provider-hub: no gateway for provider route "${provider}"; add it in the plugin settings`,
        "UNKNOWN_MODEL"
      ));
    }
    const entry = catalogEntryFor(gw, model, this.deps.preset(provider));
    if (entry === void 0) {
      return Promise.reject(new LlmError(
        `llm-provider-hub: model "${model}" is not enabled on gateway "${provider}"; enable it in the provider-hub plugin settings`,
        "UNKNOWN_MODEL"
      ));
    }
    const info = {
      provider,
      id: model,
      name: entry.name,
      context: { contextWindow: entry.contextWindow },
      defaultMaxTokens: entry.maxTokens,
      ...entry.input === void 0 ? {} : { inputModalities: [...entry.input] }
    };
    const reasoning = reasoningMetadata(entry);
    if (reasoning !== void 0) info.reasoning = reasoning;
    return Promise.resolve(info);
  }
  async prepareCall(provider, model, signal) {
    const modelInfo = await this.resolveModel(provider, model, signal);
    return {
      model: modelInfo,
      stream: (options) => this.stream(options)
    };
  }
  async *stream(options) {
    const provider = options.provider;
    const gw = provider !== void 0 ? this.deps.gatewayFor(provider) : void 0;
    if (gw === void 0) {
      yield errorFinish(`llm-provider-hub: no gateway for provider route "${provider ?? ""}"; add it in the plugin settings`);
      return;
    }
    if (gw.baseURL === void 0 || gw.baseURL.trim() === "") {
      yield errorFinish(`llm-provider-hub: baseURL is not set for gateway "${provider}"; configure it in the plugin settings`);
      return;
    }
    let apiKey;
    try {
      apiKey = await this.deps.resolveApiKey(gw);
    } catch (error) {
      yield errorFinish(error instanceof Error ? error.message : String(error));
      return;
    }
    const headers = {
      "user-agent": gw.userAgent,
      ...gw.extraHeaders
    };
    const baseURL = gw.baseURL.replace(/\/+$/, "");
    if (gw.api === "openai-completions") {
      yield* this.streamOpenAI(options, gw, baseURL, headers, apiKey);
      return;
    }
    yield* this.streamAnthropic(options, gw, baseURL, headers, apiKey);
  }
  static ANTHROPIC_THINKING_BUDGET = {
    low: 1024,
    medium: 4096,
    high: 8192,
    xhigh: 16384,
    max: 24576
  };
  anthropicThinkingFor(effort) {
    if (effort === "off") return void 0;
    const budget = _GatewayAdapter.ANTHROPIC_THINKING_BUDGET[effort] ?? 4096;
    return { type: "enabled", budget_tokens: budget };
  }
  async *streamAnthropic(options, gw, baseURL, headers, apiKey) {
    const effort = options.reasoningEffort;
    const thinking = gw.anthropicThinking && effort !== void 0 && effort !== "off" ? this.anthropicThinkingFor(effort) : void 0;
    let maxTokens = options.maxTokens ?? 4096;
    if (thinking !== void 0 && maxTokens <= thinking.budget_tokens) {
      maxTokens = thinking.budget_tokens + 1024;
    }
    const body = {
      model: options.model,
      max_tokens: maxTokens,
      ...options.temperature === void 0 ? {} : { temperature: options.temperature },
      ...thinking === void 0 ? {} : { thinking },
      messages: toAnthropicMessages(options.messages),
      ...options.system === void 0 ? {} : { system: options.system },
      ...options.tools !== void 0 && options.tools.length > 0 ? { tools: toAnthropicTools(options.tools) } : {},
      stream: true
    };
    const posted = await this.post(`${baseURL}/v1/messages`, {
      ...headers,
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    }, body, options.signal);
    if (!posted.ok) {
      yield errorFinish(posted.message);
      return;
    }
    yield* anthropicSseToChunks(posted.response, options.signal);
  }
  async *streamOpenAI(options, gw, baseURL, headers, apiKey) {
    const reasoningEffort = options.reasoningEffort;
    const converted = toOpenAIMessages(options.messages);
    const system = options.system;
    const body = {
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      ...options.temperature === void 0 ? {} : { temperature: options.temperature },
      ...reasoningEffort !== void 0 && reasoningEffort !== "off" ? { reasoning_effort: reasoningEffort } : {},
      messages: system === void 0 ? converted : [{ role: gw.systemRole, content: system }, ...converted],
      ...options.tools !== void 0 && options.tools.length > 0 ? { tools: toOpenAITools(options.tools) } : {},
      stream: true
    };
    const posted = await this.post(`${baseURL}/v1/chat/completions`, {
      ...headers,
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    }, body, options.signal);
    if (!posted.ok) {
      yield errorFinish(posted.message);
      return;
    }
    yield* openaiCompletionsToChunks(posted.response, options.signal);
  }
  /**
   * POST one JSON body to the upstream. Transport failures surface as an
   * error finish chunk; HTTP errors surface as an error finish chunk with
   * the upstream status/message.
   */
  async post(url, headers, body, signal) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        ...signal === void 0 ? {} : { signal }
      });
    } catch (error) {
      return { ok: false, message: `fetch failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, message: `upstream ${response.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, response };
  }
};

// src/discovery.ts
import { LlmError as LlmError2 } from "@deepseek-ai/dsh-llm";
function listingUrl(baseURL) {
  return `${baseURL.replace(/\/+$/, "")}/models`;
}
function label(...candidates) {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return void 0;
}
function capacity(...candidates) {
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return void 0;
}
async function discoverModels(request, gw, resolveApiKey) {
  const baseURL = request.baseURL ?? gw.baseURL;
  if (baseURL === void 0 || baseURL.length === 0) {
    throw new LlmError2("llm-provider-hub: model discovery needs a baseURL; set it in the plugin settings", "DISCOVERY_FAILED");
  }
  const url = listingUrl(baseURL);
  let supplied;
  try {
    supplied = request.apiKey ?? await resolveApiKey();
  } catch {
    supplied = void 0;
  }
  const headers = {
    accept: "application/json",
    "user-agent": gw.userAgent
  };
  if (supplied !== void 0) headers.authorization = `Bearer ${supplied}`;
  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
      ...request.signal === void 0 ? {} : { signal: request.signal }
    });
  } catch (error) {
    if (request.signal?.aborted) throw new LlmError2("model discovery aborted by caller", "ABORTED", { cause: error });
    throw new LlmError2(`could not reach ${url}`, "DISCOVERY_FAILED", { cause: error });
  }
  if (!response.ok) {
    throw new LlmError2(
      `${url} answered ${response.status}${response.status === 401 || response.status === 403 ? "; check the API key" : ""}`,
      "DISCOVERY_FAILED"
    );
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new LlmError2(`${url} did not answer with JSON`, "DISCOVERY_FAILED", { cause: error });
  }
  const data = body?.data;
  if (!Array.isArray(data)) {
    throw new LlmError2(`the endpoint's model listing has no "data" array; add models by hand in the plugin settings`, "DISCOVERY_FAILED");
  }
  const models = [];
  for (const raw of data) {
    const entry = raw;
    const id = label(entry.id);
    if (id === void 0) continue;
    models.push({
      id,
      ...label(entry.name, entry.display_name) === void 0 ? {} : { name: label(entry.name, entry.display_name) },
      ...capacity(entry.context_window, entry.context_length) === void 0 ? {} : { contextWindow: capacity(entry.context_window, entry.context_length) },
      ...capacity(entry.max_output_tokens, entry.max_tokens) === void 0 ? {} : { maxTokens: capacity(entry.max_output_tokens, entry.max_tokens) }
    });
  }
  return models;
}

// src/host/runtime.ts
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
function ok(value) {
  return { ok: true, ...value };
}
function fail(error) {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}
var ProviderHubRuntime = class extends TypertRemoteService {
  hostCtx;
  deps;
  constructor(ctx, deps) {
    super(ctx, "providerHub");
    this.hostCtx = ctx;
    this.deps = deps;
  }
  settings() {
    return this.hostCtx.get("settings");
  }
  llm() {
    return this.hostCtx.get("llm");
  }
  /** Gateway at index, or undefined. */
  gatewayAt(index) {
    return this.deps.current().gateways[index];
  }
  /** Path prefix for gateway-scoped settings ops. */
  path(index, ...rest) {
    return ["gateways", String(index), ...rest];
  }
  /** Full state for the settings page: gateways + per-gateway resolved models + shared catalog. */
  async getState() {
    try {
      const config = this.deps.current();
      return ok({
        config,
        gateways: config.gateways.map((gw, index) => ({
          index,
          gateway: gw,
          models: resolveModelEntries(gw),
          preset: gw.presetFrom
        })),
        catalog: MODEL_CATALOG
      });
    } catch (error) {
      return fail(error);
    }
  }
  /** Append a new gateway with defaults; returns its index. */
  async addGateway() {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      if (st.writable === false) return fail("settings are read-only");
      const config = this.deps.current();
      const used = new Set(config.gateways.map((gw2) => gw2.provider));
      let base = "hub-gateway";
      let provider = base;
      for (let i = 1; used.has(provider); i++) provider = `${base}-${i}`;
      const gw = {
        provider,
        displayName: provider,
        baseURL: "",
        api: "anthropic-messages",
        userAgent: "claude-cli/2.0.1 (external, cli)",
        apiKeyEnv: "GATEWAY_API_KEY",
        apiKey: "",
        extraHeaders: {},
        systemRole: "system",
        anthropicThinking: false,
        enabledModels: ["glm-5.3"],
        modelOverrides: {},
        customModels: []
      };
      const ops = [{ op: "set", path: ["gateways"], value: [...config.gateways, gw] }];
      const index = config.gateways.length;
      await st.mutate("llm-provider-hub", ops);
      return ok({ index, gateway: gw });
    } catch (error) {
      return fail(error);
    }
  }
  /** Remove one gateway by index. */
  async deleteGateway(index) {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      if (st.writable === false) return fail("settings are read-only");
      const config = this.deps.current();
      if (index < 0 || index >= config.gateways.length) return fail("gateway index out of range");
      const next = config.gateways.filter((_, i) => i !== index);
      await st.mutate("llm-provider-hub", [{ op: "set", path: ["gateways"], value: next }]);
      return ok({ removed: index, gateways: next.length });
    } catch (error) {
      return fail(error);
    }
  }
  /** Write one or more fields of one gateway through the settings service. */
  async saveConfig(index, patch) {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      if (st.writable === false) return fail("settings are read-only");
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const ops = Object.entries(patch).map(([key, value]) => ({ op: "set", path: this.path(index, key), value }));
      await st.mutate("llm-provider-hub", ops);
      return ok({ config: this.deps.current() });
    } catch (error) {
      return fail(error);
    }
  }
  /** Enable/disable a built-in catalog model id on one gateway. Auto-snapshots before a toggle-off that would clear the last enabled model. */
  async toggleBuiltin(index, id, enabled) {
    try {
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const set = new Set(gw.enabledModels ?? []);
      if (enabled) set.add(id);
      else {
        if (set.size === 1 && set.has(id)) {
          const existingSnapshot = gw.catalogSnapshot;
          if (existingSnapshot === void 0 || existingSnapshot.enabledModels.length === 0) {
            const st = this.settings();
            if (st !== void 0) {
              await st.mutate("llm-provider-hub", [{
                op: "set",
                path: this.path(index, "catalogSnapshot"),
                value: {
                  enabledModels: [...gw.enabledModels ?? []],
                  customModels: [...gw.customModels ?? []]
                }
              }]);
            }
          }
        }
        set.delete(id);
      }
      return this.saveConfig(index, { enabledModels: [...set] });
    } catch (error) {
      return fail(error);
    }
  }
  /** Replace the modelOverrides map of one gateway wholesale. */
  async saveOverrides(index, overrides) {
    try {
      return this.saveConfig(index, { modelOverrides: overrides });
    } catch (error) {
      return fail(error);
    }
  }
  /** Insert or update one custom model entry on one gateway. */
  async upsertCustom(index, entry, originalId) {
    try {
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const custom = gw.customModels ?? [];
      const id = typeof entry.id === "string" && entry.id.trim() !== "" ? entry.id.trim() : void 0;
      if (id === void 0) return fail("custom model needs a non-empty id");
      const prevId = originalId !== null && typeof originalId.id === "string" ? originalId.id : id;
      const idx = custom.findIndex((item) => item.id === prevId);
      if (idx >= 0) custom[idx] = { ...custom[idx], ...entry, id };
      else custom.push({ ...entry, id });
      return this.saveConfig(index, { customModels: custom });
    } catch (error) {
      return fail(error);
    }
  }
  /** Delete one custom model entry from one gateway. */
  async deleteCustom(index, id) {
    try {
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const custom = (gw.customModels ?? []).filter((item) => item.id !== id);
      return this.saveConfig(index, { customModels: custom });
    } catch (error) {
      return fail(error);
    }
  }
  /** Set or clear the presetFrom import on one gateway. */
  async setPresetFrom(index, preset) {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const ops = preset === null ? [{ op: "unset", path: this.path(index, "presetFrom") }] : [{ op: "set", path: this.path(index, "presetFrom"), value: preset }];
      await st.mutate("llm-provider-hub", ops);
      return ok({});
    } catch (error) {
      return fail(error);
    }
  }
  /** Registered provider routes the user can import presets from. */
  async listPresets() {
    try {
      const llm = this.llm();
      if (llm === void 0) return fail("llm service unavailable");
      const registered = new Map(llm.listProviders().map((p) => [p.id, p.name]));
      const dir = llm.listConfigurableProviders();
      const seen = /* @__PURE__ */ new Set();
      const providers = [];
      for (const entry of dir) {
        if (seen.has(entry.provider)) continue;
        seen.add(entry.provider);
        providers.push({ provider: entry.provider, displayName: entry.displayName });
      }
      for (const [id, name2] of registered) {
        if (seen.has(id)) continue;
        seen.add(id);
        providers.push({ provider: id, displayName: name2 });
      }
      return ok({ providers });
    } catch (error) {
      return fail(error);
    }
  }
  /** Models one preset provider currently advertises. */
  async presetModels(provider) {
    try {
      const llm = this.llm();
      if (llm === void 0) return fail("llm service unavailable");
      const models = await llm.listModels(provider);
      return ok({ models: [...models] });
    } catch (error) {
      return fail(error);
    }
  }
  /** One preset model's full capability metadata. */
  async presetModelInfo(provider, model) {
    try {
      const llm = this.llm();
      if (llm === void 0) return fail("llm service unavailable");
      const info = await llm.resolveModelInfo(provider, model);
      return ok({ info });
    } catch (error) {
      return fail(error);
    }
  }
  /** Discover models from one gateway (custom UA applied). */
  async discover(index) {
    try {
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const models = await discoverModels({}, gw, () => this.deps.resolveApiKey(gw));
      return ok({ models });
    } catch (error) {
      return fail(error);
    }
  }
  /** Snapshot current catalog state (enabledModels + customModels) of one gateway. */
  async snapshotCatalog(index) {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const snapshot = {
        enabledModels: [...gw.enabledModels ?? []],
        customModels: [...gw.customModels ?? []]
      };
      await st.mutate("llm-provider-hub", [{ op: "set", path: this.path(index, "catalogSnapshot"), value: snapshot }]);
      return ok({ snapshot });
    } catch (error) {
      return fail(error);
    }
  }
  /** Restore the last catalog snapshot (if any) of one gateway. */
  async restoreCatalog(index) {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const snapshot = gw.catalogSnapshot;
      if (snapshot === void 0 || snapshot.enabledModels.length === 0 && snapshot.customModels.length === 0) {
        return fail("no catalog snapshot to restore");
      }
      await st.mutate("llm-provider-hub", [
        { op: "set", path: this.path(index, "enabledModels"), value: snapshot.enabledModels },
        { op: "set", path: this.path(index, "customModels"), value: snapshot.customModels }
      ]);
      return ok({ restored: snapshot });
    } catch (error) {
      return fail(error);
    }
  }
  /**
   * Enable one discovered model on one gateway directly: if the id hits the
   * built-in catalog, enable it in `enabledModels`; otherwise insert it as a
   * custom model. Takes a snapshot before the first enable of a session so
   * bulk enables can be rolled back when they clear the catalog.
   */
  async enableDiscovered(index, model) {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const id = typeof model.id === "string" ? model.id.trim() : "";
      if (id === "") return fail("discovered model needs a non-empty id");
      const existingSnapshot = gw.catalogSnapshot;
      const shouldSnapshot = existingSnapshot === void 0 || existingSnapshot.enabledModels.length === 0 && existingSnapshot.customModels.length === 0;
      if (shouldSnapshot) {
        await st.mutate("llm-provider-hub", [{
          op: "set",
          path: this.path(index, "catalogSnapshot"),
          value: {
            enabledModels: [...gw.enabledModels ?? []],
            customModels: [...gw.customModels ?? []]
          }
        }]);
      }
      if (MODEL_CATALOG[id] !== void 0) {
        const set = new Set(gw.enabledModels ?? []);
        set.add(id);
        const ops = [{ op: "set", path: this.path(index, "enabledModels"), value: [...set] }];
        const discoveredCtx = typeof model.contextWindow === "number" && Number.isFinite(model.contextWindow) ? model.contextWindow : void 0;
        const discoveredMax = typeof model.maxTokens === "number" && Number.isFinite(model.maxTokens) ? model.maxTokens : void 0;
        if (discoveredCtx !== void 0 || discoveredMax !== void 0) {
          const overrides = { ...gw.modelOverrides ?? {} };
          const cur = overrides[id] ?? {};
          const next = { ...cur };
          if (discoveredCtx !== void 0) next.contextWindow = discoveredCtx;
          if (discoveredMax !== void 0) next.maxTokens = discoveredMax;
          overrides[id] = next;
          ops.push({ op: "set", path: this.path(index, "modelOverrides"), value: overrides });
        }
        await st.mutate("llm-provider-hub", ops);
        return ok({ enabled: id, kind: "builtin" });
      }
      const custom = [...gw.customModels ?? []];
      if (custom.some((item) => item.id === id)) return ok({ enabled: id, kind: "custom-existing" });
      const entry = {
        id,
        name: typeof model.name === "string" && model.name.trim() !== "" ? model.name : id,
        contextWindow: typeof model.contextWindow === "number" && Number.isFinite(model.contextWindow) ? model.contextWindow : 128e3,
        maxTokens: typeof model.maxTokens === "number" && Number.isFinite(model.maxTokens) ? model.maxTokens : 8192
      };
      custom.push(entry);
      await st.mutate("llm-provider-hub", [{ op: "set", path: this.path(index, "customModels"), value: custom }]);
      return ok({ enabled: id, kind: "custom" });
    } catch (error) {
      return fail(error);
    }
  }
};

// src/host/contract.ts
var schema = (parse) => ({ parse });
var stringSchema = schema((v) => {
  if (typeof v !== "string") throw new TypeError("expected a string");
  return v;
});
var booleanSchema = schema((v) => {
  if (typeof v !== "boolean") throw new TypeError("expected a boolean");
  return v;
});
var numberSchema = schema((v) => {
  if (typeof v !== "number" || !Number.isInteger(v)) throw new TypeError("expected an integer");
  return v;
});
var objectSchema = schema((v) => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new TypeError("expected an object");
  return v;
});
var nullishObjectSchema = schema((v) => {
  if (v !== null && (typeof v !== "object" || Array.isArray(v))) throw new TypeError("expected an object or null");
  return v;
});
var resultEnvelopeSchema = schema((v) => {
  if (v === null || typeof v !== "object" || typeof v.ok !== "boolean") {
    throw new TypeError("expected an { ok, ... } envelope");
  }
  return v;
});
var codec = (name2, sch) => ({
  mode: "strict",
  typeSymbol: `dsh-provider-hub#${name2}`,
  schema: sch
});
var stringParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("String", stringSchema)
});
var booleanParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("Boolean", booleanSchema)
});
var numberParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("Number", numberSchema)
});
var objectParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("Object", objectSchema)
});
var nullishObjectParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("ObjectOrNull", nullishObjectSchema)
});
var invocation = (id, method, parameters) => ({
  id: `dsh-provider-hub#providerHub/${id}`,
  service: "providerHub",
  namespace: "providerHub",
  method,
  invocation: { kind: "direct" },
  parameters,
  result: { mode: "strict", typeSymbol: `dsh-provider-hub#${id}Result`, schema: resultEnvelopeSchema }
});
var INVOCATIONS = [
  invocation("getState", "getState", []),
  invocation("addGateway", "addGateway", []),
  invocation("deleteGateway", "deleteGateway", [numberParam("index")]),
  invocation("saveConfig", "saveConfig", [numberParam("index"), objectParam("patch")]),
  invocation("toggleBuiltin", "toggleBuiltin", [numberParam("index"), stringParam("id"), booleanParam("enabled")]),
  invocation("saveOverrides", "saveOverrides", [numberParam("index"), objectParam("overrides")]),
  invocation("upsertCustom", "upsertCustom", [numberParam("index"), objectParam("entry"), nullishObjectParam("originalId")]),
  invocation("deleteCustom", "deleteCustom", [numberParam("index"), stringParam("id")]),
  invocation("setPresetFrom", "setPresetFrom", [numberParam("index"), nullishObjectParam("preset")]),
  invocation("listPresets", "listPresets", []),
  invocation("presetModels", "presetModels", [stringParam("provider")]),
  invocation("presetModelInfo", "presetModelInfo", [stringParam("provider"), stringParam("model")]),
  invocation("discover", "discover", [numberParam("index")]),
  invocation("enableDiscovered", "enableDiscovered", [numberParam("index"), objectParam("model")]),
  invocation("snapshotCatalog", "snapshotCatalog", [numberParam("index")]),
  invocation("restoreCatalog", "restoreCatalog", [numberParam("index")])
];
var TYPERT_MANIFEST = {
  package: "dsh-provider-hub",
  face: "host",
  schemas: [],
  model: {
    services: [
      {
        key: "providerHub",
        exportName: "ProviderHubRuntime",
        description: "Manage the provider-hub gateways and their model catalogs: read/write the llm-provider-hub settings section, add/remove gateways, toggle built-in catalog models, edit overrides and custom models, import presets, and discover models from each gateway.",
        tags: [],
        members: [
          { kind: "method", name: "getState", signature: "getState(): Promise<object>" },
          { kind: "method", name: "addGateway", signature: "addGateway(): Promise<object>" },
          { kind: "method", name: "deleteGateway", signature: "deleteGateway(index: number): Promise<object>" },
          { kind: "method", name: "saveConfig", signature: "saveConfig(index: number, patch: object): Promise<object>" },
          { kind: "method", name: "toggleBuiltin", signature: "toggleBuiltin(index: number, id: string, enabled: boolean): Promise<object>" },
          { kind: "method", name: "saveOverrides", signature: "saveOverrides(index: number, overrides: object): Promise<object>" },
          { kind: "method", name: "upsertCustom", signature: "upsertCustom(index: number, entry: object, originalId: object | null): Promise<object>" },
          { kind: "method", name: "deleteCustom", signature: "deleteCustom(index: number, id: string): Promise<object>" },
          { kind: "method", name: "setPresetFrom", signature: "setPresetFrom(index: number, preset: object | null): Promise<object>" },
          { kind: "method", name: "listPresets", signature: "listPresets(): Promise<object>" },
          { kind: "method", name: "presetModels", signature: "presetModels(provider: string): Promise<object>" },
          { kind: "method", name: "presetModelInfo", signature: "presetModelInfo(provider: string, model: string): Promise<object>" },
          { kind: "method", name: "discover", signature: "discover(index: number): Promise<object>" },
          { kind: "method", name: "enableDiscovered", signature: "enableDiscovered(index: number, model: object): Promise<object>" },
          { kind: "method", name: "snapshotCatalog", signature: "snapshotCatalog(index: number): Promise<object>" },
          { kind: "method", name: "restoreCatalog", signature: "restoreCatalog(index: number): Promise<object>" }
        ],
        types: []
      }
    ],
    events: [],
    objects: []
  },
  invocations: INVOCATIONS
};

// src/index.ts
var name = "provider-hub";
var inject = ["llm"];
var NS = settingsNamespace("llm-provider-hub");
var DEFAULT_API_KEY_ENV = "GATEWAY_API_KEY";
var DEFAULT_DISPLAY_NAME = "Gateway";
var GatewaySchema = z.object({
  /** Provider route this gateway registers (unique across gateways; change requires restart). */
  provider: z.string(),
  /** Display name in model pickers. */
  displayName: z.string().default(DEFAULT_DISPLAY_NAME),
  /** Upstream base URL (required; the request path is appended automatically). */
  baseURL: z.string(),
  /** Wire protocol. */
  api: z.union(["anthropic-messages", "openai-completions"]).default("anthropic-messages"),
  /** User-Agent sent on the wire (gateway whitelist). */
  userAgent: z.string().default("claude-cli/2.0.1 (external, cli)"),
  /** Credential-ref env var name; resolved through the credentials service or launch environment. */
  apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
  /** Literal key, optional; takes precedence over apiKeyEnv. */
  apiKey: z.string(),
  /** Extra headers merged into every request. */
  extraHeaders: z.dict(z.string()).default({}),
  /** Role used for the system prompt on the openai-completions path ('developer' fixes strict GPT-lineage gateways). */
  systemRole: z.union(["system", "developer"]).default("system"),
  /** When true, the anthropic-messages path forwards reasoningEffort as Anthropic `thinking` (budget_tokens by effort). */
  anthropicThinking: z.boolean().default(false),
  /** Field-level parameter overrides for built-in catalog models (id -> partial entry). */
  modelOverrides: z.dict(z.object({
    name: z.string(),
    contextWindow: z.number().step(1).min(1),
    maxTokens: z.number().step(1).min(1),
    input: z.array(z.union(["text", "image", "audio"])),
    reasoningEfforts: z.dict(z.union([z.string(), z.const(null)]))
  })).default({}),
  /** Built-in catalog model ids to enable in the picker. */
  enabledModels: z.array(z.string()).default(["glm-5.3"]),
  /** Fully-specified custom models (Cherry-Studio style manual entries). */
  customModels: z.array(z.object({
    id: z.string(),
    name: z.string(),
    contextWindow: z.number().step(1).min(1),
    maxTokens: z.number().step(1).min(1),
    input: z.array(z.union(["text", "image", "audio"])).default(["text"]),
    reasoningEfforts: z.dict(z.union([z.string(), z.const(null)]))
  })).default([]),
  /** Import one model's capability parameters from another registered provider route. */
  presetFrom: z.object({
    provider: z.string(),
    model: z.string()
  }),
  /** Snapshot of catalog state before the last bulk enable (for rollback). */
  catalogSnapshot: z.object({
    enabledModels: z.array(z.string()).default([]),
    customModels: z.array(z.object({
      id: z.string(),
      name: z.string(),
      contextWindow: z.number().step(1).min(1),
      maxTokens: z.number().step(1).min(1),
      input: z.array(z.union(["text", "image", "audio"])).default(["text"]),
      reasoningEfforts: z.dict(z.union([z.string(), z.const(null)]))
    })).default([])
  })
});
var Config = z.object({
  gateways: z.array(GatewaySchema).default([])
});
function apply(ctx, config) {
  let current = () => config;
  const gatewayFor = (provider) => current().gateways.find((gw) => gw.provider === provider);
  const presetEntries = /* @__PURE__ */ new Map();
  const loadPreset = async () => {
    const next = /* @__PURE__ */ new Map();
    for (const gw of current().gateways) {
      const preset = gw.presetFrom;
      if (preset === void 0) continue;
      try {
        const info = await ctx.llm.resolveModelInfo(preset.provider, preset.model);
        next.set(gw.provider, {
          id: preset.model,
          name: info.name ?? preset.model,
          contextWindow: info.context?.contextWindow ?? 128e3,
          maxTokens: info.defaultMaxTokens ?? 8192,
          ...info.inputModalities === void 0 ? {} : { input: [...info.inputModalities] },
          ...info.reasoning === void 0 ? {} : { reasoning: Object.fromEntries(info.reasoning.efforts.map((effort) => [effort.id, effort.id])) }
        });
      } catch {
      }
    }
    presetEntries.clear();
    for (const [provider, entry] of next) presetEntries.set(provider, entry);
  };
  void loadPreset();
  const resolveApiKey = async (gw) => {
    if (typeof gw.apiKey === "string" && gw.apiKey.trim() !== "") {
      return assertUsableApiKey(gw.apiKey.trim(), "llm-provider-hub", "config.apiKey");
    }
    const ref = credentialRef(gw.apiKeyEnv ?? DEFAULT_API_KEY_ENV);
    const credentials = ctx.get("credentials");
    const hit = credentials !== void 0 ? (await credentials.resolve(ref))?.value : launchEnvironmentOf(ctx).get(ref)?.value;
    if (hit !== void 0 && hit.length > 0) return assertUsableApiKey(hit, "llm-provider-hub", gw.apiKeyEnv);
    throw new LlmError3(
      `llm-provider-hub: no API key for provider route "${gw.provider}"; set config.apiKey in the plugin settings, store ${gw.apiKeyEnv} in the credentials service, or export it in the launching environment`,
      "MISSING_CREDENTIAL"
    );
  };
  const adapter = new GatewayAdapter({
    current,
    gatewayFor,
    resolveApiKey,
    preset: (provider) => presetEntries.get(provider)
  });
  const providers = current().gateways.map((gw) => gw.provider);
  ctx.llm.registerConfigurableProviders(current().gateways.map((gw) => ({
    provider: gw.provider,
    displayName: gw.displayName || DEFAULT_DISPLAY_NAME,
    settingsNs: NS,
    settingsPath: []
  })));
  if (providers.length > 0) {
    ctx.llm.registerAdapter(providers, adapter);
  }
  ctx.llm.registerModelDiscovery(NS, (request) => {
    const gw = current().gateways.find((g) => {
      const base = g.baseURL?.replace(/\/+$/, "");
      const want = request.baseURL?.replace(/\/+$/, "");
      return base !== void 0 && want !== void 0 && base === want;
    }) ?? current().gateways[0];
    if (gw === void 0) {
      throw new LlmError3("llm-provider-hub: model discovery needs a gateway with a baseURL; add one in the plugin settings", "DISCOVERY_FAILED");
    }
    return discoverModels(request, gw, () => resolveApiKey(gw));
  });
  ctx.inject(["typert"], (typertCtx) => {
    new ProviderHubRuntime(typertCtx, { current, resolveApiKey, gatewayFor });
    const register = typertCtx.typert.register;
    typertCtx.effect(
      () => register(TYPERT_MANIFEST),
      "dsh-provider-hub: typert manifest"
    );
  });
  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => {
      current = source;
    },
    onChange: () => {
    }
  });
  ctx.logger.info(
    `provider-hub: registered ${current().gateways.length} gateway(s): ${current().gateways.map((gw) => `${gw.provider}(${gw.api}${gw.baseURL ? ` -> ${gw.baseURL}` : ""})`).join(", ")}`
  );
}
export {
  Config,
  DEFAULT_API_KEY_ENV,
  DEFAULT_DISPLAY_NAME,
  GatewayAdapter,
  MODEL_CATALOG,
  NS,
  apply,
  inject,
  name,
  resolveModelEntries
};
//# sourceMappingURL=index.js.map
