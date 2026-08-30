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
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  google: 'gemini-3.6-flash',
};

// Fallback models surfaced in the picker when the provider's live model list
// isn't available (no key pasted yet, or the list call failed).
//
// Google gates older generations per account: accounts created after the
// mid-2026 key migration get "no longer available to new users" (404) for
// gemini-2.x, so only 3.x models are listed here. The picker prefers the
// live list from listGoogleModels() when a key is present.
export const SUGGESTED_MODELS: Record<Provider, string[]> = {
  anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  google: ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash'],
};

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
  return localStorage.getItem(modelStorageKey(provider)) || DEFAULT_MODELS[provider];
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
