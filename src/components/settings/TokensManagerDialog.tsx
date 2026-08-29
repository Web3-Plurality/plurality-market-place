import { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  Modal,
  Input,
  Select,
  Tag,
  Tooltip,
  Spin,
  Popconfirm,
  message,
} from 'antd';
import {
  MdAdd,
  MdContentCopy,
  MdDelete,
  MdKey,
  MdArrowBack,
  MdWarning,
} from 'react-icons/md';
import {
  listPats,
  createPat,
  revokePat,
  type PatRow,
  type PatCreatedRecord,
  type CreatePatPayload,
} from '../../services/patApi';

interface Props {
  open: boolean;
  onClose: () => void;
}

type View = 'list' | 'create' | 'reveal';

// The MCP server only honours the catch-all `mcp:tools` scope — the finer
// read/write scopes exist in the backend's data model but grant nothing yet,
// so a token minted with only those would be rejected with 403. Don't expose
// a picker that can produce a token that doesn't work.
const DEFAULT_SCOPES: CreatePatPayload['scopes'] = ['mcp:tools'];

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'No expiration' },
];

// ─── Styled ────────────────────────────────────────────────────────────────

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 320px;
`;

const ListEmpty = styled.div`
  padding: 36px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
`;

const TokenList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TokenRow = styled.div<{ $inactive?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  opacity: ${({ $inactive }) => ($inactive ? 0.55 : 1)};
`;

const TokenInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const TokenName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TokenMeta = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const TokenPrefix = styled.code`
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(0, 0, 0, 0.35);
  padding: 1px 6px;
  border-radius: 4px;
`;

const IconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  &:hover { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const PrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const SecondaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  cursor: pointer;
  &:hover { color: #fff; border-color: rgba(255, 255, 255, 0.2); }
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const IntroNote = styled.div`
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.25);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  line-height: 1.55;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
`;

const Hint = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
`;

const NextSteps = styled.ol`
  margin: 0;
  padding: 12px 14px 12px 32px;
  border-radius: 10px;
  background: rgba(52, 211, 153, 0.06);
  border: 1px solid rgba(52, 211, 153, 0.25);
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  line-height: 1.6;

  li + li { margin-top: 4px; }
`;

const RevealBanner = styled.div`
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(250, 173, 20, 0.08);
  border: 1px solid rgba(250, 173, 20, 0.3);
  color: #fde68a;
  font-size: 12px;
  line-height: 1.5;
`;

const RevealValue = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  color: #c7d2fe;
  word-break: break-all;
`;

// ─── Component ─────────────────────────────────────────────────────────────

const TokensManagerDialog = ({ open, onClose }: Props) => {
  const [view, setView] = useState<View>('list');
  const [tokens, setTokens] = useState<PatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState<string>('30');

  // Reveal state (one-shot plaintext)
  const [created, setCreated] = useState<PatCreatedRecord | null>(null);

  const reset = useCallback(() => {
    setView('list');
    setName('');
    setExpiresIn('30');
    setCreated(null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listPats();
      setTokens(list);
    } catch (err) {
      console.error('[PAT] list failed:', err);
      message.error(err instanceof Error ? err.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
    else reset();
  }, [open, refresh, reset]);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      message.error('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreatePatPayload = {
        name: trimmed,
        scopes: DEFAULT_SCOPES,
        expiresIn: expiresIn === 'never' ? 'never' : parseInt(expiresIn, 10),
      };
      const record = await createPat(payload);
      setCreated(record);
      setView('reveal');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setSubmitting(false);
    }
  }, [name, expiresIn, refresh]);

  const handleRevoke = useCallback(
    async (id: string) => {
      setRevokingId(id);
      try {
        await revokePat(id);
        message.success('Token revoked');
        refresh();
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Failed to revoke token');
      } finally {
        setRevokingId(null);
      }
    },
    [refresh],
  );

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('Copied to clipboard');
    } catch {
      message.error('Copy failed — select and copy manually');
    }
  }, []);

  const title = useMemo(() => {
    if (view === 'create') return 'New API token';
    if (view === 'reveal') return 'Token created';
    return 'API tokens';
  }, [view]);

  return (
    <Modal
      open={open}
      onCancel={view === 'reveal' ? undefined : onClose}
      footer={null}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MdKey size={18} />
          {title}
        </span>
      }
      width={620}
      destroyOnHidden
      maskClosable={view !== 'reveal'}
      closable={view !== 'reveal'}
    >
      <Wrap>
        {view === 'list' && (
          <>
            <IntroNote>
              <MdKey size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                A token is like a password that lets an AI app read your memory buckets — the{' '}
                <b>Talk to Memory</b> chat on this site, or tools like Claude Code on your
                computer. Generate one, paste it into the app, and revoke it here anytime to cut
                that app&apos;s access.
              </div>
            </IntroNote>

            {loading ? (
              <ListEmpty>
                <Spin />
              </ListEmpty>
            ) : tokens.length === 0 ? (
              <ListEmpty>
                <div style={{ marginBottom: 14 }}>You don&apos;t have any tokens yet.</div>
                <PrimaryBtn onClick={() => setView('create')}>
                  <MdAdd size={16} />
                  Generate your first token
                </PrimaryBtn>
              </ListEmpty>
            ) : (
              <>
              <TopRow style={{ justifyContent: 'flex-end' }}>
                <PrimaryBtn onClick={() => setView('create')}>
                  <MdAdd size={16} />
                  Generate new token
                </PrimaryBtn>
              </TopRow>
              <TokenList>
                {tokens.map((t) => (
                  <TokenRow key={t.id} $inactive={t.status !== 'active'}>
                    <TokenInfo>
                      <TokenName>
                        {t.name}
                        {t.status !== 'active' && (
                          <Tag color={t.status === 'revoked' ? 'red' : 'default'} style={{ margin: 0 }}>
                            {t.status}
                          </Tag>
                        )}
                      </TokenName>
                      <TokenMeta>
                        <TokenPrefix>{t.tokenPrefix}…</TokenPrefix>
                        <span>Created {formatRelative(t.createdAt)}</span>
                        <span>
                          {t.lastUsedAt ? `Last used ${formatRelative(t.lastUsedAt)}` : 'Never used'}
                        </span>
                        <span>
                          {t.expiresAt ? `Expires ${formatAbsolute(t.expiresAt)}` : 'No expiration'}
                        </span>
                      </TokenMeta>
                    </TokenInfo>
                    {t.status === 'active' && (
                      <Popconfirm
                        title="Revoke this token?"
                        description="Any client using it will lose access immediately."
                        okText="Revoke"
                        okButtonProps={{ danger: true }}
                        cancelText="Cancel"
                        onConfirm={() => handleRevoke(t.id)}
                      >
                        <Tooltip title="Revoke">
                          <IconBtn disabled={revokingId === t.id}>
                            <MdDelete size={16} />
                          </IconBtn>
                        </Tooltip>
                      </Popconfirm>
                    )}
                  </TokenRow>
                ))}
              </TokenList>
              </>
            )}
          </>
        )}

        {view === 'create' && (
          <>
            <SecondaryBtn onClick={() => setView('list')} style={{ alignSelf: 'flex-start' }}>
              <MdArrowBack size={14} />
              Back
            </SecondaryBtn>

            <Field>
              <Label>Where will you use this token?</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Talk to Memory, or Claude Code on my laptop"
                maxLength={100}
                autoFocus
              />
              <Hint>Just a label so you can recognise it in the list later.</Hint>
            </Field>

            <Field>
              <Label>Stops working after</Label>
              <Select
                value={expiresIn}
                onChange={setExpiresIn}
                options={EXPIRY_OPTIONS}
              />
              <Hint>Shorter is safer. You can always revoke a token early, or make a new one.</Hint>
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <SecondaryBtn onClick={() => setView('list')}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={handleCreate} disabled={submitting || !name.trim()}>
                {submitting ? 'Generating…' : 'Generate token'}
              </PrimaryBtn>
            </div>
          </>
        )}

        {view === 'reveal' && created && (
          <>
            <RevealBanner>
              <MdWarning size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>This is the only time you&apos;ll see this token.</strong>
                <br />
                Copy it now and store it somewhere safe (a password manager, your MCP client
                config). If you lose it, you&apos;ll need to revoke and create a new one.
              </div>
            </RevealBanner>

            <Field>
              <Label>{created.name}</Label>
              <RevealValue>
                <span style={{ flex: 1 }}>{created.token}</span>
                <Tooltip title="Copy to clipboard">
                  <IconBtn onClick={() => handleCopy(created.token)}>
                    <MdContentCopy size={16} />
                  </IconBtn>
                </Tooltip>
              </RevealValue>
              <Hint>
                {created.expiresAt
                  ? `Stops working ${formatAbsolute(created.expiresAt)}`
                  : 'Never expires'}
              </Hint>
            </Field>

            <Field>
              <Label>What to do with it</Label>
              <NextSteps>
                <li>Copy the token above.</li>
                <li>
                  <b>Talk to Memory</b> (on this site): open the chat → <b>Settings</b> → paste it
                  into <b>Memory access token</b>.
                </li>
                <li>
                  <b>Claude Code / Cursor / other MCP apps</b>: add this site&apos;s MCP endpoint and
                  use the token as the <code>Bearer</code> authorization value.
                </li>
              </NextSteps>
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PrimaryBtn onClick={() => setView('list')}>Done</PrimaryBtn>
            </div>
          </>
        )}
      </Wrap>
    </Modal>
  );
};

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatAbsolute(iso);
}

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default TokensManagerDialog;
