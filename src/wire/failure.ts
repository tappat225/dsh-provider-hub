/**
 * Failure classification for the wire layer: every upstream / transport
 * failure this adapter can observe is mapped onto a DSH failure CODE the
 * host's retry executor can route on.
 *
 * Why this module exists. DSH splits request retry in three: the adapter
 * declares a policy (`LlmAdapter.providerRetryPolicy`), one `stream()` call
 * attempts the request exactly once and reports its outcome as a terminal
 * `finish` chunk carrying an `LlmFailure`, and a SEPARATE host plugin (the
 * retry executor) re-issues the failed step. The executor only acts on
 * failures whose `code` is a member of the route policy's `retryableCodes` —
 * under the default `normal` policy that set is EMPTY_RESPONSE, RATE_LIMIT,
 * SERVER, TIMEOUT and TRANSPORT. A failure reported under any other code is
 * delegated downstream and the turn ends right there, which is what forces the
 * user to nudge the conversation forward by hand. So the code is not
 * decoration: it is the only thing that decides whether a transient upstream
 * condition gets another attempt.
 *
 * This module is the single place the three wire protocols and the adapter's
 * POST path classify their failures, so every retryable condition reaches the
 * executor under a code it recognizes, and every NON-retryable condition keeps
 * a code that says so honestly.
 *
 * Deliberately NOT retryable — the identical request fails identically, so a
 * retry only burns wall-clock time: configuration faults (UNKNOWN_MODEL,
 * UNSUPPORTED_REASONING_EFFORT, INVALID_REQUEST, CONTEXT_WINDOW_EXCEEDED),
 * credential faults (AUTH, MISSING_CREDENTIAL, INVALID_CREDENTIAL) and
 * exhausted account quota (QUOTA).
 *
 * @module dsh-provider-hub/wire/failure
 */
import {
  CONTEXT_WINDOW_EXCEEDED_CODE,
  EMPTY_RESPONSE_CODE,
  QUOTA_EXCEEDED_CODE,
  errorChain,
  isContextWindowExceededError,
  isHarnessError,
  isQuotaExceededError,
  resolveRetryPolicy,
} from '@deepseek-ai/dsh-llm';
import type { ProviderErrorPayload } from '../types.ts';
import { redactUrlsInText } from '../url.ts';

/**
 * Canonical provider-neutral codes re-exported from the host, so callers reach
 * for one import site instead of mixing host constants with this module's.
 */
export { CONTEXT_WINDOW_EXCEEDED_CODE, EMPTY_RESPONSE_CODE, QUOTA_EXCEEDED_CODE } from '@deepseek-ai/dsh-llm';

/**
 * Blanket code for an upstream failure this adapter cannot classify further.
 * NOT in the default retryable set: guessing "transient" for an unknown
 * condition would retry deterministic failures five times over.
 */
export const UPSTREAM_ERROR_CODE = 'UPSTREAM_ERROR';

/** Transport-level failure (connection refused/reset, torn stream, DNS). Retryable. */
export const TRANSPORT_ERROR_CODE = 'TRANSPORT';

/** Request or stream timed out. Retryable. */
export const TIMEOUT_ERROR_CODE = 'TIMEOUT';

/** Upstream rate limit (HTTP 429 or its in-stream spelling). Retryable. */
export const RATE_LIMIT_ERROR_CODE = 'RATE_LIMIT';

/** Upstream server-side failure (5xx, overloaded, in-stream relay error). Retryable. */
export const SERVER_ERROR_CODE = 'SERVER';

/** Supplied credential was rejected (HTTP 401/403). Not retryable. */
export const AUTH_ERROR_CODE = 'AUTH';

/** Request itself was refused as malformed / unknown (400/404/413/422). Not retryable. */
export const INVALID_REQUEST_CODE = 'INVALID_REQUEST';

/** Caller cancellation — reported as an `aborted` finish, never an error. */
export const ABORTED_CODE = 'ABORTED';

/**
 * Largest provider-requested delay this adapter forwards on a failure.
 *
 * The executor treats an over-ceiling `providerRetryAfterMs` as "give up", not
 * as "wait longer": in `normal` mode a hint above the policy's `maxDelayMs`
 * abandons the retry entirely instead of falling back to local backoff. An
 * oversized upstream hint is therefore dropped rather than forwarded, so a
 * `Retry-After: 600` still gets the local exponential backoff. The ceiling is
 * read from the same default policy the adapter declares, so the two cannot
 * drift apart.
 */
const RETRY_AFTER_CAP_MS = resolveRetryPolicy(undefined, 'llm-provider-hub retryAfter cap').maxDelayMs;

