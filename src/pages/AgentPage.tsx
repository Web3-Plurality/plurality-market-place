import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Input, Modal, Select, Tooltip, message as antdMessage, Spin } from 'antd';
import {
  MdSmartToy,
  MdSend,
  MdKey,
  MdSettings,
  MdClose,
  MdErrorOutline,
  MdAttachFile,
  MdStop,
  MdInsertDriveFile,
  MdAutoAwesome,
} from 'react-icons/md';
import type { MCPClient } from '@ai-sdk/mcp';
import {
  PROVIDER_LABELS,
  SUGGESTED_MODELS,
  getModel,
  setModel,
  getProvider,
  setProvider,
  type Provider,
} from '../services/byokStorage';
import {
  runTurn,
  connectMcp,
  isTextLike,
  type ChatMessage,
  type Attachment,
  type TurnTiming,
} from '../services/byokAgent';
import { describeMcpError, describeProviderError, type FriendlyError } from '../services/byokErrors';
import { listBuckets, getSkill, type Bucket, type SkillRecord } from '../services/bucketApi';
import { mintAutoPat } from '../services/patApi';

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

const ChatCard = styled.div<{ $dragging: boolean }>`
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ $dragging }) => ($dragging ? 'rgba(139, 92, 246, 0.8)' : 'rgba(255, 255, 255, 0.08)')};
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(20, 22, 40, 0.55) 0%, rgba(12, 14, 28, 0.55) 100%);
  overflow: hidden;
  min-height: 360px;
  transition: border-color 0.15s ease;
`;

const DropOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(99, 102, 241, 0.18);
  backdrop-filter: blur(2px);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  pointer-events: none;
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

