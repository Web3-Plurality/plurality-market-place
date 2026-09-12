/**
 * Talk-to-Memory storage. Holds NON-SECRET preferences only (provider +
 * model selection). API keys and MCP PATs are intentionally NOT persisted
 * — they live only in React state for the lifetime of the page. Refresh
 * = re-paste. This is the user's stated preference.
 *
 * The browser fires LLM calls directly to OpenAI / Anthropic / Google with
 * the user's own key; the backend never sees the key or the prompts.
 */

export type Provider = 'anthropic' | 'openai' | 'google';

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'OpenAI',
  google: 'Google Gemini',
};

// Curated default model per provider. Users can override.
export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-4o',
  // Google's own recommendation when it retired 2.5-flash for new accounts.
  google: 'gemini-3.6-flash',
};

// Common models surfaced in the picker. All of these accept image input;
// PDFs work on Anthropic, Google and OpenAI's 4o+/5 models. An unknown id
// simply yields a friendly "model not available" notice.
export const SUGGESTED_MODELS: Record<Provider, string[]> = {
  anthropic: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4o-mini'],
  google: ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-pro-latest', 'gemini-flash-latest'],
};

// Ids Google/others have retired for new accounts. A stored preference for
// one of these silently falls back to the provider default instead of
// failing every request with a 404.
const RETIRED_MODELS = /^(gemini-(1\.5|2\.0|2\.5)-|claude-3|gpt-4-turbo)/;

const PREFIX = 'plurality.byok.';
const modelStorageKey = (p: Provider) => `${PREFIX}model.${p}`;

// Non-secret preferences — safe to persist for UX.

export function getProvider(): Provider {
  const v = localStorage.getItem(`${PREFIX}provider`);
  if (v === 'anthropic' || v === 'openai' || v === 'google') return v;
  return 'anthropic';
}

export function setProvider(provider: Provider): void {
  localStorage.setItem(`${PREFIX}provider`, provider);
}

export function getModel(provider: Provider): string {
  const stored = localStorage.getItem(modelStorageKey(provider));
  if (!stored || RETIRED_MODELS.test(stored)) return DEFAULT_MODELS[provider];
  return stored;
}

export function setModel(provider: Provider, model: string): void {
  if (model) localStorage.setItem(modelStorageKey(provider), model);
  else localStorage.removeItem(modelStorageKey(provider));
}

// Defensive: clean up any stored secrets from earlier sessions on first
// import. Idempotent and cheap — runs once per page load.
try {
  for (const p of ['anthropic', 'openai', 'google']) {
    localStorage.removeItem(`${PREFIX}key.${p}`);
  }
  localStorage.removeItem(`${PREFIX}mcpToken`);
  localStorage.removeItem(`${PREFIX}oauth`);
} catch {
  // Non-browser env or quota issue — ignore.
}
