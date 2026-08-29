/**
 * Model discovery: interrogate `GET {baseURL}/models` with the configured
 * custom User-Agent and map the OpenAI-compatible listing into
 * LlmDiscoveredModel entries. Operates on ONE gateway's config — the
 * plugin picks the gateway from the discovery request's baseURL first.
 *
 * @module dsh-provider-hub/discovery
 */
import { LlmError, type LlmDiscoveredModel, type LlmModelDiscoveryRequest } from '@deepseek-ai/dsh-llm';
import type { GatewayConfig } from './types.ts';

function listingUrl(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, '')}/models`;
}

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
  const url = listingUrl(baseURL);
  let supplied: string | undefined;
  try {
    supplied = request.apiKey ?? await resolveApiKey();
  } catch {
    supplied = undefined; // probe unauthenticated when no key resolves
  }
  const headers: Record<string, string> = {
    ...(gw.extraHeaders ?? {}),
    accept: 'application/json',
    'user-agent': gw.userAgent,
  };
  if (supplied !== undefined && supplied !== '') headers.authorization = `Bearer ${supplied}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
  } catch (error) {
    if (request.signal?.aborted) throw new LlmError('model discovery aborted by caller', 'ABORTED', { cause: error });
    throw new LlmError(`could not reach ${url}`, 'DISCOVERY_FAILED', { cause: error });
  }
  if (!response.ok) {
    throw new LlmError(
      `${url} answered ${response.status}${response.status === 401 || response.status === 403 ? '; check the API key' : ''}`,
      'DISCOVERY_FAILED',
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new LlmError(`${url} did not answer with JSON`, 'DISCOVERY_FAILED', { cause: error });
  }
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    throw new LlmError('the endpoint\'s model listing has no "data" array; add models by hand in the plugin settings', 'DISCOVERY_FAILED');
  }
  const models: LlmDiscoveredModel[] = [];
  for (const raw of data) {
    const entry = raw as Record<string, unknown>;
    const id = label(entry.id);
    if (id === undefined) continue;
    models.push({
      id,
      ...(label(entry.name, entry.display_name) === undefined ? {} : { name: label(entry.name, entry.display_name) as string }),
      ...(capacity(entry.context_window, entry.context_length) === undefined ? {} : { contextWindow: capacity(entry.context_window, entry.context_length) as number }),
      ...(capacity(entry.max_output_tokens, entry.max_tokens) === undefined ? {} : { maxTokens: capacity(entry.max_output_tokens, entry.max_tokens) as number }),
    });
  }
  return models;
}
