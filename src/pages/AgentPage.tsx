import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Input, Select, Tag, Tooltip, message as antdMessage, Spin } from 'antd';
import {
  MdSmartToy,
  MdSend,
  MdKey,
  MdLink,
  MdSettings,
  MdExpandMore,
  MdExpandLess,
  MdBuild,
  MdRefresh,
  MdClose,
  MdErrorOutline,
} from 'react-icons/md';
import {
  PROVIDER_LABELS,
  SUGGESTED_MODELS,
  DEFAULT_MODELS,
  getModel,
  setModel,
  getProvider,
  setProvider,
  type Provider,
} from '../services/byokStorage';
import { ByokMcpClient } from '../services/byokMcpClient';
import { runTurn, listGoogleModels, type ChatMessage, type ToolTrace } from '../services/byokChat';
import { describeMcpError, describeProviderError, type FriendlyError } from '../services/byokErrors';
import { listBuckets, type Bucket } from '../services/bucketApi';
import { MCP_URL } from '../utils/env';

// ─── Layout ───────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 960px;
  margin: 0 auto;
  height: calc(100vh - 140px);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin: 0;
`;

const Subtitle = styled.p`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  margin: 0;
`;

// ─── Chat Panel ───────────────────────────────────────────────────────────

const ChatCard = styled.div`
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(20, 22, 40, 0.55) 0%, rgba(12, 14, 28, 0.55) 100%);
  overflow: hidden;
  min-height: 360px;
`;

const ChatToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.18);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
`;

const ChatToolbarLabel = styled.span`
  font-weight: 500;
  letter-spacing: 0.3px;
`;

const ToolbarButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;

  &:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.06);
  }
`;

// Gear + status dot: settings live behind this button so they take no space
// when the user isn't configuring anything.
const GearButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid ${({ $active }) => ($active ? 'rgba(139, 92, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)')};
  background: ${({ $active }) => ($active ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.04)')};
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(99, 102, 241, 0.18);
    border-color: rgba(139, 92, 246, 0.5);
  }
`;

const StatusDot = styled.span<{ $ok: boolean }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ $ok }) => ($ok ? '#34d399' : '#fbbf24')};
  box-shadow: 0 0 6px ${({ $ok }) => ($ok ? 'rgba(52, 211, 153, 0.7)' : 'rgba(251, 191, 36, 0.7)')};
`;

// ─── Settings dropdown panel (anchored under the toolbar gear) ────────────

const SettingsPanel = styled.div`
  position: absolute;
  top: 46px;
  right: 12px;
  z-index: 20;
  width: 380px;
  max-width: calc(100% - 24px);
  padding: 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: linear-gradient(180deg, rgba(24, 26, 46, 0.98) 0%, rgba(14, 16, 32, 0.98) 100%);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
`;

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
`;

const InlineHint = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
`;

// ─── Messages ─────────────────────────────────────────────────────────────

const Messages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Bubble = styled.div<{ $role: 'user' | 'assistant' }>`
  align-self: ${({ $role }) => ($role === 'user' ? 'flex-end' : 'flex-start')};
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  background: ${({ $role }) =>
    $role === 'user'
      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.55), rgba(139, 92, 246, 0.55))'
      : 'rgba(255, 255, 255, 0.04)'};
  color: #fff;
  border: 1px solid ${({ $role }) =>
    $role === 'user' ? 'rgba(139, 92, 246, 0.35)' : 'rgba(255, 255, 255, 0.06)'};
`;

const TraceBlock = styled.div`
  align-self: flex-start;
  max-width: 78%;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
`;

const TraceHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
`;

const TraceItem = styled.div<{ $error?: boolean }>`
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  color: ${({ $error }) => ($error ? '#fca5a5' : 'inherit')};
`;

// ─── Failure notice (replaces the old raw "Error: …" bubble) ─────────────

const ErrorCard = styled.div`
  align-self: flex-start;
  max-width: 78%;
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: #fff;
  font-size: 13px;
  line-height: 1.5;
`;

const ErrorTitle = styled.div`
  font-weight: 700;
  color: #fca5a5;
  margin-bottom: 2px;
`;

const ErrorHint = styled.div`
  color: rgba(255, 255, 255, 0.78);
`;

const ErrorActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

const ErrorButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    border-color: rgba(139, 92, 246, 0.6);
    background: rgba(99, 102, 241, 0.18);
  }
`;

const ErrorDetails = styled.details`
  margin-top: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);

  summary {
    cursor: pointer;
    user-select: none;
  }

  pre {
    margin: 6px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.35);
    color: rgba(255, 255, 255, 0.65);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 160px;
    overflow: auto;
  }
`;

const InputRow = styled.div`
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
`;

const SendButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  color: #fff;
  cursor: pointer;
  transition: transform 0.15s ease;
  &:hover { transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

// ─── Welcoming empty state ────────────────────────────────────────────────

const Empty = styled.div`
  margin: auto;
  text-align: center;
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
  max-width: 420px;
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const EmptyIconWrap = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(236, 72, 153, 0.22));
  color: #c7d2fe;
  margin-bottom: 4px;
`;

const EmptyTitle = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: #fff;
`;

const SetupButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 22px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease;
  &:hover { transform: translateY(-1px); }
`;

const SuggestionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
`;

const SuggestionChip = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgba(139, 92, 246, 0.5);
    background: rgba(99, 102, 241, 0.15);
    color: #fff;
  }
`;

const SUGGESTIONS = [
  'What do you know about me?',
  'Summarize what’s in this bucket',
  'What did I save most recently?',
];

// Where to get a key, per provider — shown under the key input so people
// don't paste a key for the wrong Google product (a very common mistake).
const KEY_HINTS: Record<Provider, string> = {
  google: 'Gemini key from Google AI Studio (aistudio.google.com/app/apikey), starts with "AQ." (older keys: "AIza"). Not a Custom Search / Maps key.',
  anthropic: 'From console.anthropic.com → API keys, starts with "sk-ant-".',
  openai: 'From platform.openai.com → API keys, starts with "sk-".',
};

// ─── Component ─────────────────────────────────────────────────────────────

const AgentPage = () => {
  const [provider, setProviderState] = useState<Provider>(() => getProvider());
  const [model, setModelState] = useState<string>(() => getModel(getProvider()));
  // API key + PAT are intentionally NOT persisted. Both are session-scoped:
  // refresh = re-paste. See byokStorage.ts.
  const [apiKey, setApiKeyState] = useState<string>('');
  // PAT input is split into a live value (controlled input) and a "committed"
  // value (set on blur). Only the committed value drives the MCP connect
  // effect — without this split, every keystroke triggered a reconnect.
  const [patInput, setPatInput] = useState<string>('');
  const [committedPat, setCommittedPat] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  // Live model list for the pasted Google key. Google gates model
  // generations per account (older accounts keep gemini-2.x, newer ones get
  // "no longer available to new users"), so a static list can't be right for
  // everyone — we ask the API what this key can actually use. Stored with
  // the key it was fetched for, so a changed/cleared key naturally falls back
  // to SUGGESTED_MODELS without a synchronous reset in the effect.
  const [googleModels, setGoogleModels] = useState<{ key: string; models: string[] } | null>(null);

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [focusedBucketId, setFocusedBucketId] = useState<string | null>(null);

  // Cached MCP client + the token it was built with. We connect lazily on
  // the first Send so we don't fire speculative connects while the user is
  // still pasting credentials. Subsequent sends reuse the cached client.
  // Keyed by token: if the user pastes a new PAT, the cached client is torn
  // down and a fresh one is built on next send.
  const mcpRef = useRef<{ client: ByokMcpClient; token: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // "Ready" = credentials are populated. MCP connection is deferred until Send.
  const ready = !!apiKey && !!committedPat;

  // Persist non-secret preferences only.
  const handleProviderChange = useCallback((p: Provider) => {
    setProviderState(p);
    setProvider(p);
    setModelState(getModel(p));
    // Switching provider invalidates the previously-typed key — different
    // provider, different key shape. User has to re-paste.
    setApiKeyState('');
  }, []);

  const handleModelChange = useCallback(
    (m: string) => {
      setModelState(m);
      setModel(provider, m);
    },
    [provider],
  );

  // Fetch the Google model list once a plausible key is pasted (debounced so
  // we don't hit the API on every keystroke). If the currently selected model
  // isn't in the list, move to the first one the key can use.
  useEffect(() => {
    const key = apiKey.trim();
    if (provider !== 'google' || key.length < 20) return;
    let cancelled = false;
    const t = setTimeout(() => {
      listGoogleModels(key)
        .then((models) => {
          if (cancelled || models.length === 0) return;
          setGoogleModels({ key, models });
          if (!models.includes(model)) {
            const next = models.find((m) => m === DEFAULT_MODELS.google) ?? models[0];
            setModelState(next);
            setModel('google', next);
          }
        })
        .catch(() => {
          // Listing is best-effort; the static fallback list stays in place.
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // `model` is intentionally omitted: this effect reacts to key/provider
    // changes, not to the user picking a model from the list it produced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, apiKey]);

  const liveGoogleModels =
    provider === 'google' && googleModels && googleModels.key === apiKey.trim() ? googleModels.models : null;
  const modelOptions = liveGoogleModels ?? SUGGESTED_MODELS[provider];

  const handlePatBlur = useCallback(() => {
    const trimmed = patInput.trim();
    setCommittedPat(trimmed);
    // PAT changed → tear down the cached MCP client so next send rebuilds
    // with the new token. Fire-and-forget close (no need to await).
    if (mcpRef.current && mcpRef.current.token !== trimmed) {
      void mcpRef.current.client.close().catch(() => {});
      mcpRef.current = null;
    }
  }, [patInput]);

  // Tear down on unmount so we don't leak the MCP HTTP transport.
  useEffect(() => {
    return () => {
      const cached = mcpRef.current;
      mcpRef.current = null;
      if (cached) void cached.client.close().catch(() => {});
    };
  }, []);

  // Lazy MCP connect — called from send(). Reuses cached client when the
  // token hasn't changed; rebuilds on token change. Throws on failure so
  // send() can surface the error in chat.
  const getOrCreateMcpClient = useCallback(async (token: string): Promise<ByokMcpClient> => {
    if (mcpRef.current && mcpRef.current.token === token) {
      return mcpRef.current.client;
    }
    // Different token (or no cache yet). Close the stale one if any, then build fresh.
    if (mcpRef.current) {
      void mcpRef.current.client.close().catch(() => {});
      mcpRef.current = null;
    }
    const client = new ByokMcpClient(token);
    await client.connect();
    mcpRef.current = { client, token };
    return client;
  }, []);

  // Load the user's buckets so they can scope the chat to one. Refetched on
  // every tab visit (Routes unmounts/remounts) and on manual refresh click.
  //
  // includeMinted: the agent should be able to search every bucket the
  // wallet has access to — drafts you're still editing AND minted buckets
  // you still hold the NFT for (your own mints + anything purchased).
  // Buckets you sold disappear automatically because the wallet no longer
  // holds the NFT.
  const refreshBuckets = useCallback(async () => {
    try {
      const list = await listBuckets({ includeMinted: true });
      setBuckets(list);
      // No "All buckets" option anymore — default to the first bucket so the
      // dropdown is never empty. Only fill in when nothing is selected yet.
      setFocusedBucketId((cur) => cur ?? list[0]?.id ?? null);
    } catch (err) {
      console.error('[BYOK] Failed to load buckets:', err);
    }
  }, []);

  useEffect(() => {
    void refreshBuckets();
  }, [refreshBuckets]);

  const focusedBucket = useMemo<{ id: string; name: string } | null>(() => {
    if (!focusedBucketId) return null;
    const b = buckets.find((x) => x.id === focusedBucketId);
    return b ? { id: b.id, name: b.profileName } : null;
  }, [focusedBucketId, buckets]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, busy]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy || !ready || !committedPat) return;

    setDraft('');
    setBusy(true);

    const newHistory = [...history, { role: 'user' as const, content: text }];
    setHistory(newHistory);

    // Failure notices live in the chat for the user, but never go back to the
    // LLM as "assistant" turns — that would pollute its context.
    const llmHistory = history.filter((m) => !m.error);
    const fail = (friendly: FriendlyError) => {
      antdMessage.error(friendly.title);
      setHistory([...newHistory, { role: 'assistant', content: friendly.title, error: friendly }]);
    };

    try {
      // Lazy MCP connect — first send eats the handshake (~0.5s); subsequent
      // sends reuse the cached client. Throws if PAT is invalid or MCP is
      // unreachable. Handled separately from the LLM call so the notice can
      // point at the right fix (token vs. API key).
      let mcp;
      try {
        mcp = await getOrCreateMcpClient(committedPat);
      } catch (err) {
        console.error('[BYOK] MCP connect failed:', err);
        fail(describeMcpError(err));
        return;
      }

      try {
        const reply = await runTurn(provider, {
          apiKey,
          model,
          mcp,
          history: llmHistory,
          userMessage: text,
          focusedBucket,
        });
        setHistory([...newHistory, reply]);
      } catch (err) {
        console.error('[BYOK] Chat turn failed:', err);
        fail(describeProviderError(provider, model, err));
      }
    } finally {
      setBusy(false);
    }
  }, [draft, busy, ready, history, apiKey, model, provider, focusedBucket, committedPat, getOrCreateMcpClient]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <Container>
      <Header>
        <TitleBlock>
          <Title>Talk to Memory</Title>
          <Subtitle>
            Chat with everything you&rsquo;ve saved in your memory buckets. Your AI key stays in
            your browser — it&rsquo;s never sent to our servers.
          </Subtitle>
        </TitleBlock>
      </Header>

      <ChatCard>
        <ChatToolbar>
          <ChatToolbarLabel>Memory bucket:</ChatToolbarLabel>
          <Tooltip title="The chat searches and reads only this bucket">
            <Select
              value={focusedBucketId ?? undefined}
              onChange={(v) => setFocusedBucketId(v)}
              size="small"
              style={{ minWidth: 240 }}
              placeholder="Select a bucket"
              options={buckets.map((b) => ({ value: b.id, label: b.profileName }))}
            />
          </Tooltip>
          <Tooltip title="Refresh bucket list">
            <ToolbarButton type="button" onClick={() => void refreshBuckets()}>
              <MdRefresh size={16} />
            </ToolbarButton>
          </Tooltip>
          <Tooltip title={ready ? 'AI provider connected' : 'Setup needed — add your keys here'}>
            <GearButton $active={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}>
              <MdSettings size={14} />
              Settings
              <StatusDot $ok={ready} />
            </GearButton>
          </Tooltip>
        </ChatToolbar>

        {settingsOpen && (
          <SettingsPanel>
            <PanelHeader>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <MdSettings size={14} />
                AI provider setup
              </span>
              <ToolbarButton type="button" onClick={() => setSettingsOpen(false)}>
                <MdClose size={16} />
              </ToolbarButton>
            </PanelHeader>
            <FieldRow>
              <Field>
                <Label>Provider</Label>
                <Select
                  value={provider}
                  onChange={handleProviderChange}
                  options={(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => ({
                    value: p,
                    label: PROVIDER_LABELS[p],
                  }))}
                />
              </Field>
              <Field>
                <Label>Model</Label>
                <Select
                  value={model}
                  onChange={handleModelChange}
                  showSearch
                  options={modelOptions.map((m) => ({ value: m, label: m }))}
                />
              </Field>
            </FieldRow>
            <Field>
              <Label>
                <MdKey size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {PROVIDER_LABELS[provider]} API key
              </Label>
              <Input.Password
                value={apiKey}
                onChange={(e) => setApiKeyState(e.target.value)}
                placeholder={
                  provider === 'anthropic'
                    ? 'sk-ant-…'
                    : provider === 'openai'
                      ? 'sk-…'
                      : 'AQ.… (or AIza…)'
                }
              />
              <InlineHint>
                {KEY_HINTS[provider]} Stays in your browser for this visit only — never sent to our
                servers.
              </InlineHint>
            </Field>
            <Field>
              <Label>
                <MdLink size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Memory access token
              </Label>
              <Input.Password
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
                onBlur={handlePatBlur}
                placeholder="plur_pat_…"
              />
              <InlineHint>
                Create one in the user menu (top-right) → <strong>API tokens</strong>. Endpoint:{' '}
                <code>{MCP_URL}</code>
              </InlineHint>
            </Field>
          </SettingsPanel>
        )}

        <Messages>
          {history.length === 0 && !busy ? (
            <Empty>
              <EmptyIconWrap>
                <MdSmartToy size={32} />
              </EmptyIconWrap>
              <EmptyTitle>Talk to your memory</EmptyTitle>
              {ready ? (
                <>
                  <div>Pick a memory bucket above and ask anything — try one of these:</div>
                  <SuggestionRow>
                    {SUGGESTIONS.map((s) => (
                      <SuggestionChip key={s} onClick={() => setDraft(s)}>
                        {s}
                      </SuggestionChip>
                    ))}
                  </SuggestionRow>
                </>
              ) : (
                <>
                  <div>
                    A one-minute setup gets you chatting: choose your AI provider, paste its API
                    key, and add a memory access token.
                  </div>
                  <SetupButton onClick={() => setSettingsOpen(true)}>
                    <MdSettings size={16} />
                    Set up your keys
                  </SetupButton>
                </>
              )}
            </Empty>
          ) : (
            history.map((m, i) =>
              m.error ? (
                <ErrorCard key={i}>
                  <MdErrorOutline size={20} style={{ flexShrink: 0, marginTop: 1, color: '#fca5a5' }} />
                  <div style={{ minWidth: 0 }}>
                    <ErrorTitle>{m.error.title}</ErrorTitle>
                    <ErrorHint>{m.error.hint}</ErrorHint>
                    {m.error.action && (
                      <ErrorActions>
                        <ErrorButton onClick={() => setSettingsOpen(true)}>
                          <MdSettings size={14} />
                          {m.error.action === 'tokens' ? 'Open Settings (token)' : 'Open Settings'}
                        </ErrorButton>
                      </ErrorActions>
                    )}
                    {m.error.details && (
                      <ErrorDetails>
                        <summary>Technical details</summary>
                        <pre>{m.error.details}</pre>
                      </ErrorDetails>
                    )}
                  </div>
                </ErrorCard>
              ) : (
                <div
                  key={i}
                  style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}
                >
                  <Bubble $role={m.role}>{m.content}</Bubble>
                  {m.trace && m.trace.length > 0 && <TraceView trace={m.trace} />}
                </div>
              ),
            )
          )}
          {busy && (
            <div style={{ alignSelf: 'flex-start', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              <Spin size="small" /> Thinking…
            </div>
          )}
          <div ref={messagesEndRef} />
        </Messages>
        <InputRow>
          <Input.TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder={ready ? 'Ask about your memory buckets…' : 'Set up your keys (Settings, top right) to start chatting'}
            autoSize={{ minRows: 1, maxRows: 5 }}
            disabled={!ready || busy}
          />
          <SendButton onClick={send} disabled={!draft.trim() || !ready || busy}>
            <MdSend size={18} />
          </SendButton>
        </InputRow>
      </ChatCard>
    </Container>
  );
};

const TraceView = ({ trace }: { trace: ToolTrace[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <TraceBlock>
      <TraceHeader onClick={() => setOpen((v) => !v)} style={{ cursor: 'pointer' }}>
        <MdBuild size={12} />
        {trace.length} tool call{trace.length === 1 ? '' : 's'}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
          {trace.map((t, i) => (
            <Tag key={i} color={t.isError ? 'red' : 'blue'} style={{ margin: 0, fontSize: 10 }}>
              {t.name}
            </Tag>
          ))}
        </span>
        {open ? <MdExpandLess size={14} /> : <MdExpandMore size={14} />}
      </TraceHeader>
      {open &&
        trace.map((t, i) => (
          <TraceItem key={i} $error={t.isError}>
            <Tooltip title="Tool name">
              <strong>{t.name}</strong>
            </Tooltip>
            <div style={{ opacity: 0.7, fontSize: 11, marginTop: 2 }}>
              input: {JSON.stringify(t.input)}
            </div>
            <div style={{ opacity: 0.85, fontSize: 11, marginTop: 4, whiteSpace: 'pre-wrap' }}>
              {t.output.length > 400 ? `${t.output.slice(0, 400)}…` : t.output}
            </div>
          </TraceItem>
        ))}
    </TraceBlock>
  );
};

export default AgentPage;