/** Structured provider facts carried alongside a classified failure code. */
export interface FailureFacts {
  /** HTTP status observed at the provider boundary. */
  status?: number;
  /** Provider-requested delay, already capped to {@link RETRY_AFTER_CAP_MS}. */
  providerRetryAfterMs?: number;
}

/** A classified failure: the DSH routing code plus any structured facts. */
export interface ClassifiedFailure extends FailureFacts {
  code: string;
}

/** A classified failure that also carries its user-facing message. */
export interface ClassifiedError extends ClassifiedFailure {
  message: string;
}

/**
 * Drop a provider delay hint that cannot be honored. Non-positive or
 * non-finite values carry no information (local backoff schedules the wait);
 * values above the policy ceiling would make the executor abandon the retry.
 */
function usableRetryAfterMs(ms: number): number | undefined {
  if (!Number.isFinite(ms) || ms <= 0 || ms > RETRY_AFTER_CAP_MS) return undefined;
  return ms;
}

/**
 * Parse an upstream `Retry-After` header into milliseconds. Both RFC 9110
 * spellings are accepted: delay-seconds (`120`) and an HTTP-date
 * (`Wed, 21 Oct 2026 07:28:00 GMT`), the latter measured against `now`.
 * Unparseable values and hints above the retry ceiling yield `undefined`.
 */
export function parseRetryAfterMs(value: string | null | undefined, now: number = Date.now()): number | undefined {
  if (value === undefined || value === null) return undefined;
  const text = value.trim();
  if (text === '') return undefined;
  if (/^\d+$/.test(text)) return usableRetryAfterMs(Number(text) * 1000);
  const at = Date.parse(text);
  if (Number.isNaN(at)) return undefined;
  return usableRetryAfterMs(at - now);
}

/**
 * Classify an upstream HTTP status with the response body as supporting
 * detail. Body wording wins over the bare status where the two disagree:
 * providers report a context overflow or an exhausted quota under assorted
 * statuses (400, 403, 429), and both are non-retryable conditions that must
 * not be re-attempted just because the status looked transient.
 */
export function classifyHttpStatus(status: number, detail: string, retryAfterMs?: number): ClassifiedFailure {
  if (isContextWindowExceededError(detail)) return { code: CONTEXT_WINDOW_EXCEEDED_CODE, status };
  if (isQuotaExceededError(detail)) return { code: QUOTA_EXCEEDED_CODE, status };
  if (status === 401 || status === 403) return { code: AUTH_ERROR_CODE, status };
  // 408 Request Timeout and 425 Too Early are both "try again" time conditions.
  if (status === 408 || status === 425) return { code: TIMEOUT_ERROR_CODE, status };
  if (status === 429) {
    return { code: RATE_LIMIT_ERROR_CODE, status, ...(retryAfterMs === undefined ? {} : { providerRetryAfterMs: retryAfterMs }) };
  }
  if (status >= 500) return { code: SERVER_ERROR_CODE, status };
  if (status === 400 || status === 404 || status === 413 || status === 422) return { code: INVALID_REQUEST_CODE, status };
  return { code: UPSTREAM_ERROR_CODE, status };
}

/**
 * Classify failure WORDING when no status is available: a transport error
 * message, or an in-stream error whose code the map below does not know.
 * Returns `undefined` when nothing matches, so callers can apply their own
 * context-aware default instead of inheriting a blanket code.
 *
 * The order matters — quota and context wording is checked first because both
 * arrive under statuses and codes that would otherwise read as transient.
 */
export function classifyErrorText(detail: string): ClassifiedFailure | undefined {
  if (detail === '') return undefined;
  if (isContextWindowExceededError(detail)) return { code: CONTEXT_WINDOW_EXCEEDED_CODE };
  if (isQuotaExceededError(detail)) return { code: QUOTA_EXCEEDED_CODE };
  if (/\b(?:401|403)\b|unauthoriz|forbidden|invalid.?api.?key|authentication/i.test(detail)) return { code: AUTH_ERROR_CODE };
  if (/\b429\b|rate.?limit|too many requests/i.test(detail)) return { code: RATE_LIMIT_ERROR_CODE };
  if (/\b413\b|payload too large|request body too large/i.test(detail)) return { code: INVALID_REQUEST_CODE };
  if (/\b(?:400|404|422)\b|invalid.?request|malformed/i.test(detail)) return { code: INVALID_REQUEST_CODE };
  if (/\b5\d\d\b|overloaded|server.?error|internal.?error|bad.?gateway|service.?unavailable|upstream.?error|temporaril|too.?busy|try.?again/i.test(detail)) return { code: SERVER_ERROR_CODE };
  if (/time(?:d)?\s*out|timeout|\bETIMEDOUT\b|\bEAGAIN\b/i.test(detail)) return { code: TIMEOUT_ERROR_CODE };
  if (/stream ended (?:before|without)|ended prematurely|premature close|\bterminated\b|incomplete.?stream/i.test(detail)) return { code: TRANSPORT_ERROR_CODE };
  if (/\b(?:network|connection|socket|fetch|dns)\b|\bECONN[A-Z]+\b|\bENOTFOUND\b|\bEAI_AGAIN\b/i.test(detail)) return { code: TRANSPORT_ERROR_CODE };
  return undefined;
}

