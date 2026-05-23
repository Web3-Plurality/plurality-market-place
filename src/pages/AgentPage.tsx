import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Input, Select, Tag, Tooltip, message as antdMessage, Spin } from 'antd';
import {
  MdSmartToy,
  MdSend,
  MdKey,
  MdLink,
  MdLinkOff,
  MdSettings,
  MdExpandMore,
  MdExpandLess,
  MdBuild,
  MdRefresh,
} from 'react-icons/md';
import {
  PROVIDER_LABELS,
  SUGGESTED_MODELS,
  getModel,
  setModel,
  getProvider,
  setProvider,
  type Provider,
} from '../services/byokStorage';
import { ByokMcpClient } from '../services/byokMcpClient';
import { runTurn, type ChatMessage, type ToolTrace } from '../services/byokChat';
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

const StatusPill = styled.div<{ $ok: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  background: ${({ $ok }) => ($ok ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.05)')};
  color: ${({ $ok }) => ($ok ? '#34d399' : 'rgba(255, 255, 255, 0.55)')};
  border: 1px solid ${({ $ok }) => ($ok ? 'rgba(52, 211, 153, 0.35)' : 'rgba(255, 255, 255, 0.08)')};
`;

// ─── Settings Panel ───────────────────────────────────────────────────────

const SettingsCard = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(20, 22, 40, 0.55) 0%, rgba(12, 14, 28, 0.55) 100%);
`;

const SettingsToggle = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
`;

const SettingsBody = styled.div`
  padding: 0 16px 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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

// ─── Chat Panel ───────────────────────────────────────────────────────────

const ChatCard = styled.div`
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

const Empty = styled.div`
  margin: auto;
  text-align: center;
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
  max-width: 360px;
  line-height: 1.5;
`;

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
  const [settingsOpen, setSettingsOpen] = useState<boolean>(true);

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

    try {
      // Lazy MCP connect — first send eats the handshake (~0.5s); subsequent
      // sends reuse the cached client. Throws if PAT is invalid or MCP is
      // unreachable; we surface that as an error message in the chat.
      const mcp = await getOrCreateMcpClient(committedPat);
      const reply = await runTurn(provider, {
        apiKey,
        model,
        mcp,
        history,
        userMessage: text,
        focusedBucket,
      });
      setHistory([...newHistory, reply]);
    } catch (err) {
      console.error('[BYOK] Chat turn failed:', err);
      const errText = err instanceof Error ? err.message : 'Unknown error';
      antdMessage.error(errText);
      setHistory([...newHistory, { role: 'assistant', content: `Error: ${errText}` }]);
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

  const statusLabel = useMemo(() => {
    if (!apiKey) return 'Add an API key to start';
    if (!committedPat) return 'Add an MCP PAT to start';
    if (busy) return 'Working…';
    return 'Ready';
  }, [apiKey, committedPat, busy]);

  return (
    <Container>
      <Header>
        <TitleBlock>
          <Title>Talk to Memory</Title>
          <Subtitle>
            Paste your own LLM key (browser-only, never sent to our backend) and chat against your
            memory buckets through MCP.
          </Subtitle>
        </TitleBlock>
        <StatusPill $ok={ready}>
          {ready ? <MdLink size={14} /> : <MdLinkOff size={14} />}
          {statusLabel}
        </StatusPill>
      </Header>

      <SettingsCard>
        <SettingsToggle onClick={() => setSettingsOpen((v) => !v)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <MdSettings size={16} />
            Settings
          </span>
          {settingsOpen ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
        </SettingsToggle>
        {settingsOpen && (
          <SettingsBody>
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
                options={SUGGESTED_MODELS[provider].map((m) => ({ value: m, label: m }))}
              />
            </Field>
            <Field style={{ gridColumn: '1 / -1' }}>
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
                      : 'AIza…'
                }
              />
              <InlineHint>
                Kept in memory for this page session only. Never POSTed to the Plurality backend.
                Refresh = re-paste.
              </InlineHint>
            </Field>
            <Field style={{ gridColumn: '1 / -1' }}>
              <Label>
                <MdLink size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                MCP Personal Access Token
              </Label>
              <Input.Password
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
                onBlur={handlePatBlur}
                placeholder="plur_pat_…"
              />
              <InlineHint>
                Create one in the user menu (top-right) → <strong>API tokens</strong> → Generate
                new token. MCP endpoint: <code>{MCP_URL}</code>
              </InlineHint>
            </Field>
          </SettingsBody>
        )}
      </SettingsCard>
      <ChatCard>
        <ChatToolbar>
          <ChatToolbarLabel>Context:</ChatToolbarLabel>
          <Select
            value={focusedBucketId ?? ''}
            onChange={(v) => setFocusedBucketId(v ? v : null)}
            size="small"
            style={{ minWidth: 240 }}
            options={[
              { value: '', label: 'All buckets (auto-discover)' },
              ...buckets.map((b) => ({ value: b.id, label: b.profileName })),
            ]}
          />
          <Tooltip title="Refresh bucket list">
            <button
              type="button"
              onClick={() => void refreshBuckets()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: 'rgba(255,255,255,0.55)',
                cursor: 'pointer',
              }}
            >
              <MdRefresh size={16} />
            </button>
          </Tooltip>
          {focusedBucket && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              LLM is told to scope tool calls to this bucket
            </span>
          )}
        </ChatToolbar>
        <Messages>
          {history.length === 0 && !busy ? (
            <Empty>
              <MdSmartToy size={36} style={{ opacity: 0.5, marginBottom: 8 }} />
              <div>
                Configure provider + LLM key, then connect MCP (OAuth or PAT) above. Ask anything
                about your memory buckets.
              </div>
            </Empty>
          ) : (
            history.map((m, i) => (
              <div
                key={i}
                style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}
              >
                <Bubble $role={m.role}>{m.content}</Bubble>
                {m.trace && m.trace.length > 0 && <TraceView trace={m.trace} />}
              </div>
            ))
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
            placeholder={ready ? 'Ask about your memory buckets…' : 'Set provider + LLM key + MCP PAT to start'}
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
