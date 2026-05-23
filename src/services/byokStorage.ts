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
  google: 'gemini-2.5-flash',
};

// Common models surfaced in the picker. Free-text override is also allowed.
export const SUGGESTED_MODELS: Record<Provider, string[]> = {
  anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
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