/**
 * Upstream-native error codes (an in-stream `error` event, a `response.failed`
 * payload, an `error.code` field) mapped onto DSH codes. Keys are compared
 * lowercased, so both `rate_limit_exceeded` and `RATE_LIMIT_EXCEEDED` resolve.
 *
 * The adapter's own blanket {@link UPSTREAM_ERROR_CODE} is deliberately absent
 * from the map: an UNCLASSIFIED failure must not be upgraded into a retryable
 * one just because it passed through here.
 */
const PROVIDER_ERROR_CODES: ReadonlyMap<string, string> = new Map(Object.entries({
  // rate limiting / capacity
  rate_limit: RATE_LIMIT_ERROR_CODE,
  rate_limit_exceeded: RATE_LIMIT_ERROR_CODE,
  rate_limits: RATE_LIMIT_ERROR_CODE,
  requests_rate_limit: RATE_LIMIT_ERROR_CODE,
  too_many_requests: RATE_LIMIT_ERROR_CODE,
  overloaded: SERVER_ERROR_CODE,
  overloaded_error: SERVER_ERROR_CODE,
  capacity: SERVER_ERROR_CODE,
  capacity_error: SERVER_ERROR_CODE,
  // server-side
  server_error: SERVER_ERROR_CODE,
  internal_error: SERVER_ERROR_CODE,
  internal_server_error: SERVER_ERROR_CODE,
  api_error: SERVER_ERROR_CODE,
  service_unavailable: SERVER_ERROR_CODE,
  upstream_connect_error: SERVER_ERROR_CODE,
  execution_error: SERVER_ERROR_CODE,
  // timeouts
  timeout: TIMEOUT_ERROR_CODE,
  timed_out: TIMEOUT_ERROR_CODE,
  request_timeout: TIMEOUT_ERROR_CODE,
  gateway_timeout: TIMEOUT_ERROR_CODE,
  // credentials
  authentication_error: AUTH_ERROR_CODE,
  invalid_api_key: AUTH_ERROR_CODE,
  invalid_credentials: AUTH_ERROR_CODE,
  permission_error: AUTH_ERROR_CODE,
  permission_denied: AUTH_ERROR_CODE,
  account_deactivated: AUTH_ERROR_CODE,
  // request faults (never fix themselves on a retry)
  invalid_request_error: INVALID_REQUEST_CODE,
  invalid_request: INVALID_REQUEST_CODE,
  invalid_parameter: INVALID_REQUEST_CODE,
  unsupported_value: INVALID_REQUEST_CODE,
  content_filter: INVALID_REQUEST_CODE,
  content_policy_violation: INVALID_REQUEST_CODE,
  context_length_exceeded: CONTEXT_WINDOW_EXCEEDED_CODE,
  context_window_exceeded: CONTEXT_WINDOW_EXCEEDED_CODE,
  string_above_max_length: CONTEXT_WINDOW_EXCEEDED_CODE,
  // quota / billing
  insufficient_quota: QUOTA_EXCEEDED_CODE,
  insufficient_balance: QUOTA_EXCEEDED_CODE,
  insufficient_funds: QUOTA_EXCEEDED_CODE,
  billing_hard_limit_reached: QUOTA_EXCEEDED_CODE,
  arrears: QUOTA_EXCEEDED_CODE,
  // degenerate completion
  empty_response: EMPTY_RESPONSE_CODE,
}));

/**
 * Classify an error the upstream reported INSIDE an already-accepted (HTTP
 * 200) stream: an SSE `error` event, a `response.failed` payload, or an
 * in-band `error` object on a chat chunk.
 *
 * Resolution order: the native code map, then the combined code/message
 * wording, then SERVER. That default is a judgement call — a stream the
 * gateway accepted and then failed while relaying is a transient relay
 * condition far more often than a deterministic rejection, and the
 * deterministic classes (auth, quota, context, content policy) are all caught
 * by the two steps above before the default applies.
 */
