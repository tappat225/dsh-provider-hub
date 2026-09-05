/**
 * Endpoint URL resolution with /v1 auto-normalization (mode `auto`) and
 * complete-address custom mode (mode `custom`), plus credential redaction for
 * error surfaces.
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

// ---------------------------------------------------------------------------
// Endpoint resolver: one function answers every request path the plugin dials
// (models discovery, chat completions, responses, anthropic messages) under
// either addressing mode a gateway may configure.
// ---------------------------------------------------------------------------

/**
 * Endpoint addressing mode.
 *
 *   - `auto` (default; stored configurations predating the field behave as
 *     auto): `baseURL` is an API root and every request path is derived from
 *     it with the /v1 auto-normalization of {@link joinEndpoint}.
 *   - `custom`: no path is ever appended and /v1 is never inserted — the
 *     user-filled complete URL IS the request address, used verbatim. The
 *     four request paths draw from two explicit fields so each address is
 *     unambiguous:
 *
 *       | request path        | custom-mode source                  |
 *       | ------------------- | ----------------------------------- |
 *       | models discovery    | `baseURL` = complete models URL     |
 *       | chat completions    | `endpoint` = complete request URL   |
 *       | responses           | `endpoint` = complete request URL   |
 *       | anthropic messages  | `endpoint` = complete request URL   |
 *
 *     `endpoint` is the chat-style request URL of whatever protocol the
 *     gateway's `api` names; `/models` keeps its own field because it is a
 *     different resource on every gateway.
 */
export type EndpointMode = 'auto' | 'custom';

/** The request paths the plugin dials (the resolver's second input). */
export type EndpointPath = '/chat/completions' | '/responses' | '/messages' | '/models';

/** The gateway fields the resolver reads (a GatewayConfig subset). */
export interface EndpointInputs {
  /** API root (auto) or complete models URL (custom). */
  baseURL?: string;
  /** Complete chat request URL (custom only; unused in auto). */
  endpoint?: string;
  /** Addressing mode; absent/unknown behaves as auto (backward compatibility). */
  endpointMode?: EndpointMode;
}

/** Either the resolved endpoint URL or a redacted, user-facing failure. */
export type EndpointResolution =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Normalize a possibly-absent/unknown mode value: anything but 'custom' is auto. */
export function effectiveEndpointMode(endpointMode: string | undefined): EndpointMode {
  return endpointMode === 'custom' ? 'custom' : 'auto';
}

/**
 * Validate one candidate endpoint URL for dialing. Returns the failure reason
 * or undefined when the URL is usable: it must parse, speak http(s), and carry
 * no control characters (the WHATWG URL parser silently strips CR/LF/tab, so
 * they are rejected BEFORE parsing — a header-injecting endpoint must fail
 * validation, not smuggle a newline past `fetch`).
 */
function validateEndpointUrl(raw: string): string | undefined {
  if (/[\r\n\t\x00-\x1f\u007f]/.test(raw)) return 'must not contain control characters or line breaks';
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return 'is not a valid URL';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'must use http or https';
  return undefined;
}

/**
 * Resolve the URL for one request path under the gateway's addressing mode.
 * Every wire path (chat completions / responses / messages / models) goes
 * through here, so invalid or dangerous URLs are refused in ONE place with a
 * redacted error (`redactUrl` strips embedded credentials) and custom mode can
 * never silently fall back to /v1 auto-completion.
 */
export function resolveEndpointUrl(inputs: EndpointInputs, path: EndpointPath): EndpointResolution {
  const mode = effectiveEndpointMode(inputs.endpointMode);
  if (mode === 'custom') {
    const source = path === '/models'
      ? 'baseURL (the complete model-listing URL)'
      : 'endpoint (the complete request URL)';
    const raw = path === '/models' ? (inputs.baseURL ?? '') : (inputs.endpoint ?? '');
    const url = raw.trim();
    if (url === '') {
      return { ok: false, error: `endpointMode "custom" requires ${source} to be set; no path or /v1 is appended automatically` };
    }
    const invalid = validateEndpointUrl(url);
    if (invalid !== undefined) return { ok: false, error: `${source} "${redactUrl(url)}" ${invalid}` };
    return { ok: true, url };
  }
  const base = (inputs.baseURL ?? '').trim();
  if (base === '') {
    return { ok: false, error: 'baseURL is required (endpointMode "auto" derives every request path from it)' };
  }
  const url = joinEndpoint(base, path);
  const invalid = validateEndpointUrl(url);
  if (invalid !== undefined) return { ok: false, error: `baseURL "${redactUrl(url)}" ${invalid}` };
  return { ok: true, url };
}

/**
 * Mask userinfo credentials (`https://user:secret@host/...`) in a URL for
 * error messages and diagnostics. Some gateways are configured with the API
 * key embedded in the URL; echoing the raw URL back in a failure message
 * would leak the credential into logs and the settings page.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username === '' && parsed.password === '') return url;
    if (parsed.username !== '') parsed.username = '***';
    if (parsed.password !== '') parsed.password = '***';
    return parsed.toString();
  } catch {
    return url; // not a parseable URL — return as-is (it never reached the wire)
  }
}

/**
 * Mask userinfo credentials in URLs quoted ANYWHERE inside a longer text — an
 * error message that renders a failed dial, or one link of a chained cause.
 * {@link redactUrl} handles a bare URL; this handles prose that repeats one
 * verbatim (`fetch` and undici both echo the request URL into their messages),
 * so a gateway configured with its key embedded in the URL cannot leak it into
 * a failure surface.
 */
export function redactUrlsInText(text: string): string {
  return text
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^/\s@]+)@/gi, '$1***:***@')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+)@/gi, '$1***@');
}