// Which Skill the chat is running: the bucket's custom one (accent) or the
// built-in default assistant (muted).
const SkillChip = styled.span<{ $custom: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 260px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid ${({ $custom }) => ($custom ? 'rgba(139, 92, 246, 0.45)' : 'rgba(255, 255, 255, 0.1)')};
  background: ${({ $custom }) => ($custom ? 'rgba(139, 92, 246, 0.14)' : 'rgba(255, 255, 255, 0.04)')};
  color: ${({ $custom }) => ($custom ? '#c4b5fd' : 'rgba(255, 255, 255, 0.55)')};
  font-size: 11px;
  font-weight: ${({ $custom }) => ($custom ? 600 : 500)};
  white-space: nowrap;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
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

// ─── Settings modal fields ────────────────────────────────────────────────

const SettingsBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
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

const Turn = styled.div<{ $role: 'user' | 'assistant' }>`
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: ${({ $role }) => ($role === 'user' ? 'flex-end' : 'flex-start')};
`;

const Bubble = styled.div<{ $role: 'user' | 'assistant' }>`
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  background: ${({ $role }) =>
    $role === 'user'
      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.55), rgba(139, 92, 246, 0.55))'
      : 'rgba(255, 255, 255, 0.04)'};
  color: #fff;
  border: 1px solid ${({ $role }) =>
    $role === 'user' ? 'rgba(139, 92, 246, 0.35)' : 'rgba(255, 255, 255, 0.06)'};

  a {
    color: #c7d2fe;
    text-decoration: underline;
  }
`;

const Cursor = styled.span`
  display: inline-block;
  width: 7px;
  height: 14px;
  margin-left: 2px;
  vertical-align: -2px;
  background: rgba(255, 255, 255, 0.7);
  animation: blink 1s steps(2) infinite;

  @keyframes blink {
    to { opacity: 0; }
  }
`;

const LiveTools = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
`;

// ─── Attachments ──────────────────────────────────────────────────────────

const AttachmentRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const AttachmentChip = styled.div<{ $inBubble?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 6px;
  border-radius: 10px;
  background: ${({ $inBubble }) => ($inBubble ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.05)')};
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  max-width: 260px;
`;

const ChipThumb = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
`;

const ChipIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.2);
  color: #c7d2fe;
  flex-shrink: 0;
`;

const ChipName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ChipMeta = styled.span`
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
  flex-shrink: 0;
`;

const ChipRemove = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  flex-shrink: 0;
  &:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
`;

const PendingAttachments = styled.div`
  padding: 10px 12px 0;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
`;

// ─── Failure notice ───────────────────────────────────────────────────────

const ErrorCard = styled.div`
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

// ─── Input ────────────────────────────────────────────────────────────────

const InputRow = styled.div`
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
`;

const InputFrame = styled.div<{ $hasAttachments: boolean }>`
  border-top: ${({ $hasAttachments }) => ($hasAttachments ? 'none' : '1px solid rgba(255, 255, 255, 0.08)')};
`;

const RoundButton = styled.button<{ $primary?: boolean; $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  border: ${({ $primary, $danger }) => ($primary || $danger ? 'none' : '1px solid rgba(255, 255, 255, 0.12)')};
  border-radius: 10px;
  background: ${({ $primary, $danger }) =>
    $danger
      ? 'linear-gradient(135deg, #ef4444, #f97316)'
      : $primary
        ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)'
        : 'rgba(255, 255, 255, 0.04)'};
  color: ${({ $primary, $danger }) => ($primary || $danger ? '#fff' : 'rgba(255, 255, 255, 0.7)')};
  cursor: pointer;
  transition: transform 0.15s ease, color 0.15s ease;
  &:hover { transform: translateY(-1px); color: #fff; }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const HiddenFile = styled.input.attrs({ type: 'file', multiple: true })`
  display: none;
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

// ─── Constants / helpers ─────────────────────────────────────────────────

// MCP transport errors carry the HTTP status in their message; 401 is the
// only one worth an automatic retry (expired / revoked auto token).
function isUnauthorized(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return /\b401\b|unauthori[sz]ed|invalid_pat|expired|revoked|not_a_pat/i.test(text);
}

const SUGGESTIONS = [
  'What do you know about me?',
  'Summarize what is in this memory',
  'What did I save most recently?',
];

// Where to get a key, per provider. Shown under the key input so people
// don't paste a key for the wrong Google product (a very common mistake).
const KEY_HINTS: Record<Provider, string> = {
  google: 'Gemini key from Google AI Studio (aistudio.google.com/app/apikey), starts with "AIza". Not a Custom Search or Maps key.',
  anthropic: 'From console.anthropic.com, API keys section. Starts with "sk-ant-".',
  openai: 'From platform.openai.com, API keys section. Starts with "sk-".',
};

const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_MAX_COUNT = 6;
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf,text/*,.md,.markdown,.json,.csv,.txt';

// Browsers leave `File.type` empty for some extensions (notably .md).
const EXT_MEDIA: Record<string, string> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  yaml: 'application/yaml',
  yml: 'application/yaml',
};

function resolveMediaType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return EXT_MEDIA[ext] || '';
}

function isSupported(mediaType: string): boolean {
  return mediaType.startsWith('image/') || mediaType === 'application/pdf' || isTextLike(mediaType);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToAttachment(file: File): Promise<Attachment> {
  const mediaType = resolveMediaType(file);
  const data = new Uint8Array(await file.arrayBuffer());
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    mediaType,
    size: file.size,
    data,
    previewUrl: mediaType.startsWith('image/') ? URL.createObjectURL(file) : undefined,
  };
}

// The model is asked for plain conversational text, but models slip. Strip
// the common Markdown markers so a stray "**" or "##" never shows up raw,
// and keep the reply looking like a normal chat message.
function toPlainChat(text: string): string {
  return text
    .replace(/```[a-zA-Z0-9_-]*\n?/g, '') // code fences: keep the code, drop the fence
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1') // inline code
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)') // [text](url)
    .replace(/^\s*[-*+]\s+/gm, '• ') // bullet lists
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/\s*—\s*/g, ', ') // em dashes (house style)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const URL_SPLIT = /(https?:\/\/[^\s<>)]+)/g;

// Plain text with clickable links. No Markdown engine on purpose.
const PlainText = ({ text }: { text: string }) => (
  <>
    {text.split(URL_SPLIT).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      ),
    )}
  </>
);

// ─── Component ─────────────────────────────────────────────────────────────

