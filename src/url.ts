/**
 * Endpoint URL joining with /v1 auto-normalization.
 *
 * The two wire protocols the plugin speaks carry different conventions:
 * OpenAI-compatible gateways live under an API root that INCLUDES the version
 * segment (`https://api.openai.com/v1` + `/chat/completions`), while Anthropic
 * uses a bare host root (`https://api.anthropic.com` + `/v1/messages`). The
 * official pi-llm provider stores the fully-versioned root per route; our
 * settings page exposes one free-form baseURL, so both spellings must work:
 *
 *   `https://gw.example.com`     -> .../v1/chat/completions  .../v1/models
 *   `https://gw.example.com/v1`  -> .../chat/completions     .../models
 *
 * Rule: a base ending in `/vN` is already the API root (append the path as
 * is); anything else gets `/v1` inserted. Deployment sub-paths such as
 * `https://gateway.example/openai/v1` keep every segment.
 *
 * @module dsh-provider-hub/url
 */

/** Join a version-free endpoint path (e.g. `/chat/completions`, `/models`) onto a user-supplied baseURL. */
export function joinEndpoint(baseURL: string, path: string): string {
  const base = baseURL.trim().replace(/\/+$/, '');
  const rooted = /\/v\d+$/.test(base);
  return `${base}${rooted ? '' : '/v1'}${path}`;
}