export function classifyProviderError(code: string | undefined, message: string): ClassifiedFailure {
  const normalized = code?.trim().toLowerCase() ?? '';
  const mapped = normalized === '' ? undefined : PROVIDER_ERROR_CODES.get(normalized);
  if (mapped !== undefined) return { code: mapped };
  const fromText = classifyErrorText([code ?? '', message].filter((part) => part !== '').join(' '));
  return fromText ?? { code: SERVER_ERROR_CODE };
}

/** Render one provider `code`/`type` field as classifier text ('' when absent). */
function providerCodeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/**
 * Classify one in-stream provider error payload.
 *
 * Providers nest the details inconsistently — OpenAI-compatible streams put
 * `message`/`type`/`code` at the top level, Anthropic one level down under
 * `error` — so both levels are read: the first non-empty message wins, and
 * every code/type string feeds the classifier. `raw` is the unparsed event
 * data, used as the message fallback so a payload with no readable message
 * still surfaces something diagnosable instead of an empty failure.
 */
export function classifyProviderErrorPayload(payload: ProviderErrorPayload, raw: string): ClassifiedError {
  const nested = payload.error;
  const message = [payload.message, nested?.message]
    .find((part): part is string => typeof part === 'string' && part.trim() !== '') ?? '';
  const code = [providerCodeText(payload.code), providerCodeText(nested?.code)].find((part) => part !== '') ?? '';
  const detail = [providerCodeText(payload.type), providerCodeText(nested?.type), message].filter((part) => part !== '').join(' ');
  const classified = classifyProviderError(code === '' ? undefined : code, detail);
  return {
    code: classified.code,
    message: message !== '' ? message : `the upstream reported an error inside the response stream: ${raw.slice(0, 300)}`,
  };
}

/**
 * Classify a value thrown while dialing or reading a stream. The rendered
 * message is the full `cause` chain, so transport wrappers like undici's
 * `TypeError: fetch failed` surface the underlying reason instead of masking
 * it. Callers check caller-cancellation (`signal.aborted`) FIRST and report an
 * aborted finish; this handles the rest.
 *
 * A failure the upstream already classified (an `LlmError` carrying its own
 * code) keeps that code — re-deriving one from its message would be a
 * downgrade.
 *
 * The rendered message is credential-redacted here, at the single choke point
 * every transport failure reaches: `fetch` echoes the request URL into its
 * message, and a gateway may be configured with its key embedded in that URL.
 */
export function classifyTransportError(error: unknown): ClassifiedError {
  if (isHarnessError(error)) {
    return { code: error.code, message: redactUrlsInText(error.message) };
  }
  const message = redactUrlsInText(errorChain(error));
  if (error instanceof Error && error.name === 'TimeoutError') return { code: TIMEOUT_ERROR_CODE, message };
  return { ...(classifyErrorText(message) ?? { code: TRANSPORT_ERROR_CODE }), message };
}

/**
 * Classify the end of a converted stream: `undefined` means the stream
 * completed honestly and the caller emits its normal finish kind.
 *
 * Two dishonest endings are turned into failures:
 *   - no output at all — a terminal stop with zero content blocks. Reporting
 *     it as `stop` would hand the loop an empty assistant message that
 *     silently ends the turn with nothing to act on; {@link EMPTY_RESPONSE_CODE}
 *     is the canonical classification and IS retryable, because the attempt
 *     produced nothing durable.
 *   - output that stops mid-flight — the protocol's own terminal marker
 *     (`[DONE]` / a `finish_reason`, `message_stop`, `response.completed`)
 *     never arrived, so the stream was cut. Reporting it as `stop` would
 *     present a truncated reply as complete; {@link TRANSPORT_ERROR_CODE} is
 *     retryable, and a retry restarts the whole turn rather than continuing a
 *     half-delivered one.
 *
 * @param sawTerminalEvent - whether the protocol's terminal marker arrived.
 * @param sawContent - whether any text / reasoning / tool-call block streamed.
 */
export function classifyStreamEnd(sawTerminalEvent: boolean, sawContent: boolean): ClassifiedError | undefined {
  if (!sawContent) {
    return { code: EMPTY_RESPONSE_CODE, message: 'the upstream closed the response without any model output' };
  }
  if (!sawTerminalEvent) {
    return { code: TRANSPORT_ERROR_CODE, message: 'the upstream response stream ended before its terminal event' };
  }
  return undefined;
}
