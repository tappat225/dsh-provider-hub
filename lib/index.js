// src/index.ts
import z from "@deepseek-ai/schemastery";
import { LlmError as LlmError3, assertUsableApiKey as assertUsableApiKey2 } from "@deepseek-ai/dsh-llm";
import { credentialRef as credentialRef2 } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";

// src/adapter.ts
import {
  LlmAdapter,
  LlmError,
  resolveRetryPolicy
} from "@deepseek-ai/dsh-llm";

// src/catalog.ts
import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
function positiveInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
function gatewayModelDefaults(gw) {
  return {
    ...positiveInt(gw.defaultContextWindow) ? { contextWindow: gw.defaultContextWindow } : {},
    ...positiveInt(gw.defaultMaxTokens) ? { maxTokens: gw.defaultMaxTokens } : {},
    ...Array.isArray(gw.defaultInput) && gw.defaultInput.length > 0 ? { input: [...gw.defaultInput] } : {}
  };
}
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
    input: ["text"]
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
    input: ["text", "image"]
  },
  "gpt-4o-mini": {
    name: "GPT-4o mini",
    contextWindow: 128e3,
    maxTokens: 16384,
    input: ["text", "image"]
  }
};
function isUnset(value) {
  if (value === void 0 || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return value === "";
}
function assertValidReasoningMap(gateway, model, map) {
  const levels = Object.keys(map);
  if (levels.length === 0) return;
  for (const level of levels) {
    const wire = map[level];
    if (wire === null) {
      if (level !== "off") {
        throw new Error(`llm-provider-hub: gateway "${gateway}" model "${model}" reasoningEfforts.${level} needs the wire value dispatch should send; only "off" may leave it empty (remove the key to not offer the level)`);
      }
    } else if (wire.length === 0) {
      throw new Error(`llm-provider-hub: gateway "${gateway}" model "${model}" reasoningEfforts.${level} must not be an empty string`);
    }
  }
  if (!levels.some((level) => level !== "off")) {
    throw new Error(`llm-provider-hub: gateway "${gateway}" model "${model}" reasoningEfforts offers no level beyond "off"; declare a thinking level, or remove the field for a non-reasoning model`);
  }
}
function resolveModelEntries(gw) {
  const out = [];
  const overrides = gw.modelOverrides ?? {};
  for (const id of gw.enabledModels ?? []) {
    const entry = MODEL_CATALOG[id];
    if (entry === void 0) continue;
    const ov = overrides[id];
    const applied = ov === void 0 || isUnset(ov) ? void 0 : {
      ...isUnset(ov.name) ? {} : { name: ov.name },
      ...isUnset(ov.contextWindow) ? {} : { contextWindow: ov.contextWindow },
      ...isUnset(ov.maxTokens) ? {} : { maxTokens: ov.maxTokens },
      ...isUnset(ov.input) ? {} : { input: [...ov.input] },
      ...isUnset(ov.reasoningEfforts) ? {} : { reasoning: ov.reasoningEfforts }
    };
    out.push({
      id,
      name: entry.name,
      contextWindow: entry.contextWindow,
      maxTokens: entry.maxTokens,
      input: [...entry.input],
      reasoning: entry.reasoning,
      ...applied ?? {},
      source: applied === void 0 ? "catalog" : "override",
      ...applied?.maxTokens !== void 0 ? { maxTokensExplicit: true } : {}
    });
  }
  const defaults = gatewayModelDefaults(gw);
  for (const custom of gw.customModels ?? []) {
    const explicitCtx = positiveInt(custom.contextWindow);
    const explicitMax = positiveInt(custom.maxTokens);
    const contextWindow = explicitCtx ? custom.contextWindow : defaults.contextWindow;
    const maxTokens = explicitMax ? custom.maxTokens : defaults.maxTokens;
    out.push({
      id: custom.id,
      name: custom.name || custom.id,
      contextWindow,
      maxTokens,
      input: Array.isArray(custom.input) && custom.input.length > 0 ? [...custom.input] : defaults.input ?? ["text"],
      reasoning: custom.reasoningEfforts,
      source: explicitCtx && explicitMax ? "custom" : "gateway-default",
      ...explicitMax ? { maxTokensExplicit: true } : {}
    });
  }
  for (const entry of out) {
    if (entry.reasoning !== void 0) assertValidReasoningMap(gw.provider, entry.id, entry.reasoning);
  }
  return out;
}
function catalogEntryFor(gw, model) {
  return resolveModelEntries(gw).find((entry) => entry.id === model);
}
function reasoningMetadata(entry) {
  const map = entry.reasoning;
  if (map === void 0 || Object.keys(map).length === 0) return void 0;
  const efforts = Object.keys(map).map((id) => ({ id: ReasoningEffortId(id), name: id.charAt(0).toUpperCase() + id.slice(1) }));
  return { efforts, defaultEffort: efforts[0]?.id === "off" ? void 0 : efforts[0]?.id };
}

// src/types.ts
var DEFAULT_USER_AGENT = "claude-cli/2.0.1 (external, cli)";
function effectiveUserAgent(userAgent) {
  const value = (userAgent ?? "").trim();
  return value === "" ? DEFAULT_USER_AGENT : value;
}

// src/url.ts
function joinEndpoint(baseURL, path) {
  const base = baseURL.trim().replace(/\/+$/, "");
  const rooted = /\/v\d+$/.test(base);
  return `${base}${rooted ? "" : "/v1"}${path}`;
}
function effectiveEndpointMode(endpointMode) {
  return endpointMode === "custom" ? "custom" : "auto";
}
function validateEndpointUrl(raw) {
  if (/[\r\n\t\x00-\x1f\u007f]/.test(raw)) return "must not contain control characters or line breaks";
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return "is not a valid URL";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "must use http or https";
  return void 0;
}
function resolveEndpointUrl(inputs, path) {
  const mode = effectiveEndpointMode(inputs.endpointMode);
  if (mode === "custom") {
    const source = path === "/models" ? "baseURL (the complete model-listing URL)" : "endpoint (the complete request URL)";
    const raw = path === "/models" ? inputs.baseURL ?? "" : inputs.endpoint ?? "";
    const url2 = raw.trim();
    if (url2 === "") {
      return { ok: false, error: `endpointMode "custom" requires ${source} to be set; no path or /v1 is appended automatically` };
    }
    const invalid2 = validateEndpointUrl(url2);
    if (invalid2 !== void 0) return { ok: false, error: `${source} "${redactUrl(url2)}" ${invalid2}` };
    return { ok: true, url: url2 };
  }
  const base = (inputs.baseURL ?? "").trim();
  if (base === "") {
    return { ok: false, error: 'baseURL is required (endpointMode "auto" derives every request path from it)' };
  }
  const url = joinEndpoint(base, path);
  const invalid = validateEndpointUrl(url);
  if (invalid !== void 0) return { ok: false, error: `baseURL "${redactUrl(url)}" ${invalid}` };
  return { ok: true, url };
}
function redactUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.username === "" && parsed.password === "") return url;
    if (parsed.username !== "") parsed.username = "***";
    if (parsed.password !== "") parsed.password = "***";
    return parsed.toString();
  } catch {
    return url;
  }
}

// src/wire/sse.ts
async function* iterateSse(response, signal) {
  void signal;
  const reader = response.body?.getReader();
  if (reader === void 0) return;
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data = [];
  const closed = [];
  const ingest = (line) => {
    if (line === "") {
      if (data.length > 0) closed.push({ event, data: data.join("\n") });
      event = "message";
      data = [];
      return;
    }
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") {
      if (value !== "") event = value;
    } else if (field === "data") {
      data.push(value);
    }
  };
  const nextLine = (atEof) => {
    const nl = buffer.indexOf("\n");
    const cr = buffer.indexOf("\r");
    if (nl === -1 && cr === -1) return void 0;
    if (cr !== -1 && (nl === -1 || cr < nl)) {
      if (cr === buffer.length - 1 && !atEof) return void 0;
      const line2 = buffer.slice(0, cr);
      buffer = buffer.startsWith("\n", cr + 1) ? buffer.slice(cr + 2) : buffer.slice(cr + 1);
      return line2;
    }
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    return line;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (let line = nextLine(false); line !== void 0; line = nextLine(false)) ingest(line);
      if (closed.length > 0) yield* closed.splice(0);
    }
    buffer += decoder.decode();
    for (let line = nextLine(true); line !== void 0; line = nextLine(true)) ingest(line);
    if (buffer.length > 0) ingest(buffer);
    if (data.length > 0) closed.push({ event, data: data.join("\n") });
    if (closed.length > 0) yield* closed.splice(0);
  } finally {
    reader.releaseLock();
  }
}
function errorFinish(message, code = "UPSTREAM_ERROR") {
  return {
    type: "finish",
    reason: { kind: "error", failure: { code, message } }
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
function toolResultCallId(block) {
  const structural = block;
  const id = structural.toolCallId ?? structural.callId;
  return typeof id === "string" ? id : "";
}
function toolResultText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part !== null && typeof part === "object" && part.type === "text") {
        return String(part.text ?? "");
      }
      return JSON.stringify(part);
    }).join("\n");
  }
  return JSON.stringify(content ?? "");
}
function toolArguments(arguments_) {
  return arguments_ === void 0 || arguments_.trim() === "" ? "{}" : arguments_;
}
function toOpenAIMessages(messages) {
  const wire = [];
  for (const message of messages) {
    const raw = message.content;
    const blocks = typeof raw === "string" ? [{ type: "text", text: raw }] : Array.isArray(raw) ? raw : [];
    if (message.role === "assistant") {
      const texts2 = [];
      const toolCalls = [];
      for (const block of blocks) {
        if (block.type === "text") {
          if (block.text !== "") texts2.push(block.text);
        } else if (block.type === "tool-call") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: { name: block.name, arguments: toolArguments(block.arguments) }
          });
        }
      }
      if (texts2.length > 0 || toolCalls.length > 0) {
        wire.push({
          role: "assistant",
          content: texts2.length > 0 ? texts2.join("\n") : null,
          ...toolCalls.length > 0 ? { tool_calls: toolCalls } : {}
        });
      }
      continue;
    }
    const role = message.role === "system" ? "system" : "user";
    let texts = [];
    const flushText = () => {
      if (texts.length > 0) {
        wire.push({ role, content: texts.join("\n") });
        texts = [];
      }
    };
    for (const block of blocks) {
      if (block.type === "text") {
        if (block.text !== "") texts.push(block.text);
      } else if (block.type === "tool-result") {
        flushText();
        wire.push({ role: "tool", tool_call_id: toolResultCallId(block), content: toolResultText(block.content) });
      }
    }
    flushText();
  }
  return wire;
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

