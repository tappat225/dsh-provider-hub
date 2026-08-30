/**
 * Model discovery: interrogate the model-listing endpoint with the configured
 * custom User-Agent and map the OpenAI-compatible listing into
 * LlmDiscoveredModel entries. Operates on ONE gateway's config — the
 * plugin picks the gateway from the discovery request's baseURL first.
 *
 * Endpoint + auth follow the gateway's protocol and addressing mode through
 * the unified endpoint resolver:
 *   - auto mode (default; older stored configs behave as auto): `baseURL` is
 *     the API root and the listing is `GET {baseURL}/models` with /v1
 *     auto-normalization;
 *   - custom mode: `baseURL` IS the complete models URL, used verbatim
 *     (nothing joined, no /v1 inserted);
 *   - openai-completions / openai-responses authorize with `Authorization:
 *     Bearer`; anthropic-messages authorizes with `x-api-key` +
 *     `anthropic-version` (never Bearer).
 * extraHeaders merge FIRST, sanitized (case-insensitive via the shared
 * sanitizeExtraHeaders), so the credential/protocol/transport-critical headers
 * (and the custom UA) can never be overridden by them.
 *
 * @module dsh-provider-hub/discovery
 */
import { LlmError, type LlmDiscoveredModel, type LlmModelDiscoveryRequest } from '@deepseek-ai/dsh-llm';
import { sanitizeExtraHeaders } from './adapter.ts';
import { effectiveUserAgent, type GatewayConfig } from './types.ts';
import { redactUrl, resolveEndpointUrl } from './url.ts';

/** Hard cap on how much of a listing body is actually read from the wire (4 MiB). */
export const MAX_LISTING_BYTES = 4 * 1024 * 1024;

function label(...candidates: Array<unknown>): string | undefined {
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return undefined;
}

function capacity(...candidates: Array<unknown>): number | undefined {
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

/**
 * Read the response body as a stream with a hard 4 MiB cap and parse it as
 * JSON. Reading through `response.json()` would buffer an unlimited body and
 * let a runaway gateway pin memory; the cap stops the read (and tears the
 * connection down) once exceeded.
 */
async function readCappedJson(response: Response, url: string): Promise<unknown> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new LlmError(`${redactUrl(url)} answered an unreadable body`, 'DISCOVERY_FAILED');
  }
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > MAX_LISTING_BYTES) {
        // Stop reading instead of buffering the rest; close the stream best-effort.
        await reader.cancel().catch(() => {});
        throw new LlmError(
          `model listing from ${redactUrl(url)} exceeds the 4 MiB read cap; add models by hand in the plugin settings`,
          'DISCOVERY_FAILED',
        );
      }
      parts.push(value);
    }
  } catch (error) {
    if (error instanceof LlmError) throw error;
    throw new LlmError(
      `could not read the model listing from ${redactUrl(url)}: ${error instanceof Error ? error.message : String(error)}`,
      'DISCOVERY_FAILED',
      { cause: error },
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
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new LlmError(`${redactUrl(url)} did not answer with JSON`, 'DISCOVERY_FAILED', { cause: error });
  }
}

/**
 * Interrogate one provider endpoint for the models it advertises.
 * Uses the configured custom UA so UA-gated gateways answer correctly.
 */
export async function discoverModels(
  request: LlmModelDiscoveryRequest,
  gw: GatewayConfig,
  resolveApiKey: () => Promise<string>,
): Promise<LlmDiscoveredModel[]> {
  const baseURL = request.baseURL ?? gw.baseURL;
  if (baseURL === undefined || baseURL.length === 0) {
    throw new LlmError('llm-provider-hub: model discovery needs a baseURL; set it in the plugin settings', 'DISCOVERY_FAILED');
  }
  // The unified endpoint resolver: auto mode derives `{baseURL}/models` with
  // /v1 normalization; custom mode dials baseURL verbatim as the complete
  // models URL. Errors arrive redacted.
  const resolved = resolveEndpointUrl({ baseURL, endpointMode: gw.endpointMode }, '/models');
  if (!resolved.ok) {
    throw new LlmError(`llm-provider-hub: model discovery: ${resolved.error}`, 'DISCOVERY_FAILED');
  }
  const url = resolved.url;
  let supplied: string | undefined;
  try {
    supplied = request.apiKey ?? await resolveApiKey();
  } catch {
    supplied = undefined; // probe unauthenticated when no key resolves
  }
  // extraHeaders merge FIRST, sanitized (case-insensitive, same reserved set
  // as the adapter wire paths): credential/protocol/transport-critical names
  // are dropped BEFORE the authoritative values are set, so they can neither
  // override the protocol-correct auth below nor smuggle a cross-protocol
  // credential onto the wire (e.g. a stale Bearer on the anthropic path).
  const headers = sanitizeExtraHeaders(gw.extraHeaders);
  headers['accept'] = 'application/json';
  headers['user-agent'] = effectiveUserAgent(gw.userAgent);
  // Auth per the gateway's protocol: the Anthropic messages endpoint expects
  // x-api-key + anthropic-version (NOT Bearer); both OpenAI-family protocols
  // authorize with Bearer. Set last so extraHeaders cannot replace them.
  if (gw.api === 'anthropic-messages') {
    if (supplied !== undefined && supplied !== '') headers['x-api-key'] = supplied;
    headers['anthropic-version'] = '2023-06-01';
  } else if (supplied !== undefined && supplied !== '') {
    headers.authorization = `Bearer ${supplied}`;
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
  } catch (error) {
    if (request.signal?.aborted) throw new LlmError('model discovery aborted by caller', 'ABORTED', { cause: error });
    throw new LlmError(`could not reach ${redactUrl(url)}`, 'DISCOVERY_FAILED', { cause: error });
  }
  if (!response.ok) {
    throw new LlmError(
      `${redactUrl(url)} answered ${response.status}${response.status === 401 || response.status === 403 ? '; check the API key' : ''}`,
      'DISCOVERY_FAILED',
    );
  }
  const body = await readCappedJson(response, url);
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    throw new LlmError('the endpoint\'s model listing has no "data" array; add models by hand in the plugin settings', 'DISCOVERY_FAILED');
  }
  const models: LlmDiscoveredModel[] = [];
  const seen = new Set<string>();
  for (const raw of data) {
    const entry = raw as Record<string, unknown>;
    const id = label(entry.id);
    // Dedupe by id: gateways echo the same model under several billing tiers;
    // the first occurrence wins so the picker never lists one model twice.
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    models.push({
      id,
      ...(label(entry.name, entry.display_name) === undefined ? {} : { name: label(entry.name, entry.display_name) as string }),
      ...(capacity(entry.context_window, entry.context_length) === undefined ? {} : { contextWindow: capacity(entry.context_window, entry.context_length) as number }),
      ...(capacity(entry.max_output_tokens, entry.max_tokens) === undefined ? {} : { maxTokens: capacity(entry.max_output_tokens, entry.max_tokens) as number }),
    });
  }
  return models;
}