const AgentPage = () => {
  const [provider, setProviderState] = useState<Provider>(() => getProvider());
  const [model, setModelState] = useState<string>(() => getModel(getProvider()));
  // API key is intentionally NOT persisted: session-scoped, refresh means
  // re-paste. See byokStorage.ts.
  const [apiKey, setApiKeyState] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // Memory access token is minted automatically for the signed-in wallet
  // (1h TTL, revoked on logout / re-mint). Memory only, never persisted,
  // so a page reload simply mints a fresh one.
  const autoPatRef = useRef<{ token: string; expiresAt: number } | null>(null);

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [liveTools, setLiveTools] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [focusedBucketId, setFocusedBucketId] = useState<string | null>(null);

  // Cached MCP client + the token it was built with. Connected lazily on
  // the first Send; rebuilt when the auto token rotates.
  const mcpRef = useRef<{ client: MCPClient; token: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Streaming deltas arrive many times per second. Batching them into one
  // state update per animation frame keeps the page responsive: without it,
  // every token re-rendered the whole message list and triggered a scroll.
  const pendingDeltaRef = useRef('');
  const flushRef = useRef<number | null>(null);
  const pushDelta = useCallback((delta: string) => {
    pendingDeltaRef.current += delta;
    if (flushRef.current !== null) return;
    flushRef.current = window.requestAnimationFrame(() => {
      flushRef.current = null;
      const chunk = pendingDeltaRef.current;
      pendingDeltaRef.current = '';
      if (chunk) setStreamingText((t) => t + chunk);
    });
  }, []);
  const cancelPendingFlush = useCallback(() => {
    if (flushRef.current !== null) {
      window.cancelAnimationFrame(flushRef.current);
      flushRef.current = null;
    }
    const tail = pendingDeltaRef.current;
    pendingDeltaRef.current = '';
    return tail;
  }, []);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);

  // "Ready" = an LLM key is present. Memory access + MCP connection are
  // handled lazily on the first Send.
  const ready = !!apiKey;

  // Persist non-secret preferences only.
  const handleProviderChange = useCallback((p: Provider) => {
    setProviderState(p);
    setProvider(p);
    setModelState(getModel(p));
    // Switching provider invalidates the previously-typed key: different
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

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    if (apiKey.trim()) antdMessage.success('Saved for this session');
  }, [apiKey]);
  // Stable reference so memoised message rows don't re-render on every keystroke.
  const openSettings = useCallback(() => setSettingsOpen(true), []);

  // Tear down on unmount: MCP transport, in-flight stream, thumbnail URLs.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      const cached = mcpRef.current;
      mcpRef.current = null;
      if (cached) void cached.client.close().catch(() => {});
    };
  }, []);

  // Returns a valid auto token, minting a new one when there is none, when
  // the cached one is within a minute of expiry, or when forced (after a 401).
  const getAutoToken = useCallback(async (forceFresh = false): Promise<string> => {
    const cached = autoPatRef.current;
    if (!forceFresh && cached && cached.expiresAt - Date.now() > 60_000) {
      return cached.token;
    }
    const minted = await mintAutoPat();
    autoPatRef.current = { token: minted.token, expiresAt: new Date(minted.expiresAt).getTime() };
    return minted.token;
  }, []);

  // Lazy MCP connect, called from send(). Reuses the cached client while the
  // token is unchanged; rebuilds when the token rotates. Throws on failure so
  // send() can surface the error in chat.
  const getOrCreateMcpClient = useCallback(
    async (forceFreshToken = false): Promise<MCPClient> => {
      const token = await getAutoToken(forceFreshToken);
      if (mcpRef.current && mcpRef.current.token === token) {
        return mcpRef.current.client;
      }
      if (mcpRef.current) {
        void mcpRef.current.client.close().catch(() => {});
        mcpRef.current = null;
      }
      const client = await connectMcp(token);
      mcpRef.current = { client, token };
      return client;
    },
    [getAutoToken],
  );

  // Load the user's buckets so they can scope the chat to one. Fetched on
  // mount and every time the picker is opened, so new buckets show up
  // without a manual refresh.
  //
  // includeMinted: the agent should be able to search every bucket the
  // wallet has access to: drafts you're still editing AND minted buckets
  // you still hold the NFT for (your own mints + anything purchased).
  const refreshBuckets = useCallback(async () => {
    try {
      const list = await listBuckets({ includeMinted: true });
      setBuckets(list);
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

  // The focused bucket's Skill (instructions + memory index) drives the
  // system prompt. Fetched once per bucket and cached for the page's
  // lifetime; a failed fetch just means the chat runs without a skill.
  const skillCacheRef = useRef<Map<string, SkillRecord>>(new Map());
  const [skill, setSkill] = useState<SkillRecord | null>(null);

  useEffect(() => {
    if (!focusedBucketId) {
      setSkill(null);
      return;
    }
    const cached = skillCacheRef.current.get(focusedBucketId);
    if (cached) {
      setSkill(cached);
      return;
    }
    let cancelled = false;
    setSkill(null);
    getSkill(focusedBucketId)
      .then((rec) => {
        skillCacheRef.current.set(focusedBucketId, rec);
        if (!cancelled) setSkill(rec);
      })
      .catch((err) => {
        console.warn('[BYOK] Failed to load skill:', err);
        if (!cancelled) setSkill(null);
      });
    return () => {
      cancelled = true;
    };
  }, [focusedBucketId]);

  const skillForTurn = useMemo(
    () =>
      skill
        ? {
            name: skill.name,
            instructions: skill.instructions,
            isDefault: skill.isDefault,
            memoryIndex: skill.memoryIndex,
          }
        : null,
    [skill],
  );
  const customSkillName = skill?.hasSkill ? skill.name : null;

  // Auto-scroll on new messages and while streaming.
  // Smooth scroll when a message lands; instant (cheap) scroll while text is
  // streaming, otherwise every frame would start a new smooth-scroll animation.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, busy]);
  useEffect(() => {
    if (streamingText) messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [streamingText]);

  // ── Attachments ──

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      const room = ATTACHMENT_MAX_COUNT - pending.length;
      if (room <= 0) {
        antdMessage.warning(`Up to ${ATTACHMENT_MAX_COUNT} attachments per message.`);
        return;
      }
      const accepted: Attachment[] = [];
      for (const file of list.slice(0, room)) {
        const mediaType = resolveMediaType(file);
        if (!isSupported(mediaType)) {
          antdMessage.warning(`"${file.name}": images, PDFs and text files only.`);
          continue;
        }
        if (file.size > ATTACHMENT_MAX_BYTES) {
          antdMessage.warning(`"${file.name}" is over 10 MB.`);
          continue;
        }
        accepted.push(await fileToAttachment(file));
      }
      if (accepted.length) setPending((prev) => [...prev, ...accepted]);
    },
    [pending.length],
  );

  const removePending = useCallback((id: string) => {
    setPending((prev) => {
      const gone = prev.find((a) => a.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const onDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (busy || !ready) return;
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || []);
    if (files.length) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  // ── Send / stop ──

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if ((!text && pending.length === 0) || busy || !ready) return;

    const attachments = pending;
    setDraft('');
    setPending([]);
    setBusy(true);
    setStreamingText('');
    setLiveTools([]);

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      attachments: attachments.length ? attachments : undefined,
    };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);

    // Failure notices live in the chat for the user, but never go back to the
    // LLM as "assistant" turns. That would pollute its context.
    const llmHistory = history.filter((m) => !m.error);
    const fail = (friendly: FriendlyError) => {
      antdMessage.error(friendly.title);
      setHistory([...newHistory, { role: 'assistant', content: friendly.title, error: friendly }]);
    };

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Lazy MCP connect. A 401 means the auto token expired or was revoked
      // (logout in another tab): mint a fresh one and retry once.
      let mcp: MCPClient;
      try {
        mcp = await getOrCreateMcpClient();
      } catch (err) {
        if (!isUnauthorized(err)) {
          console.error('[BYOK] MCP connect failed:', err);
          fail(describeMcpError(err));
          return;
        }
        try {
          mcp = await getOrCreateMcpClient(true);
        } catch (retryErr) {
          console.error('[BYOK] MCP connect failed after token refresh:', retryErr);
          fail(describeMcpError(retryErr));
          return;
        }
      }

      try {
        const reply = await runTurn({
          provider,
          apiKey,
          model,
          mcp,
          history: llmHistory,
          userMessage: text,
          attachments,
          focusedBucket,
          skill: skillForTurn,
          abortSignal: controller.signal,
          onTextDelta: pushDelta,
          onToolCall: (name) => setLiveTools((names) => [...names, name]),
        });
        setHistory([...newHistory, { ...reply, content: toPlainChat(reply.content) }]);
      } catch (err) {
        if (controller.signal.aborted) {
          // User pressed Stop: keep whatever streamed so far.
          const tail = cancelPendingFlush();
          setStreamingText((partial) => {
            const full = partial + tail;
            if (full.trim()) setHistory([...newHistory, { role: 'assistant', content: toPlainChat(full) }]);
            return '';
          });
          return;
        }
        console.error('[BYOK] Chat turn failed:', err);
        fail(describeProviderError(provider, model, err));
      }
    } finally {
      cancelPendingFlush();
      abortRef.current = null;
      setBusy(false);
      setStreamingText('');
      setLiveTools([]);
    }
  }, [draft, pending, busy, ready, history, apiKey, model, provider, focusedBucket, skillForTurn, getOrCreateMcpClient]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  const canSend = ready && !busy && (draft.trim().length > 0 || pending.length > 0);

  return (
    <Container>
      <Header>
        <TitleBlock>
          <Title>Talk to Memory</Title>
          <Subtitle>
            Chat with everything you&rsquo;ve saved in your memories, and attach images or
            documents too. Your AI key stays in your browser; it&rsquo;s never sent to our servers.
          </Subtitle>
        </TitleBlock>
      </Header>

      <ChatCard
        $dragging={dragging}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {dragging && (
          <DropOverlay>
            <MdAttachFile size={22} /> Drop to attach
          </DropOverlay>
        )}

        <ChatToolbar>
          <ChatToolbarLabel>Memory:</ChatToolbarLabel>
          <Tooltip title="The chat searches and reads only this memory">
            <Select
              value={focusedBucketId ?? undefined}
              onChange={(v) => setFocusedBucketId(v)}
              onOpenChange={(open) => {
                if (open) void refreshBuckets();
              }}
              size="small"
              style={{ minWidth: 240 }}
              placeholder="Select a memory"
              options={buckets.map((b) => ({ value: b.id, label: b.profileName }))}
            />
          </Tooltip>
          {focusedBucketId && (
            <Tooltip
              title={
                customSkillName
                  ? skill?.summary || "The chat follows this memory's skill instructions."
                  : 'No skill on this memory. The chat uses the default knowledge assistant.'
              }
            >
              <SkillChip $custom={!!customSkillName}>
                <MdAutoAwesome size={12} style={{ flexShrink: 0 }} />
                <span>{customSkillName ? `Skill: ${customSkillName}` : 'Default assistant'}</span>
              </SkillChip>
            </Tooltip>
          )}
          <Tooltip title={ready ? 'AI provider connected' : 'Setup needed. Add your AI key here.'}>
            <GearButton $active={settingsOpen} onClick={() => setSettingsOpen(true)}>
              <MdSettings size={14} />
              Settings
              <StatusDot $ok={ready} />
            </GearButton>
          </Tooltip>
        </ChatToolbar>

        <Messages>
          {history.length === 0 && !busy ? (
            <Empty>
              <EmptyIconWrap>
                <MdSmartToy size={32} />
              </EmptyIconWrap>
              <EmptyTitle>Talk to your memory</EmptyTitle>
              {ready ? (
                <>
                  <div>
                    Pick a memory above and ask anything. Drop in a screenshot or a PDF if
                    it helps, or try one of these:
                  </div>
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
                    One step to start chatting: choose your AI provider and paste its API key.
                    Your memories are connected automatically.
                  </div>
                  <SetupButton onClick={() => setSettingsOpen(true)}>
                    <MdSettings size={16} />
                    Add your AI key
                  </SetupButton>
                </>
              )}
            </Empty>
          ) : (
            history.map((m, i) => <MessageRow key={i} m={m} onOpenSettings={openSettings} />)
          )}

          {busy && (
            <Turn $role="assistant">
              {streamingText ? (
                <Bubble $role="assistant">
                  <PlainText text={toPlainChat(streamingText)} />
                  <Cursor />
                </Bubble>
              ) : (
                <LiveTools>
                  <Spin size="small" /> {liveTools.length ? 'Looking things up…' : 'Thinking…'}
                </LiveTools>
              )}
            </Turn>
          )}
          <div ref={messagesEndRef} />
        </Messages>

        <InputFrame $hasAttachments={pending.length > 0}>
          {pending.length > 0 && (
            <PendingAttachments>
              <AttachmentRow>
                {pending.map((a) => (
                  <AttachmentView key={a.id} attachment={a} onRemove={() => removePending(a.id)} />
                ))}
              </AttachmentRow>
            </PendingAttachments>
          )}
          <InputRow>
            <Tooltip title="Attach images, PDFs or text files (or drag and drop, or paste)">
              <RoundButton
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!ready || busy}
                aria-label="Attach file"
              >
                <MdAttachFile size={18} />
              </RoundButton>
            </Tooltip>
            <HiddenFile
              ref={fileInputRef}
              accept={ACCEPT}
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Input.TextArea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              onPaste={onPaste}
              placeholder={
                !ready
                  ? 'Add your AI key (Settings, top right) to start chatting'
                  : customSkillName
                    ? `Ask ${customSkillName}… (Shift+Enter for a new line)`
                    : 'Ask about your memories… (Shift+Enter for a new line)'
              }
              autoSize={{ minRows: 1, maxRows: 6 }}
              disabled={!ready || busy}
            />
            {busy ? (
              <Tooltip title="Stop generating">
                <RoundButton type="button" $danger onClick={stop} aria-label="Stop">
                  <MdStop size={20} />
                </RoundButton>
              </Tooltip>
            ) : (
              <RoundButton type="button" $primary onClick={() => void send()} disabled={!canSend} aria-label="Send">
                <MdSend size={18} />
              </RoundButton>
            )}
          </InputRow>
        </InputFrame>
      </ChatCard>

      {/* Settings live in a modal (not an in-card popover) so they are never
          clipped by the chat card and always end with an explicit Done. */}
      <Modal
        open={settingsOpen}
        onCancel={closeSettings}
        onOk={closeSettings}
        okText="Done"
        cancelButtonProps={{ style: { display: 'none' } }}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <MdSettings size={16} />
            AI provider setup
          </span>
        }
        width={460}
        destroyOnHidden={false}
      >
        <SettingsBody>
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
                options={SUGGESTED_MODELS[provider].map((m) => ({ value: m, label: m }))}
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
              onPressEnter={closeSettings}
              placeholder={
                provider === 'anthropic'
                  ? 'sk-ant-…'
                  : provider === 'openai'
                    ? 'sk-…'
                    : 'AIza…'
              }
            />
            <InlineHint>
              {KEY_HINTS[provider]} Stays in your browser for this visit only and is never sent to
              our servers. Press Enter or Done to save.
            </InlineHint>
          </Field>
          <InlineHint>
            Access to your memories is granted automatically to your signed-in wallet.
            Nothing else to configure.
          </InlineHint>
        </SettingsBody>
      </Modal>
    </Container>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────

const TimingLine = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  padding-left: 4px;
`;

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function describeTiming(t: TurnTiming): string {
  const parts = [`${secs(t.totalMs)} total`, `${t.steps} model call${t.steps === 1 ? '' : 's'} (${secs(t.modelMs)})`];
  if (t.toolMs > 0) parts.push(`memory tools ${secs(t.toolMs)}`);
  if (t.toolsListMs > 0) parts.push(`connect ${secs(t.toolsListMs)}`);
  if (t.firstTokenMs !== null) parts.push(`first word after ${secs(t.firstTokenMs)}`);
  return parts.join(' · ');
}

// Memoised so the (possibly long) list of earlier messages is not re-split
// and re-rendered on every streaming frame of the current reply.
const MessageRow = memo(({ m, onOpenSettings }: { m: ChatMessage; onOpenSettings: () => void }) =>
  m.error ? (
    <ErrorCard>
      <MdErrorOutline size={20} style={{ flexShrink: 0, marginTop: 1, color: '#fca5a5' }} />
      <div style={{ minWidth: 0 }}>
        <ErrorTitle>{m.error.title}</ErrorTitle>
        <ErrorHint>{m.error.hint}</ErrorHint>
        {m.error.action && (
          <ErrorActions>
            <ErrorButton onClick={onOpenSettings}>
              <MdSettings size={14} />
              Open Settings
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
    <Turn $role={m.role}>
      <Bubble $role={m.role}>
        {m.attachments && m.attachments.length > 0 && (
          <AttachmentRow style={{ marginBottom: m.content ? 8 : 0 }}>
            {m.attachments.map((a) => (
              <AttachmentView key={a.id} attachment={a} inBubble />
            ))}
          </AttachmentRow>
        )}
        <PlainText text={m.content} />
      </Bubble>
      {m.timing && <TimingLine>{describeTiming(m.timing)}</TimingLine>}
    </Turn>
  ),
);

const AttachmentView = ({
  attachment,
  onRemove,
  inBubble,
}: {
  attachment: Attachment;
  onRemove?: () => void;
  inBubble?: boolean;
}) => (
  <AttachmentChip $inBubble={inBubble} title={`${attachment.name} · ${formatBytes(attachment.size)}`}>
    {attachment.previewUrl ? (
      <ChipThumb src={attachment.previewUrl} alt="" />
    ) : (
      <ChipIcon>
        <MdInsertDriveFile size={18} />
      </ChipIcon>
    )}
    <ChipName>{attachment.name}</ChipName>
    <ChipMeta>{formatBytes(attachment.size)}</ChipMeta>
    {onRemove && (
      <ChipRemove type="button" onClick={onRemove} aria-label="Remove attachment">
        <MdClose size={14} />
      </ChipRemove>
    )}
  </AttachmentChip>
);


export default AgentPage;