// src/wire/responses.ts
function resultCallId(block) {
  const value = block;
  return typeof (value.toolCallId ?? value.callId) === "string" ? String(value.toolCallId ?? value.callId) : "";
}
function resultText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part !== null && typeof part === "object" && part.type === "text") {
        return String(part.text ?? "");
      }
      return JSON.stringify(part);
    }).join("\n");
  }
  return JSON.stringify(content ?? "");
}
function toolArguments2(arguments_) {
  return arguments_ === void 0 || arguments_.trim() === "" ? "{}" : arguments_;
}
function inlineImageDataUrl(block) {
  const candidate = block.source;
  if (typeof candidate === "string" && candidate.length > 0) {
    const mediaType = block.mediaType ?? "image/png";
    return `data:${mediaType};base64,${candidate}`;
  }
  if (candidate !== null && typeof candidate === "object") {
    const obj = candidate;
    if (obj.type === "base64" && typeof obj.data === "string" && obj.data.length > 0) {
      const mediaType = typeof obj.media_type === "string" ? obj.media_type : "image/png";
      return `data:${mediaType};base64,${obj.data}`;
    }
  }
  return void 0;
}
function blocksOf(raw) {
  return typeof raw === "string" ? [{ type: "text", text: raw }] : Array.isArray(raw) ? raw : [];
}
function toResponsesInput(messages) {
  const input = [];
  const systemParts = [];
  for (const message of messages) {
    const blocks = blocksOf(message.content);
    if (message.role === "system") {
      for (const block of blocks) {
        if (block.type === "text" && block.text !== "") systemParts.push(block.text);
      }
      continue;
    }
    const role = message.role === "assistant" ? "assistant" : "user";
    let parts = [];
    const flushParts = () => {
      if (parts.length > 0) {
        input.push({ role, content: parts });
        parts = [];
      }
    };
    for (const block of blocks) {
      if (block.type === "text") {
        if (block.text !== "") {
          parts.push(role === "assistant" ? { type: "output_text", text: block.text } : { type: "input_text", text: block.text });
        }
      } else if (block.type === "image") {
        const dataUrl = inlineImageDataUrl(block);
        if (dataUrl !== void 0) parts.push({ type: "input_image", image_url: dataUrl });
      } else if (block.type === "tool-call" && role === "assistant") {
        flushParts();
        input.push({
          type: "function_call",
          call_id: block.id,
          name: block.name,
          arguments: toolArguments2(block.arguments)
        });
      } else if (block.type === "tool-result") {
        flushParts();
        input.push({
          type: "function_call_output",
          call_id: resultCallId(block),
          output: resultText(block.content)
        });
      }
    }
    flushParts();
  }
  return { input, systemText: systemParts.join("\n") };
}
function toResponsesTools(tools) {
  return (tools ?? []).map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description ?? "",
    parameters: tool.parameters ?? { type: "object", properties: {} }
  }));
}
function toResponsesTokenUsage(usage) {
  if (usage === void 0 || usage === null || typeof usage !== "object") return void 0;
  const raw = usage;
  const input = raw.input_tokens ?? raw.prompt_tokens;
  const output = raw.output_tokens ?? raw.completion_tokens;
  const cached = raw.input_tokens_details?.cached_tokens ?? raw.prompt_tokens_details?.cached_tokens;
  const reasoning = raw.output_tokens_details?.reasoning_tokens;
  if (typeof input !== "number" && typeof output !== "number" && typeof cached !== "number") return void 0;
  const total = typeof input === "number" ? input : 0;
  const uncached = Math.max(0, total - (typeof cached === "number" ? cached : 0));
  return {
    inputTokens: uncached,
    outputTokens: typeof output === "number" ? output : 0,
    ...typeof cached === "number" && cached > 0 ? { cacheReadTokens: cached } : {},
    ...typeof reasoning === "number" && reasoning >= 0 ? { reasoningTokens: reasoning } : {}
  };
}
async function* responsesSseToChunks(response, signal) {
  let nextIndex = 0;
  let textIndex = -1;
  let reasoningIndex = -1;
  let text = "";
  let reasoning = "";
  let sawText = false;
  let sawReasoning = false;
  let sawToolCall = false;
  let terminal;
  let incompleteReason;
  let errorMessage;
  let errorCode = "UPSTREAM_ERROR";
  let usage;
  const toolPartials = /* @__PURE__ */ new Map();
  const keyByOutputIndex = /* @__PURE__ */ new Map();
  const toolKey = (payload) => {
    if (typeof payload.item_id === "string" && payload.item_id !== "") return payload.item_id;
    const outputIndex = typeof payload.output_index === "number" ? payload.output_index : void 0;
    if (outputIndex !== void 0) {
      const mapped = keyByOutputIndex.get(outputIndex);
      if (mapped !== void 0) return mapped;
      const created = `output-${String(outputIndex)}`;
      keyByOutputIndex.set(outputIndex, created);
      return created;
    }
    return `anon-${String(nextIndex)}`;
  };
  const partialFor = (key, item) => {
    let partial = toolPartials.get(key);
    if (partial === void 0) {
      partial = {
        dshIndex: nextIndex++,
        callId: item?.call_id ?? "",
        name: item?.name ?? "",
        arguments: "",
        closed: false,
        started: false
      };
      toolPartials.set(key, partial);
      sawToolCall = true;
      return partial;
    }
    return partial;
  };
  try {
    for await (const sse of iterateSse(response, signal)) {
      let payload;
      try {
        const parsed = JSON.parse(sse.data);
        payload = parsed !== null && typeof parsed === "object" ? parsed : void 0;
      } catch {
        payload = void 0;
      }
      if (payload === void 0) {
        if (sse.event === "error") {
          terminal = "failed";
          errorMessage = sse.data === "" ? void 0 : sse.data;
          break;
        }
        continue;
      }
      const type = typeof payload.type === "string" && payload.type !== "" ? payload.type : sse.event;
      switch (type) {
        case "response.created":
        case "response.in_progress":
        case "response.queued":
          break;
        case "response.output_item.added": {
          const item = payload.item ?? {};
          if (item.type === "function_call") {
            const key = typeof item.id === "string" && item.id !== "" ? item.id : toolKey(payload);
            if (typeof payload.output_index === "number") keyByOutputIndex.set(payload.output_index, key);
            const partial = partialFor(key, item);
            if (partial.callId === "" && typeof item.call_id === "string") partial.callId = item.call_id;
            if (partial.name === "" && typeof item.name === "string") partial.name = item.name;
            if (typeof item.arguments === "string" && item.arguments.length > partial.arguments.length) {
              partial.arguments = item.arguments;
            }
            if (!partial.started) {
              partial.started = true;
              yield { type: "block-start", index: partial.dshIndex, blockType: "tool-call" };
            }
            yield {
              type: "tool-call-delta",
              index: partial.dshIndex,
              id: partial.callId,
              ...partial.name === "" ? {} : { name: partial.name },
              argumentsDelta: ""
            };
          }
          break;
        }
        case "response.output_text.delta":
        case "response.refusal.delta": {
          const delta = payload.delta;
          if (typeof delta !== "string" || delta === "") break;
          if (textIndex < 0) textIndex = nextIndex++;
          sawText = true;
          text += delta;
          yield { type: "text-delta", index: textIndex, text: delta };
          break;
        }
        case "response.reasoning_text.delta":
        case "response.reasoning_summary_text.delta": {
          const delta = payload.delta;
          if (typeof delta !== "string" || delta === "") break;
          if (reasoningIndex < 0) reasoningIndex = nextIndex++;
          sawReasoning = true;
          reasoning += delta;
          yield { type: "reasoning-delta", index: reasoningIndex, text: delta };
          break;
        }
        case "response.function_call_arguments.delta": {
          const key = toolKey(payload);
          const partial = partialFor(key);
          if (partial.callId === "" && typeof payload.call_id === "string") partial.callId = payload.call_id;
          if (partial.name === "" && typeof payload.name === "string") partial.name = payload.name;
          if (!partial.started) {
            partial.started = true;
            yield { type: "block-start", index: partial.dshIndex, blockType: "tool-call" };
          }
          const delta = payload.delta;
          if (typeof delta === "string" && delta !== "") {
            partial.arguments += delta;
            yield {
              type: "tool-call-delta",
              index: partial.dshIndex,
              id: partial.callId,
              name: partial.name,
              argumentsDelta: delta
            };
          }
          break;
        }
        case "response.function_call_arguments.done": {
          const key = toolKey(payload);
          const partial = partialFor(key);
          if (typeof payload.arguments === "string" && payload.arguments.length > partial.arguments.length && !partial.closed) {
            const recovered = payload.arguments.slice(partial.arguments.length);
            partial.arguments = payload.arguments;
            yield {
              type: "tool-call-delta",
              index: partial.dshIndex,
              id: partial.callId,
              name: partial.name,
              argumentsDelta: recovered
            };
          }
          break;
        }
        case "response.output_item.done": {
          const item = payload.item ?? {};
          if (item.type === "function_call") {
            const key = typeof item.id === "string" && item.id !== "" ? item.id : toolKey(payload);
            const hasIdentity = typeof item.call_id === "string" && item.call_id !== "" || typeof item.name === "string" && item.name !== "" || typeof item.arguments === "string" && item.arguments.trim() !== "";
            if (!toolPartials.has(key) && !hasIdentity) break;
            const partial = partialFor(key, item);
            if (typeof item.call_id === "string" && item.call_id !== "") partial.callId = item.call_id;
            if (typeof item.name === "string" && item.name !== "") partial.name = item.name;
            if (typeof item.arguments === "string" && item.arguments.length > partial.arguments.length) {
              partial.arguments = item.arguments;
            }
            if (!partial.closed) {
              partial.closed = true;
              yield {
                type: "block-end",
                index: partial.dshIndex,
                block: { type: "tool-call", id: partial.callId, name: partial.name, arguments: toolArguments2(partial.arguments) }
              };
            }
          }
          break;
        }
        // Explicitly-ignored protocol events (kept listed so a typo in a new
        // handler cannot silently regress into the default case).
        case "response.output_text.done":
        case "response.refusal.done":
        case "response.reasoning_text.done":
        case "response.reasoning_summary_text.done":
        case "response.content_part.added":
        case "response.content_part.done":
        case "response.output_text.annotation.added":
        case "response.reasoning_summary_part.added":
        case "response.reasoning_summary_part.done":
          break;
        case "response.completed": {
          usage = toResponsesTokenUsage(payload.response?.usage ?? payload.usage) ?? usage;
          terminal = "completed";
          break;
        }
        case "response.incomplete": {
          usage = toResponsesTokenUsage(payload.response?.usage ?? payload.usage) ?? usage;
          terminal = "incomplete";
          incompleteReason = payload.response?.incomplete_details?.reason;
          break;
        }
        case "response.failed": {
          usage = toResponsesTokenUsage(payload.response?.usage ?? payload.usage) ?? usage;
          terminal = "failed";
          errorCode = payload.response?.error?.code ?? payload.code ?? errorCode;
          errorMessage = payload.response?.error?.message ?? payload.message ?? "the upstream reported a failed response";
          break;
        }
        case "response.error":
        case "error": {
          terminal = "failed";
          errorCode = payload.code ?? payload.error?.code ?? errorCode;
          errorMessage = payload.message ?? payload.error?.message ?? payload.response?.error?.message ?? "the upstream reported an error";
          break;
        }
        default:
          break;
      }
      if (terminal !== void 0) break;
    }
  } catch (error) {
    if (signal?.aborted) yield { type: "finish", reason: { kind: "aborted", failure: { code: "ABORTED", message: "aborted" } } };
    else yield errorFinish(error instanceof Error ? error.message : String(error));
    return;
  }
  const pending = [];
  if (sawReasoning && reasoningIndex >= 0) {
    pending.push({ type: "block-end", index: reasoningIndex, block: { type: "reasoning", text: reasoning } });
  }
  if (sawText && textIndex >= 0) {
    pending.push({ type: "block-end", index: textIndex, block: { type: "text", text } });
  }
  for (const partial of [...toolPartials.values()].sort((a, b) => a.dshIndex - b.dshIndex)) {
    if (!partial.closed) {
      pending.push({
        type: "block-end",
        index: partial.dshIndex,
        block: { type: "tool-call", id: partial.callId, name: partial.name, arguments: toolArguments2(partial.arguments) }
      });
    }
  }
  for (const chunk of pending) yield chunk;
  if (usage !== void 0) yield { type: "usage", usage };
  if (terminal === "failed") {
    yield errorFinish(errorMessage ?? "the upstream reported a failed response", errorCode);
    return;
  }
  if (terminal === "incomplete") {
    if (incompleteReason === "max_output_tokens" || incompleteReason === "max_tokens") {
      yield { type: "finish", reason: { kind: "max-tokens" } };
      return;
    }
    yield errorFinish(
      `the upstream response ended incomplete${incompleteReason ? `: ${incompleteReason}` : ""}`,
      "INCOMPLETE_RESPONSE"
    );
    return;
  }
  yield { type: "finish", reason: sawToolCall ? { kind: "tool-calls" } : { kind: "stop" } };
}

