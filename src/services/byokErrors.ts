/**
 * Turns raw provider / MCP failures into something a non-technical user can
 * act on. Provider SDKs throw verbose messages (Google in particular dumps a
 * JSON blob with the request URL); we keep that as collapsible "details" and
 * lead with a plain-language title + what-to-do hint.
 */

import { APICallError } from 'ai';
import { PROVIDER_LABELS, type Provider } from './byokStorage';

export interface FriendlyError {
  title: string;
  hint: string;
  /** Raw error text, trimmed. Shown behind a "Technical details" toggle. */
  details: string;
  /** Which settings surface fixes it, if any. */
  action?: 'settings' | 'tokens';
}

const KEY_HELP: Record<Provider, string> = {
  google:
    'Use a Gemini API key from Google AI Studio (aistudio.google.com/app/apikey). It starts with "AIza". ' +
    'A Google Cloud key made for another service (Custom Search, Maps, …) will not work here.',
  anthropic: 'Get a key from console.anthropic.com → API keys. It starts with "sk-ant-".',
  openai: 'Get a key from platform.openai.com → API keys. It starts with "sk-".',
};

function rawText(err: unknown): string {
  // AI SDK provider failures: the message is generic, the useful bit
  // ("API key not valid", "model not found") is in the response body.
  if (APICallError.isInstance(err)) {
    return [err.message, err.responseBody].filter(Boolean).join(' ');
  }
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function statusOf(err: unknown, text: string): number | null {
  if (APICallError.isInstance(err) && typeof err.statusCode === 'number') return err.statusCode;
  const e = err as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } } | null;
  const candidates = [e?.status, e?.statusCode, e?.response?.status];
  for (const c of candidates) {
    if (typeof c === 'number') return c;
  }
  // Google SDK: "[400 ] API key not valid…"; fetch wrappers: "HTTP 401".
  const m = text.match(/\[(\d{3})\s*\]|\bHTTP\s+(\d{3})\b|\b(4\d\d|5\d\d)\b/);
  if (m) return parseInt(m[1] || m[2] || m[3], 10);
  return null;
}

function trim(text: string, max = 700): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** MCP connect / tool-listing failures — the memory side, not the LLM. */
export function describeMcpError(err: unknown): FriendlyError {
  const text = rawText(err);
  const status = statusOf(err, text);
  const details = trim(text);

  // Memory access tokens are minted automatically and retried once on 401
  // before we get here, so a persistent 401/403 means the login session
  // itself is gone (logged out elsewhere, cookie expired).
  if (
    status === 401 ||
    status === 403 ||
    /not_a_pat|unauthori[sz]ed|insufficient_scope|invalid.*token|token.*(invalid|expired|revoked)/i.test(text)
  ) {
    return {
      title: 'Your chat session has expired',
      hint: 'Access is refreshed automatically, but this time it failed. Log out and back in, then try again.',
      details,
    };
  }
  if (/auto_pat_rate_limited|too many chat sessions/i.test(text)) {
    return {
      title: 'Too many chat sessions started at once',
      hint: 'Wait a minute and try again.',
      details,
    };
  }
  if (status === 502 || /pat_verify_failed/i.test(text)) {
    return {
      title: "The memory server couldn't verify your token right now",
      hint: 'This is on our side, not yours. Wait a moment and try again.',
      details,
    };
  }
  if (/failed to fetch|networkerror|network request failed|ECONN|CORS|load failed/i.test(text)) {
    return {
      title: "Couldn't reach your memory server",
      hint: 'Check your internet connection and try again. If you are on a VPN or ad-blocker, it may be blocking the request.',
      details,
    };
  }
  return {
    title: "Couldn't connect to your memory",
    hint: 'Try again in a moment. If it keeps failing, log out and back in.',
    details,
  };
}

/** LLM provider failures — key, quota, model, network. */
export function describeProviderError(provider: Provider, model: string, err: unknown): FriendlyError {
  const label = PROVIDER_LABELS[provider];
  const text = rawText(err);
  const status = statusOf(err, text);
  const details = trim(text);

  const looksLikeBadKey =
    /API key not valid|API_KEY_INVALID|invalid api key|invalid_api_key|incorrect api key|authentication_error|invalid x-api-key|no api key/i.test(
      text,
    ) || status === 401;
  if (looksLikeBadKey) {
    return {
      title: `Your ${label} API key was rejected`,
      hint: `${KEY_HELP[provider]} Then paste it again in Settings.`,
      details,
      action: 'settings',
    };
  }

  if (status === 429 || /rate limit|quota|RESOURCE_EXHAUSTED|insufficient_quota|billing/i.test(text)) {
    return {
      title: `${label} says you've hit a rate limit or quota`,
      hint: 'Wait a minute and try again, or check the usage / billing page of your provider account.',
      details,
    };
  }

  if (status === 403 || /PERMISSION_DENIED|permission denied|SERVICE_BLOCKED|has not been used|is not enabled/i.test(text)) {
    return {
      title: `Your ${label} key isn't allowed to use this model`,
      hint: `The key exists, but this API isn't enabled or is restricted for it. ${KEY_HELP[provider]}`,
      details,
      action: 'settings',
    };
  }

  if (
    status === 404 ||
    /not found|NOT_FOUND|no longer available|model.*(not (found|supported|exist)|unavailable)|does not exist/i.test(text)
  ) {
    // Google's retirement notice names the replacement ("use models/gemini-3.6-flash").
    const suggested = text.match(/use models\/([\w.-]+)/i)?.[1];
    return {
      title: `The model "${model}" isn't available for your key`,
      hint: suggested
        ? `${label} has retired it. Pick "${suggested}" (their suggestion) or another model in Settings.`
        : 'Pick a different model in Settings. Some models need a paid tier or a newer API version.',
      details,
      action: 'settings',
    };
  }

  if (status === 503 || status === 529 || /overloaded|UNAVAILABLE|temporarily/i.test(text)) {
    return {
      title: `${label} is overloaded right now`,
      hint: 'Nothing to fix on your side. Try again in a few seconds.',
      details,
    };
  }

  if (/failed to fetch|networkerror|network request failed|ECONN|CORS|load failed/i.test(text)) {
    return {
      title: `Couldn't reach ${label}`,
      hint: 'Check your internet connection. Ad-blockers and some corporate networks block calls to AI providers from the browser.',
      details,
    };
  }

  return {
    title: `Something went wrong talking to ${label}`,
    hint: 'Try again. If it keeps happening, the technical details below may help.',
    details,
  };
}