// src/adapter.ts
var RESERVED_HEADERS = /* @__PURE__ */ new Set([
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "cookie",
  "anthropic-version",
  "content-type",
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
  "host",
  "user-agent"
]);
function sanitizeExtraHeaders(extraHeaders) {
  const clean = {};
  for (const [name2, value] of Object.entries(extraHeaders ?? {})) {
    if (RESERVED_HEADERS.has(name2.toLowerCase())) continue;
    clean[name2] = value;
  }
  return clean;
}
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
    return Promise.resolve(resolveModelEntries(gw).map((entry) => ({
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
    const entry = catalogEntryFor(gw, model);
    if (entry === void 0) {
      return Promise.reject(new LlmError(
        `llm-provider-hub: model "${model}" is not enabled on gateway "${provider}"; enable it in the provider-hub plugin settings`,
        "UNKNOWN_MODEL"
      ));
    }
    const defaults = gatewayModelDefaults(gw);
    const defaultMaxTokens = entry.maxTokensExplicit === true && entry.maxTokens !== void 0 ? entry.maxTokens : defaults.maxTokens ?? 4096;
    const info = {
      provider,
      id: model,
      name: entry.name,
      // Context capacity rides along only when resolution produced one (a
      // capacity-less custom entry with no gateway default omits the field).
      ...entry.contextWindow === void 0 ? {} : { context: { contextWindow: entry.contextWindow } },
      defaultMaxTokens,
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
      if (effectiveEndpointMode(gw.endpointMode) !== "custom") {
        yield errorFinish(`llm-provider-hub: baseURL is not set for gateway "${provider}"; configure it in the plugin settings`);
        return;
      }
    } else {
      try {
        const parsed = new URL(gw.baseURL);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported scheme");
      } catch {
        yield errorFinish(`llm-provider-hub: baseURL "${redactUrl(gw.baseURL)}" for gateway "${provider}" must be a valid http(s) URL`);
        return;
      }
    }
    if (gw.api !== "openai-completions" && gw.api !== "openai-responses" && gw.api !== "anthropic-messages") {
      yield errorFinish(`llm-provider-hub: gateway "${provider}" has an unknown api protocol "${String(gw.api)}"; use "anthropic-messages", "openai-completions" or "openai-responses"`);
      return;
    }
    const userAgent = effectiveUserAgent(gw.userAgent);
    if (/[\r\n]/.test(userAgent)) {
      yield errorFinish(`llm-provider-hub: gateway "${provider}" userAgent must not contain line breaks`);
      return;
    }
    for (const [name2, value] of Object.entries(gw.extraHeaders ?? {})) {
      if (/[\r\n]/.test(name2) || /[\r\n]/.test(value)) {
        yield errorFinish(`llm-provider-hub: gateway "${provider}" extraHeaders.${name2} must not contain line breaks`);
        return;
      }
    }
    const entry = catalogEntryFor(gw, options.model);
    if (entry === void 0) {
      yield errorFinish(
        `llm-provider-hub: model "${options.model}" is not enabled on gateway "${provider}"; enable it in the provider-hub plugin settings`,
        "UNKNOWN_MODEL"
      );
      return;
    }
    const effort = options.reasoningEffort;
    let wireEffort;
    let thinkingLevel;
    if (effort !== void 0) {
      const map = entry.reasoning;
      if (map === void 0 || !Object.prototype.hasOwnProperty.call(map, effort)) {
        const offered = map === void 0 ? "none" : Object.keys(map).join(", ");
        yield errorFinish(
          `llm-provider-hub: model "${options.model}" on gateway "${provider}" does not support reasoning effort "${effort}" (offered: ${offered})`,
          "UNSUPPORTED_REASONING_EFFORT"
        );
        return;
      }
      const wire = map[effort];
      if (typeof wire === "string") wireEffort = wire;
      if (effort !== "off") thinkingLevel = effort;
    }
    let apiKey;
    try {
      apiKey = await this.deps.resolveApiKey(gw);
    } catch (error) {
      yield errorFinish(error instanceof Error ? error.message : String(error));
      return;
    }
    const headers = sanitizeExtraHeaders(gw.extraHeaders);
    headers["user-agent"] = userAgent;
    if (gw.api === "openai-completions") {
      yield* this.streamOpenAI(options, gw, headers, apiKey, wireEffort);
      return;
    }
    if (gw.api === "openai-responses") {
      yield* this.streamResponses(options, gw, headers, apiKey, wireEffort);
      return;
    }
    yield* this.streamAnthropic(options, gw, headers, apiKey, thinkingLevel);
  }
  /** Anthropic's built-in thinking budget table, matching pi-ai defaults. */
  static ANTHROPIC_THINKING_BUDGET = {
    minimal: 512,
    low: 1024,
    medium: 4096,
    high: 8192,
    xhigh: 16384,
    max: 24576
  };
  /**
   * Per-request output cap when the caller (DSH) sends none: the gateway's
   * `defaultMaxTokens`, else the historical 4096 floor. Applied on all three
   * wire paths so every protocol still carries a reasonable max token.
   */
  requestMaxTokens(gw) {
    return gatewayModelDefaults(gw).maxTokens ?? 4096;
  }
  /** One endpoint resolution surfaced as an error finish (message already redacted by the resolver). */
  endpointOrFinish(provider, gw, path) {
    const resolved = resolveEndpointUrl(gw, path);
    if (resolved.ok) return { url: resolved.url };
    return { fail: errorFinish(`llm-provider-hub: gateway "${provider ?? ""}": ${resolved.error}`) };
  }
  async *streamAnthropic(options, gw, headers, apiKey, thinkingLevel) {
    const budgets = _GatewayAdapter.ANTHROPIC_THINKING_BUDGET;
    let thinking;
    if (thinkingLevel !== void 0) {
      const budget = budgets[thinkingLevel];
      if (budget === void 0) {
        yield errorFinish(
          `llm-provider-hub: model "${options.model}" declares effort "${thinkingLevel}", but Anthropic thinking has no built-in budget for it`,
          "UNSUPPORTED_REASONING_EFFORT"
        );
        return;
      }
      thinking = { type: "enabled", budget_tokens: budget };
    }
    let maxTokens = options.maxTokens ?? this.requestMaxTokens(gw);
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
    const endpoint = this.endpointOrFinish(options.provider, gw, "/messages");
    if ("fail" in endpoint) {
      yield endpoint.fail;
      return;
    }
    const posted = await this.post(endpoint.url, {
      ...headers,
      // Added AFTER the merged headers: extraHeaders cannot override the
      // credential/protocol-critical auth of the anthropic-messages path.
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    }, body, options.signal, apiKey);
    if (!posted.ok) {
      yield errorFinish(posted.message);
      return;
    }
    yield* anthropicSseToChunks(posted.response, options.signal);
  }
  async *streamOpenAI(options, gw, headers, apiKey, wireEffort) {
    const converted = toOpenAIMessages(options.messages);
    const system = options.system;
    const body = {
      model: options.model,
      max_tokens: options.maxTokens ?? this.requestMaxTokens(gw),
      ...options.temperature === void 0 ? {} : { temperature: options.temperature },
      // The declared wire spelling, not the canonical level id: a map like
      // `{ high: 'ultra' }` sends `reasoning_effort: "ultra"`; a valueless
      // `off` (and no effort at all) omits the parameter.
      ...wireEffort === void 0 ? {} : { reasoning_effort: wireEffort },
      messages: system === void 0 ? converted : [{ role: gw.systemRole, content: system }, ...converted],
      ...options.tools !== void 0 && options.tools.length > 0 ? { tools: toOpenAITools(options.tools) } : {},
      stream: true,
      // Ask the gateway for the final usage chunk (OpenAI stream_options
      // semantics). Opt out per gateway: strict OpenAI-compatible servers
      // reject unknown body parameters.
      ...gw.streamUsage === false ? {} : { stream_options: { include_usage: true } }
    };
    const endpoint = this.endpointOrFinish(options.provider, gw, "/chat/completions");
    if ("fail" in endpoint) {
      yield endpoint.fail;
      return;
    }
    const posted = await this.post(endpoint.url, {
      ...headers,
      // Added AFTER the merged headers: extraHeaders cannot override auth.
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    }, body, options.signal, apiKey);
    if (!posted.ok) {
      yield errorFinish(posted.message);
      return;
    }
    yield* openaiCompletionsToChunks(posted.response, options.signal);
  }
  async *streamResponses(options, gw, headers, apiKey, wireEffort) {
    const converted = toResponsesInput(options.messages);
    const systemText = [options.system, converted.systemText].filter((part) => typeof part === "string" && part.trim() !== "").join("\n");
    let input = converted.input;
    let instructions;
    if (systemText !== "") {
      if (gw.systemRole === "developer") {
        input = [{ role: "developer", content: [{ type: "input_text", text: systemText }] }, ...converted.input];
      } else {
        instructions = systemText;
      }
    }
    const body = {
      model: options.model,
      // The Responses parameter spelling (NOT the Chat `max_tokens`).
      max_output_tokens: options.maxTokens ?? this.requestMaxTokens(gw),
      ...options.temperature === void 0 ? {} : { temperature: options.temperature },
      // Effort values come from the same reasoningEfforts wire-spelling map as
      // the Chat path; the Responses endpoint carries them in its native
      // `reasoning.effort` slot. A valueless `off` (and no effort at all)
      // omits the parameter.
      ...wireEffort === void 0 ? {} : { reasoning: { effort: wireEffort } },
      ...instructions === void 0 ? {} : { instructions },
      input,
      ...options.tools !== void 0 && options.tools.length > 0 ? { tools: toResponsesTools(options.tools) } : {},
      stream: true
      // NOTE: no `stream_options` — that parameter is Chat Completions-only
      // and strict Responses endpoints reject it. Usage arrives on the
      // terminal response event regardless (the streamUsage flag governs the
      // Chat path's stream_options only).
    };
    const endpoint = this.endpointOrFinish(options.provider, gw, "/responses");
    if ("fail" in endpoint) {
      yield endpoint.fail;
      return;
    }
    const posted = await this.post(endpoint.url, {
      ...headers,
      // Added AFTER the merged headers: extraHeaders cannot override auth.
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    }, body, options.signal, apiKey);
    if (!posted.ok) {
      yield errorFinish(posted.message);
      return;
    }
    yield* responsesSseToChunks(posted.response, options.signal);
  }
  /**
   * POST one JSON body to the upstream. Transport failures surface as an
   * error finish chunk; HTTP errors surface as an error finish chunk with the
   * upstream status/message. `redact` (the API key) is scrubbed from any
   * upstream-echoed text so a misconfigured gateway cannot bounce the
   * credential back into the DSH error surface.
   */
  async post(url, headers, body, signal, redact) {
    const scrub = (text) => redact === void 0 || redact === "" || !text.includes(redact) ? text : text.split(redact).join("***");
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        ...signal === void 0 ? {} : { signal }
      });
    } catch (error) {
      return { ok: false, message: `fetch failed: ${scrub(error instanceof Error ? error.message : String(error))}` };
    }
    if (!response.ok) {
      let text = await response.text().catch(() => "");
      text = scrub(text);
      return { ok: false, message: `upstream ${response.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, response };
  }
};

// src/discovery.ts
import { LlmError as LlmError2 } from "@deepseek-ai/dsh-llm";
var MAX_LISTING_BYTES = 4 * 1024 * 1024;
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
async function readCappedJson(response, url) {
  const reader = response.body?.getReader();
  if (reader === void 0) {
    throw new LlmError2(`${redactUrl(url)} answered an unreadable body`, "DISCOVERY_FAILED");
  }
  const parts = [];
  let total = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === void 0 || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > MAX_LISTING_BYTES) {
        await reader.cancel().catch(() => {
        });
        throw new LlmError2(
          `model listing from ${redactUrl(url)} exceeds the 4 MiB read cap; add models by hand in the plugin settings`,
          "DISCOVERY_FAILED"
        );
      }
      parts.push(value);
    }
  } catch (error) {
    if (error instanceof LlmError2) throw error;
    throw new LlmError2(
      `could not read the model listing from ${redactUrl(url)}: ${error instanceof Error ? error.message : String(error)}`,
      "DISCOVERY_FAILED",
      { cause: error }
    );
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.byteLength;
  }
  const text = new TextDecoder().decode(body);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new LlmError2(`${redactUrl(url)} did not answer with JSON`, "DISCOVERY_FAILED", { cause: error });
  }
}
async function discoverModels(request, gw, resolveApiKey) {
  const baseURL = request.baseURL ?? gw.baseURL;
  if (baseURL === void 0 || baseURL.length === 0) {
    throw new LlmError2("llm-provider-hub: model discovery needs a baseURL; set it in the plugin settings", "DISCOVERY_FAILED");
  }
  const resolved = resolveEndpointUrl({ baseURL, endpointMode: gw.endpointMode }, "/models");
  if (!resolved.ok) {
    throw new LlmError2(`llm-provider-hub: model discovery: ${resolved.error}`, "DISCOVERY_FAILED");
  }
  const url = resolved.url;
  let supplied;
  try {
    supplied = request.apiKey ?? await resolveApiKey();
  } catch {
    supplied = void 0;
  }
  const headers = sanitizeExtraHeaders(gw.extraHeaders);
  headers["accept"] = "application/json";
  headers["user-agent"] = effectiveUserAgent(gw.userAgent);
  if (gw.api === "anthropic-messages") {
    if (supplied !== void 0 && supplied !== "") headers["x-api-key"] = supplied;
    headers["anthropic-version"] = "2023-06-01";
  } else if (supplied !== void 0 && supplied !== "") {
    headers.authorization = `Bearer ${supplied}`;
  }
  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
      ...request.signal === void 0 ? {} : { signal: request.signal }
    });
  } catch (error) {
    if (request.signal?.aborted) throw new LlmError2("model discovery aborted by caller", "ABORTED", { cause: error });
    throw new LlmError2(`could not reach ${redactUrl(url)}`, "DISCOVERY_FAILED", { cause: error });
  }
  if (!response.ok) {
    throw new LlmError2(
      `${redactUrl(url)} answered ${response.status}${response.status === 401 || response.status === 403 ? "; check the API key" : ""}`,
      "DISCOVERY_FAILED"
    );
  }
  const body = await readCappedJson(response, url);
  const data = body?.data;
  if (!Array.isArray(data)) {
    throw new LlmError2(`the endpoint's model listing has no "data" array; add models by hand in the plugin settings`, "DISCOVERY_FAILED");
  }
  const models = [];
  const seen = /* @__PURE__ */ new Set();
  for (const raw of data) {
    const entry = raw;
    const id = label(entry.id);
    if (id === void 0 || seen.has(id)) continue;
    seen.add(id);
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
import { assertUsableApiKey } from "@deepseek-ai/dsh-llm";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
function ok(value) {
  return { ok: true, ...value };
}
function fail(error) {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}
function isSettingsConflict(error) {
  return error instanceof Error && error.message.includes("SETTINGS_CONFLICT") || error !== null && typeof error === "object" && error.code === "SETTINGS_CONFLICT";
}
var REASONING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
function validateModelEntry(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("model entry must be a JSON object");
  }
  const entry = raw;
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  if (id === "") throw new Error("model entry needs a non-empty id");
  const originalIdRaw = entry.originalId;
  const originalId = typeof originalIdRaw === "string" && originalIdRaw.trim() !== "" ? originalIdRaw.trim() : void 0;
  const fields = {};
  if (entry.name !== void 0 && entry.name !== null) {
    if (typeof entry.name !== "string") throw new Error("name must be a string");
    const name2 = entry.name.trim();
    if (name2 !== "") fields.name = name2;
  }
  for (const key of ["contextWindow", "maxTokens"]) {
    const value = entry[key];
    if (value === void 0 || value === null) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }
    fields[key] = value;
  }
  if (entry.input !== void 0 && entry.input !== null) {
    if (!Array.isArray(entry.input)) throw new Error("input must be an array");
    const input = [...new Set(entry.input.filter((m) => m === "text" || m === "image"))];
    if (input.length > 0) fields.input = input;
  }
  if (entry.reasoningEfforts !== void 0 && entry.reasoningEfforts !== null) {
    if (entry.reasoningEfforts === false) {
      fields.reasoningEfforts = false;
    } else if (typeof entry.reasoningEfforts === "object" && !Array.isArray(entry.reasoningEfforts)) {
      const efforts = {};
      let thinking = false;
      for (const level of Object.keys(entry.reasoningEfforts)) {
        if (!REASONING_LEVELS.includes(level)) {
          throw new Error(`unknown reasoning level "${level}"; allowed levels: ${REASONING_LEVELS.join(", ")}`);
        }
        if (level === "off") {
          efforts.off = null;
          continue;
        }
        const wire = entry.reasoningEfforts[level];
        if (wire === null) throw new Error(`reasoningEfforts.${level} needs the wire value dispatch should send; only "off" may be empty`);
        if (typeof wire !== "string" || wire.trim() === "") throw new Error(`reasoningEfforts.${level} must be a non-empty string`);
        efforts[level] = wire.trim();
        thinking = true;
      }
      if (Object.keys(efforts).length === 0) throw new Error("reasoningEfforts is empty: declare at least one level, or mark the model non-reasoning with false");
      if (!thinking) throw new Error("reasoningEfforts must include at least one non-off level");
      fields.reasoningEfforts = efforts;
    } else {
      throw new Error("reasoningEfforts must be false (non-reasoning) or a { level: wireValue } map");
    }
  }
  return { id, originalId, fields };
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
  /** Live namespace view (describe mirrors the current map registration). */
  view() {
    try {
      const s = this.settings();
      const d = s?.describe?.({ redactSecrets: true })?.find((c) => c.ns === "llm-provider-hub");
      if (d === void 0) return void 0;
      return { gateways: d.value?.gateways, revision: d.revision };
    } catch {
      return void 0;
    }
  }
  /**
   * Serialized settings write with revision guard: reads the current revision,
   * applies the ops, retries ONCE on a namepsace conflict, and returns the
   * post-write revision so the caller can verify the commit landed.
   */
  async writeOps(st, ops) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const view = this.view();
      try {
        await st.mutate("llm-provider-hub", ops, view?.revision);
        const after = this.view();
        return { revision: after?.revision, committed: after !== void 0 };
      } catch (error) {
        if (attempt === 0 && isSettingsConflict(error)) continue;
        throw error;
      }
    }
    return { committed: false };
  }
  /** Replace the whole gateways array in the settings document (one flat op). */
  async setGateways(st, gateways) {
    return this.writeOps(st, [{ op: "set", path: ["gateways"], value: gateways }]);
  }
  /**
   * Commit one gateway's NEXT configuration through the whole-array write —
   * but only after the resulting model list still resolves. resolveModelEntries
   * is the read-side contract (the adapter resolves through it on every
   * request), so a write that would break it — e.g. a reasoning map with no
   * spellable level — is refused here, before any settings mutation.
   */
  async commitGateway(st, index, next) {
    let models;
    try {
      models = resolveModelEntries(next);
    } catch (error) {
      return fail(`refusing to write: the gateway's model list would not resolve \u2014 ${error instanceof Error ? error.message : String(error)}`);
    }
    const config = this.deps.current();
    await this.setGateways(st, config.gateways.map((g, i) => i === index ? next : g));
    return ok({ index, models });
  }
  /** Gateway at index, or undefined. */
  gatewayAt(index) {
    return this.deps.current().gateways[index];
  }
  /** Full state for the settings page: gateways + per-gateway resolved models + shared catalog. */
  async getState() {
    try {
      const config = this.deps.current();
      const view = this.view();
      const liveG = Array.isArray(view?.gateways) ? view.gateways.length : void 0;
      this.deps.log(
        `getState: current()=${config.gateways.length} describe=${String(liveG)} scope-user=${String(Array.isArray(view?.gateways) ? view.gateways.length : "n/a")} revision=${String(view?.revision)}`
      );
      const credentials = this.hostCtx.get("credentials");
      const publicGateways = await Promise.all(config.gateways.map(async (gw) => {
        const { apiKey: _secret, ...safe } = gw;
        let configured = typeof _secret === "string" && _secret.trim() !== "";
        try {
          const description = credentials?.describe !== void 0 ? await credentials.describe(credentialRef(gw.apiKeyEnv)) : void 0;
          configured ||= description?.configured === true;
        } catch {
        }
        return { gateway: { ...safe, apiKeyConfigured: configured }, models: resolveModelEntries(gw) };
      }));
      const safeConfig = { gateways: publicGateways.map((item) => item.gateway) };
      return ok({
        config: safeConfig,
        gateways: publicGateways.map((item, index) => ({ index, gateway: item.gateway, models: item.models })),
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
      this.deps.log(`addGateway: before mutate current()=${config.gateways.length} describe=${String(this.view()?.revision)}`);
      const used = new Set(config.gateways.map((gw2) => gw2.provider));
      let base = "hub-gateway";
      let provider = base;
      for (let i = 1; used.has(provider); i++) provider = `${base}-${i}`;
      const gw = {
        provider,
        displayName: provider,
        baseURL: "",
        api: "anthropic-messages",
        endpointMode: "auto",
        endpoint: "",
        userAgent: DEFAULT_USER_AGENT,
        apiKeyEnv: "GATEWAY_API_KEY",
        apiKey: "",
        extraHeaders: {},
        systemRole: "system",
        streamUsage: true,
        enabledModels: ["glm-5.3"],
        modelOverrides: {},
        customModels: []
      };
      const index = config.gateways.length;
      const committed = await this.setGateways(st, [...config.gateways, gw]);
      const after = this.deps.current();
      const afterView = this.view();
      this.deps.log(
        `addGateway: after current()=${after.gateways.length} describe=${String(Array.isArray(afterView?.gateways) ? afterView.gateways.length : "n/a")} revision=${String(afterView?.revision)} committed=${String(committed.committed)}`
      );
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
      await this.setGateways(st, next);
      return ok({ removed: index, gateways: next.length });
    } catch (error) {
      return fail(error);
    }
  }
  /** Write one or more fields of one gateway (whole-array write). */
  async saveConfig(index, patch) {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      if (st.writable === false) return fail("settings are read-only");
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const config = this.deps.current();
      let normalizedPatch = patch;
      if (patch.provider !== void 0) {
        const provider = typeof patch.provider === "string" ? patch.provider.trim() : "";
        if (provider === "") return fail("provider id must not be empty");
        if (config.gateways.some((g, i) => i !== index && g.provider.trim() === provider)) {
          return fail(`provider id "${provider}" is already used by another gateway`);
        }
        normalizedPatch = { ...patch, provider };
      }
      if (patch.api !== void 0 && patch.api !== "anthropic-messages" && patch.api !== "openai-completions" && patch.api !== "openai-responses") {
        return fail('api must be "anthropic-messages", "openai-completions" or "openai-responses"');
      }
      if (patch.endpointMode !== void 0 && patch.endpointMode !== "auto" && patch.endpointMode !== "custom") {
        return fail('endpointMode must be "auto" or "custom"');
      }
      if (patch.endpoint !== void 0) {
        if (typeof patch.endpoint !== "string") return fail("endpoint must be a string");
        const endpoint = patch.endpoint.trim();
        if (endpoint !== "") {
          if (/[\r\n]/.test(endpoint)) return fail("endpoint must not contain line breaks");
          try {
            const parsed = new URL(endpoint);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fail("endpoint must use http or https");
          } catch {
            return fail("endpoint is not a valid URL");
          }
        }
      }
      if (patch.systemRole !== void 0 && patch.systemRole !== "system" && patch.systemRole !== "developer") {
        return fail('systemRole must be "system" or "developer"');
      }
      if (patch.baseURL !== void 0) {
        if (typeof patch.baseURL !== "string") return fail("baseURL must be a string");
        const base = patch.baseURL.trim();
        if (base !== "") {
          try {
            const parsed = new URL(base);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fail("baseURL must use http or https");
          } catch {
            return fail("baseURL is not a valid URL");
          }
        }
      }
      if (patch.userAgent !== void 0) {
        if (typeof patch.userAgent !== "string") return fail("userAgent must be a string");
        if (/[\r\n]/.test(patch.userAgent)) return fail("userAgent must not contain line breaks");
      }
      if (patch.extraHeaders !== void 0) {
        const headers = patch.extraHeaders;
        if (headers === null || typeof headers !== "object" || Array.isArray(headers)) return fail("extraHeaders must be a JSON object");
        for (const [name2, value] of Object.entries(headers)) {
          if (typeof value !== "string") return fail(`extraHeaders.${name2} must be a string`);
          if (/[\r\n]/.test(name2) || /[\r\n]/.test(value)) return fail(`extraHeaders.${name2} must not contain line breaks`);
        }
      }
      if (patch.streamUsage !== void 0 && typeof patch.streamUsage !== "boolean") {
        return fail("streamUsage must be a boolean");
      }
      if (patch.defaultContextWindow !== void 0 && patch.defaultContextWindow !== null && !positiveInt(patch.defaultContextWindow)) {
        return fail("defaultContextWindow must be a positive integer");
      }
      if (patch.defaultMaxTokens !== void 0 && patch.defaultMaxTokens !== null && !positiveInt(patch.defaultMaxTokens)) {
        return fail("defaultMaxTokens must be a positive integer");
      }
      if (patch.defaultInput !== void 0 && patch.defaultInput !== null) {
        if (!Array.isArray(patch.defaultInput)) return fail("defaultInput must be an array");
        for (const modality of patch.defaultInput) {
          if (modality !== "text" && modality !== "image" && modality !== "audio") {
            return fail('defaultInput must contain only "text", "image" or "audio"');
          }
        }
      }
      const requestedApiKey = patch.apiKey;
      const patchWithoutSecret = { ...normalizedPatch };
      delete patchWithoutSecret.apiKey;
      if (requestedApiKey !== void 0) {
        if (typeof requestedApiKey !== "string") return fail("apiKey must be a string");
        const literal = requestedApiKey.trim();
        if (literal !== "") {
          const envName = typeof patchWithoutSecret.apiKeyEnv === "string" && patchWithoutSecret.apiKeyEnv.trim() !== "" ? patchWithoutSecret.apiKeyEnv.trim() : gw.apiKeyEnv;
          try {
            const credentials = this.hostCtx.get("credentials");
            if (credentials === void 0) return fail("credentials service unavailable; API key was not stored");
            await credentials.set(credentialRef(envName), assertUsableApiKey(literal, "llm-provider-hub", envName));
          } catch (error) {
            return fail(error);
          }
        }
      }
      const next = config.gateways.map((g, i) => i === index ? { ...g, ...patchWithoutSecret, apiKey: "" } : g);
      await this.setGateways(st, next);
      return ok({ config: this.deps.current() });
    } catch (error) {
      return fail(error);
    }
  }
  /** Enable/disable a built-in catalog model id on one gateway. */
  async toggleBuiltin(index, id, enabled) {
    try {
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const set = new Set(gw.enabledModels ?? []);
      if (enabled) set.add(id);
      else set.delete(id);
      return this.saveConfig(index, { enabledModels: [...set] });
    } catch (error) {
      return fail(error);
    }
  }
  /**
   * Replace the modelOverrides map of one gateway wholesale. The resulting
   * model list must still resolve (the same read-side contract the unified
   * write path enforces), so a map the resolution would refuse — e.g. an
   * off-only reasoning map — is rejected BEFORE the settings write instead of
   * bricking the gateway's read side.
   */
  async saveOverrides(index, overrides) {
    try {
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      if (overrides === null || typeof overrides !== "object" || Array.isArray(overrides)) {
        return fail("modelOverrides must be a JSON object");
      }
      try {
        resolveModelEntries({ ...gw, modelOverrides: overrides });
      } catch (error) {
        return fail(`refusing to save: the gateway's model list would not resolve \u2014 ${error instanceof Error ? error.message : String(error)}`);
      }
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
      const custom = [...gw.customModels ?? []];
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
  /**
   * Unified model upsert for ONE gateway (model-edit phase 1). Dispatch is by
   * id, mirroring the reference configurator's applyModelConfig semantics on
   * this plugin's storage shape:
   *
   *   - built-in catalog id: ensures `enabledModels`, merges the provided
   *     fields into `modelOverrides[id]` field by field, drops the fields
   *     named in `clearFields` (they fall back to catalog inheritance), and
   *     deletes the override entirely once it ends up empty.
   *   - any other id: upserts a `customModels` entry; contextWindow/maxTokens
   *     must be positive integers — a NEW custom entry gets no hard-coded
   *     128000/8192 fallback (it may omit a capacity only when the gateway
   *     declares the matching default, which resolution then applies), and
   *     an EDIT keeps the previous entry's values.
   *   - `entry.reasoningEfforts: false` declares a non-reasoning model: for a
   *     custom entry it removes the map (resolution serves no reasoning
   *     control); on a BUILT-IN id it is refused, because the override shape
   *     can only express reasoning by inheritance — silently clearing would
   *     keep the catalog's control alive while looking disabled.
   *   - a same-id builtin/custom collision is refused explicitly (the
   *     resolution would serve two entries with one id).
   *   - overwrite=false refuses an already-configured target: for a custom id
   *     that means the entry exists; for a built-in id that means it is
   *     enabled AND already carries a non-empty override.
   *   - `entry.originalId` (optional) marks an EDIT: renaming a custom entry
   *     onto a fresh id forms a NEW entry and removes the old one; renaming
   *     onto a built-in id (or between built-in ids) is refused.
   *
   * The write is gated on resolveModelEntries, so a configuration the read
   * side could not resolve never lands.
   */
  async upsertModel(index, entry, overwrite, clearFields) {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      if (st.writable === false) return fail("settings are read-only");
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const { id, originalId, fields } = validateModelEntry(entry);
      const clears = new Set(Array.isArray(clearFields) ? clearFields.filter((k) => typeof k === "string") : []);
      if (MODEL_CATALOG[id] !== void 0) {
        if (fields.reasoningEfforts === false) {
          return fail(`built-in model "${id}" cannot declare reasoningEfforts: false; a built-in model inherits the catalog's reasoning map unless the override clears it (clearFields: ["reasoningEfforts"])`);
        }
        if (originalId !== void 0 && originalId !== id) {
          return fail(MODEL_CATALOG[originalId] !== void 0 ? `cannot rename built-in model "${originalId}" to "${id}"; built-in model ids are fixed` : `cannot rename custom model "${originalId}" onto built-in id "${id}"; configure the built-in override directly`);
        }
        if ((gw.customModels ?? []).some((c) => c.id === id)) {
          return fail(`model id "${id}" is a built-in catalog model, but a custom model with the same id exists on this gateway; remove the custom entry first`);
        }
        const wasEnabled = (gw.enabledModels ?? []).includes(id);
        const prevOverride = (gw.modelOverrides ?? {})[id];
        const hadOverride = prevOverride !== void 0 && prevOverride !== null && typeof prevOverride === "object" && Object.keys(prevOverride).length > 0;
        if (wasEnabled && hadOverride && overwrite !== true) {
          return fail(`built-in model "${id}" already has saved overrides; confirm overwrite to merge`);
        }
        const enabled = new Set(gw.enabledModels ?? []);
        enabled.add(id);
        const overrides = { ...gw.modelOverrides ?? {} };
        const merged = { ...prevOverride ?? {} };
        for (const key of clears) delete merged[key];
        for (const [key, value] of Object.entries(fields)) merged[key] = value;
        if (Object.keys(merged).length === 0) delete overrides[id];
        else overrides[id] = merged;
        const next2 = { ...gw, enabledModels: [...enabled], modelOverrides: overrides };
        const committed2 = await this.commitGateway(st, index, next2);
        return committed2.ok ? ok({ ...committed2, model: id, kind: "builtin", override: overrides[id] }) : committed2;
      }
      if (originalId !== void 0 && MODEL_CATALOG[originalId] !== void 0) {
        return fail(`model "${originalId}" is a built-in catalog model and cannot be edited as a custom entry; configure its override instead`);
      }
      const custom = [...gw.customModels ?? []];
      const sourceId = originalId ?? id;
      const sourceIdx = custom.findIndex((item) => item.id === sourceId);
      if (originalId !== void 0 && sourceIdx < 0) {
        return fail(`model "${sourceId}" does not exist on this gateway; refresh and retry`);
      }
      const targetIdx = custom.findIndex((item) => item.id === id);
      if (targetIdx >= 0 && overwrite !== true) {
        return fail(`model "${id}" already exists on this gateway; confirm overwrite to replace it`);
      }
      const builtFields = { ...fields };
      if (builtFields.reasoningEfforts === false) {
        clears.add("reasoningEfforts");
        delete builtFields.reasoningEfforts;
      }
      const prevBase = targetIdx >= 0 ? custom[targetIdx] : sourceIdx >= 0 ? custom[sourceIdx] : void 0;
      const kept = {};
      if (prevBase !== null && typeof prevBase === "object") {
        for (const [key, value] of Object.entries(prevBase)) {
          if (key !== "id" && !clears.has(key)) kept[key] = value;
        }
      }
      const finalEntry = { ...kept, ...builtFields, id };
      const defaults = gatewayModelDefaults(gw);
      for (const key of ["contextWindow", "maxTokens"]) {
        if (positiveInt(finalEntry[key])) continue;
        if (defaults[key] !== void 0) {
          delete finalEntry[key];
          continue;
        }
        return fail(`custom model "${id}" needs a positive integer ${key} (none provided, none kept from the previous entry, and the gateway has no ${key === "contextWindow" ? "defaultContextWindow" : "defaultMaxTokens"} fallback)`);
      }
      if (finalEntry.name !== void 0 && (typeof finalEntry.name !== "string" || finalEntry.name.trim() === "")) {
        delete finalEntry.name;
      }
      const nextCustom = [];
      for (let i = 0; i < custom.length; i++) {
        if (i === sourceIdx && sourceIdx !== targetIdx) continue;
        if (i === targetIdx) nextCustom.push(finalEntry);
        else nextCustom.push(custom[i]);
      }
      if (targetIdx < 0) nextCustom.push(finalEntry);
      const next = { ...gw, customModels: nextCustom };
      const committed = await this.commitGateway(st, index, next);
      return committed.ok ? ok({ ...committed, model: id, kind: "custom", custom: finalEntry }) : committed;
    } catch (error) {
      return fail(error);
    }
  }
  /**
   * Unified model delete for ONE gateway: a built-in catalog id is removed
   * from `enabledModels` TOGETHER with its `modelOverrides` entry; any other
   * id is removed from `customModels`. An id unknown to the catalog but
   * present in `enabledModels`/`modelOverrides` (hand-edited settings or a
   * retired catalog entry) is cleaned up too, so the unified delete still
   * works on legacy data. Unknown/unconfigured ids are refused.
   */
  async deleteModel(index, id) {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      if (st.writable === false) return fail("settings are read-only");
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const modelId = typeof id === "string" ? id.trim() : "";
      if (modelId === "") return fail("model id must not be empty");
      let next;
      let kind;
      if (MODEL_CATALOG[modelId] !== void 0) {
        const wasEnabled = (gw.enabledModels ?? []).includes(modelId);
        const hadOverride = (gw.modelOverrides ?? {})[modelId] !== void 0;
        if (!wasEnabled && !hadOverride) return fail(`built-in model "${modelId}" is not configured on this gateway`);
        next = {
          ...gw,
          enabledModels: (gw.enabledModels ?? []).filter((m) => m !== modelId),
          modelOverrides: Object.fromEntries(Object.entries(gw.modelOverrides ?? {}).filter(([key]) => key !== modelId))
        };
        kind = "builtin";
      } else if ((gw.customModels ?? []).some((item) => item.id === modelId)) {
        next = { ...gw, customModels: (gw.customModels ?? []).filter((item) => item.id !== modelId) };
        kind = "custom";
      } else if ((gw.enabledModels ?? []).includes(modelId) || (gw.modelOverrides ?? {})[modelId] !== void 0) {
        next = {
          ...gw,
          enabledModels: (gw.enabledModels ?? []).filter((m) => m !== modelId),
          modelOverrides: Object.fromEntries(Object.entries(gw.modelOverrides ?? {}).filter(([key]) => key !== modelId))
        };
        kind = "orphan";
      } else {
        return fail(`model "${modelId}" does not exist on this gateway`);
      }
      const committed = await this.commitGateway(st, index, next);
      return committed.ok ? ok({ ...committed, model: modelId, kind }) : committed;
    } catch (error) {
      return fail(error);
    }
  }
  /** Discover models with the saved gateway configuration. */
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
  /**
   * Test an unsaved gateway draft against GET {baseURL}/models. This is kept
   * separate from discover(): the settings page can verify a freshly typed
   * URL/key/UA/header combination without persisting it first. The FULL model
   * listing rides along in the envelope so the client can seed its discovery
   * list without a second round-trip.
   */
  async testConnection(index, draft) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15e3);
    try {
      const saved = this.gatewayAt(index);
      if (saved === void 0) return fail("gateway index out of range");
      const str = (v, fallback) => typeof v === "string" ? v : fallback;
      const api = draft.api;
      const headers = draft.extraHeaders === void 0 ? saved.extraHeaders : draft.extraHeaders;
      if (headers === null || typeof headers !== "object" || Array.isArray(headers)) {
        return fail("extraHeaders must be a JSON object");
      }
      for (const [name2, value] of Object.entries(headers)) {
        if (typeof value !== "string") return fail(`extraHeaders.${name2} must be a string`);
        if (/[\r\n]/.test(name2) || /[\r\n]/.test(value)) return fail(`extraHeaders.${name2} must not contain line breaks`);
      }
      const testGateway = {
        ...saved,
        provider: str(draft.provider, saved.provider),
        displayName: str(draft.displayName, saved.displayName),
        baseURL: str(draft.baseURL, saved.baseURL ?? ""),
        api: api === "openai-completions" || api === "anthropic-messages" || api === "openai-responses" ? api : saved.api,
        endpointMode: draft.endpointMode === "custom" || draft.endpointMode === "auto" ? draft.endpointMode : saved.endpointMode,
        endpoint: str(draft.endpoint, saved.endpoint ?? ""),
        userAgent: str(draft.userAgent, saved.userAgent),
        apiKey: str(draft.apiKey, saved.apiKey),
        apiKeyEnv: str(draft.apiKeyEnv, saved.apiKeyEnv),
        extraHeaders: headers
      };
      const baseURL = (testGateway.baseURL ?? "").trim();
      if (baseURL === "") return fail("Base URL is required");
      let parsed;
      try {
        parsed = new URL(baseURL);
      } catch {
        return fail("Base URL is not a valid URL");
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fail("Base URL must use http or https");
      if (/[\r\n]/.test(testGateway.userAgent)) return fail("userAgent must not contain line breaks");
      const endpoint = (testGateway.endpoint ?? "").trim();
      if (endpoint !== "") {
        if (/[\r\n]/.test(endpoint)) return fail("endpoint must not contain line breaks");
        try {
          const parsedEndpoint = new URL(endpoint);
          if (parsedEndpoint.protocol !== "http:" && parsedEndpoint.protocol !== "https:") return fail("endpoint must use http or https");
        } catch {
          return fail("endpoint is not a valid URL");
        }
      }
      const started = Date.now();
      const resolved = resolveEndpointUrl({ baseURL, endpointMode: testGateway.endpointMode }, "/models");
      if (!resolved.ok) return fail(resolved.error);
      const models = await discoverModels(
        { baseURL, signal: controller.signal },
        testGateway,
        () => this.deps.resolveApiKey(testGateway)
      );
      return ok({
        endpoint: redactUrl(resolved.url),
        latencyMs: Date.now() - started,
        modelCount: models.length,
        models
      });
    } catch (error) {
      if (controller.signal.aborted) return fail("Connection timed out after 15 seconds");
      return fail(error);
    } finally {
      clearTimeout(timeout);
    }
  }
  /**
   * Enable one model on one gateway: if the id hits the built-in catalog,
   * enable it in `enabledModels` (discovery/preset params richer than the
   * catalog seed an override); otherwise insert it as a custom model. One
   * whole-array write.
   */
  async enableDiscovered(index, model) {
    try {
      const st = this.settings();
      if (st === void 0) return fail("settings service unavailable");
      const gw = this.gatewayAt(index);
      if (gw === void 0) return fail("gateway index out of range");
      const id = typeof model.id === "string" ? model.id.trim() : "";
      if (id === "") return fail("model needs a non-empty id");
      let next;
      let kind;
      if (MODEL_CATALOG[id] !== void 0) {
        const set = new Set(gw.enabledModels ?? []);
        set.add(id);
        const patch = { enabledModels: [...set] };
        const discoveredCtx = typeof model.contextWindow === "number" && Number.isFinite(model.contextWindow) ? model.contextWindow : void 0;
        const discoveredMax = typeof model.maxTokens === "number" && Number.isFinite(model.maxTokens) ? model.maxTokens : void 0;
        if (discoveredCtx !== void 0 || discoveredMax !== void 0) {
          const overrides = { ...gw.modelOverrides ?? {} };
          const cur = overrides[id] ?? {};
          const nextOv = { ...cur };
          if (discoveredCtx !== void 0) nextOv.contextWindow = discoveredCtx;
          if (discoveredMax !== void 0) nextOv.maxTokens = discoveredMax;
          overrides[id] = nextOv;
          patch.modelOverrides = overrides;
        }
        next = { ...gw, ...patch };
        kind = "builtin";
      } else {
        const custom = [...gw.customModels ?? []];
        if (custom.some((item) => item.id === id)) return ok({ enabled: id, kind: "custom-existing" });
        const entry = {
          id,
          name: typeof model.name === "string" && model.name.trim() !== "" ? model.name : id,
          ...positiveInt(model.contextWindow) ? { contextWindow: model.contextWindow } : {},
          ...positiveInt(model.maxTokens) ? { maxTokens: model.maxTokens } : {}
        };
        custom.push(entry);
        next = { ...gw, customModels: custom };
        kind = "custom";
      }
      const config = this.deps.current();
      const gws = config.gateways.map((g, i) => i === index ? next : g);
      await this.setGateways(st, gws);
      return ok({ enabled: id, kind });
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
var nullishStringArraySchema = schema((v) => {
  if (v === void 0 || v === null) return [];
  if (!Array.isArray(v)) throw new TypeError("expected an array of strings");
  return v.map((item) => {
    if (typeof item !== "string") throw new TypeError("expected an array of strings");
    return item;
  });
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
var nullishStringArrayParam = (name2) => ({
  name: name2,
  wire: name2,
  source: "json",
  codec: codec("StringArrayOrNull", nullishStringArraySchema)
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
  invocation("upsertModel", "upsertModel", [numberParam("index"), objectParam("entry"), booleanParam("overwrite"), nullishStringArrayParam("clearFields")]),
  invocation("deleteModel", "deleteModel", [numberParam("index"), stringParam("id")]),
  invocation("discover", "discover", [numberParam("index")]),
  invocation("testConnection", "testConnection", [numberParam("index"), objectParam("draft")]),
  invocation("enableDiscovered", "enableDiscovered", [numberParam("index"), objectParam("model")])
];
var TYPERT_MANIFEST = {
  package: "@tappat225/dsh-provider-hub",
  face: "host",
  schemas: [],
  model: {
    services: [
      {
        key: "providerHub",
        exportName: "ProviderHubRuntime",
        description: "Manage provider-hub gateways and model catalogs: read/write settings, add/remove routes, test draft credentials, edit models, and discover upstream models.",
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
          { kind: "method", name: "upsertModel", signature: "upsertModel(index: number, entry: object, overwrite: boolean, clearFields: string[] | null): Promise<object>" },
          { kind: "method", name: "deleteModel", signature: "deleteModel(index: number, id: string): Promise<object>" },
          { kind: "method", name: "discover", signature: "discover(index: number): Promise<object>" },
          { kind: "method", name: "testConnection", signature: "testConnection(index: number, draft: object): Promise<object>" },
          { kind: "method", name: "enableDiscovered", signature: "enableDiscovered(index: number, model: object): Promise<object>" }
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
  /** Provider route this gateway registers (unique across gateways; changes apply live). */
  provider: z.string(),
  /** Display name in model pickers. */
  displayName: z.string().default(DEFAULT_DISPLAY_NAME),
  /** Upstream base URL (auto: API root; custom: the complete model-listing URL). */
  baseURL: z.string(),
  /** Wire protocol. */
  api: z.union(["anthropic-messages", "openai-completions", "openai-responses"]).default("anthropic-messages"),
  /**
   * Endpoint addressing mode. auto (default; older stored configs behave as
   * auto): the /v1-normalized request paths are derived from baseURL. custom:
   * no path is appended — `endpoint` is the complete chat request URL and
   * `baseURL` the complete model-listing URL, both used verbatim.
   */
  endpointMode: z.union(["auto", "custom"]).default("auto"),
  /** Complete chat request URL used verbatim in custom mode (per the gateway's api). */
  endpoint: z.string().default(""),
  /** User-Agent sent on the wire (gateway whitelist; empty falls back to the default). */
  userAgent: z.string().default(DEFAULT_USER_AGENT),
  /** Credential-ref env var name; resolved through the credentials service or launch environment. */
  apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
  /** Literal key, optional; accepted only for legacy migration and never returned to the client. */
  apiKey: z.string().role("secret"),
  /** Extra headers merged into every request. */
  extraHeaders: z.dict(z.string()).default({}),
  /** Role used for the system prompt on the openai-completions path ('developer' fixes strict GPT-lineage gateways). */
  systemRole: z.union(["system", "developer"]).default("system"),
  /** Request the final usage chunk on the openai-completions path (stream_options.include_usage; disable for gateways that reject the parameter). */
  streamUsage: z.boolean().default(true),
  /** Default context window for custom models that omit contextWindow (optional: unset means no gateway fallback). */
  defaultContextWindow: z.number().step(1).min(1),
  /** Default per-request output cap (fills custom entries without maxTokens and requests DSH sends without one; unset keeps the 4096 floor). */
  defaultMaxTokens: z.number().step(1).min(1),
  /** Default input modalities for custom models that omit input. */
  defaultInput: z.array(z.union(["text", "image", "audio"])),
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
    input: z.array(z.union(["text", "image", "audio"])),
    reasoningEfforts: z.dict(z.union([z.string(), z.const(null)]))
  })).default([])
});
var Config = z.object({
  gateways: z.array(GatewaySchema).default([])
});
function apply(ctx, config) {
  let current = () => config;
  let settingsBind = 0;
  const legacyLiteralKeys = /* @__PURE__ */ new Map();
  for (const gw of config.gateways) {
    if (typeof gw.apiKey === "string" && gw.apiKey.trim() !== "") legacyLiteralKeys.set(gw.apiKeyEnv, gw.apiKey.trim());
  }
  const gatewayFor = (provider) => current().gateways.find((gw) => gw.provider === provider);
  const resolveApiKey = async (gw) => {
    const refName = gw.apiKeyEnv ?? DEFAULT_API_KEY_ENV;
    const ref = credentialRef2(refName);
    const credentials = ctx.get("credentials");
    const stored = credentials !== void 0 ? (await credentials.resolve(ref))?.value : void 0;
    if (stored !== void 0 && stored.length > 0) return assertUsableApiKey2(stored, "llm-provider-hub", refName);
    const literal = typeof gw.apiKey === "string" && gw.apiKey.trim() !== "" ? gw.apiKey.trim() : legacyLiteralKeys.get(refName);
    if (literal !== void 0) {
      const key = assertUsableApiKey2(literal, "llm-provider-hub", refName);
      if (credentials !== void 0) {
        try {
          await credentials.set(ref, key);
          legacyLiteralKeys.delete(refName);
        } catch {
        }
      }
      return key;
    }
    const hit = launchEnvironmentOf(ctx).get(ref)?.value;
    if (hit !== void 0 && hit.length > 0) return assertUsableApiKey2(hit, "llm-provider-hub", refName);
    throw new LlmError3(
      `llm-provider-hub: no API key for provider route "${gw.provider}"; set the API key in the plugin settings, store ${refName} in the credentials service, or export it in the launching environment`,
      "MISSING_CREDENTIAL"
    );
  };
  const adapter = new GatewayAdapter({
    // NOTE: `current` must be a thunk reading the mutable binding — the
    // settings inject reassigns `current` AFTER this constructor captures the
    // deps object. Passing `current` directly would freeze the composition
    // entry forever (settings page always empty, routes never see new gateways).
    current: () => current(),
    gatewayFor,
    resolveApiKey
  });
  let directoryHandle;
  let adapterHandle;
  const registerLlmRoutes = () => {
    const gateways = current().gateways;
    const providers = gateways.map((gw) => gw.provider);
    try {
      const entries = gateways.map((gw) => ({
        provider: gw.provider,
        displayName: gw.displayName || DEFAULT_DISPLAY_NAME,
        settingsNs: NS,
        settingsPath: []
      }));
      if (directoryHandle !== void 0) directoryHandle.replace(entries);
      else if (entries.length > 0) directoryHandle = ctx.llm.registerConfigurableProviders(entries);
    } catch (error) {
      ctx.logger.warn(`provider-hub: configurable-provider sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      if (adapterHandle !== void 0) adapterHandle.replace(providers);
      else if (providers.length > 0) adapterHandle = ctx.llm.registerAdapter(providers, adapter);
    } catch (error) {
      ctx.logger.warn(`provider-hub: adapter sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
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
  registerLlmRoutes();
  ctx.inject(["typert"], (typertCtx) => {
    try {
      new ProviderHubRuntime(typertCtx, {
        // Same capture trap as the adapter: pass a thunk, not the binding.
        current: () => current(),
        resolveApiKey,
        gatewayFor,
        log: (message) => typertCtx.logger.info(`provider-hub: ${message}`)
      });
      typertCtx.typert.register(TYPERT_MANIFEST);
    } catch (error) {
      ctx.logger.warn(`provider-hub: typert/Remote setup failed (settings page unavailable): ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ctx.inject(["settings"], (sctx) => {
    try {
      const s = sctx.settings;
      const scope = s.register(NS, Config, { base: config });
      try {
        for (const gw of scope.get().gateways) {
          if (typeof gw.apiKey === "string" && gw.apiKey.trim() !== "") legacyLiteralKeys.set(gw.apiKeyEnv, gw.apiKey.trim());
        }
      } catch {
      }
      settingsBind += 1;
      const bindMark = settingsBind;
      const read = () => {
        let live;
        try {
          const d = s.describe?.({ redactSecrets: true })?.find((c) => c.ns === NS);
          live = d?.value;
        } catch {
          live = void 0;
        }
        if (live !== void 0 && typeof live === "object" && live !== null && Array.isArray(live.gateways)) {
          return live;
        }
        return scope.get();
      };
      current = read;
      ctx.logger.info(`provider-hub: settings source bound ${bindMark} (describe live read)`);
      const report = (tag) => {
        let scopeCount = -1;
        let descCount;
        let userCount;
        let revision;
        try {
          scopeCount = scope.get().gateways.length;
        } catch {
        }
        try {
          const d = s.describe?.({ redactSecrets: true })?.find((c) => c.ns === NS);
          descCount = d?.value?.gateways?.length;
          userCount = d?.user?.gateways?.length;
          revision = d?.revision;
        } catch {
        }
        ctx.logger.info(
          `provider-hub: ${tag} bind=${bindMark} scope=${scopeCount} describe=${String(descCount)} user=${String(userCount)} revision=${String(revision)}`
        );
      };
      report("settings setup");
      registerLlmRoutes();
      ctx.logger.info(`provider-hub: llm routes synced: ${current().gateways.length} gateway(s) bound=${bindMark}`);
      scope.watch(() => {
        current = read;
        report("settings watch");
        registerLlmRoutes();
      });
      sctx.effect(() => () => {
        try {
          const state = ctx.fiber?.state ?? 0;
          if (state === 4 || state === 5) return;
        } catch {
        }
        current = () => config;
        report("settings disposed");
      });
    } catch (error) {
      ctx.logger.warn(`provider-hub: settings setup failed (entry fallback): ${error instanceof Error ? error.message : String(error)}`);
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
