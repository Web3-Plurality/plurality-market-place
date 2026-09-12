/**
 * BYOK chat core on the Vercel AI SDK.
 *
 * One provider-agnostic tool loop (`streamText` + MCP tools via
 * `@ai-sdk/mcp`) replaces the three hand-written loops we used to maintain
 * per provider. Everything runs in the browser with the user's own key —
 * the backend never sees the key or the prompts. Memory access goes through
 * the market MCP server, authenticated with the auto-minted chat token.
 */

import { streamText, isStepCount, type LanguageModel, type ModelMessage, type UserContent } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMCPClient, type MCPClient, type MCPTransport } from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Provider } from './byokStorage';
import { MCP_URL } from '../utils/env';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ToolTrace {
  name: string;
  input: Record<string, unknown>;
  output: string;
  isError?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  /** Raw bytes — kept so the file is re-sent with the history on later turns. */
  data: Uint8Array;
  /** Object URL for image thumbnails; the UI revokes it when discarded. */
  previewUrl?: string;
}

/** Where the time went in one turn. Shown under the reply so slowness is explainable. */
export interface TurnTiming {
  totalMs: number;
  /** Time spent waiting on the LLM provider (total minus tools). */
  modelMs: number;
  /** Time spent inside MCP tool calls (memory search, reads). */
  toolMs: number;
  /** tools/list round trip (0 when the tool set came from the cache). */
  toolsListMs: number;
  /** Model round trips in this turn. */
  steps: number;
  firstTokenMs: number | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  /** Tool calls performed by this assistant turn (if any). */
  trace?: ToolTrace[];
  timing?: TurnTiming;
  /**
   * Set when this entry is a failure notice rendered in the chat, not a real
   * assistant reply. Entries with `error` are excluded from the history sent
   * to the LLM. Shape lives in byokErrors.ts.
   */
  error?: { title: string; hint: string; details: string; action?: 'settings' | 'tokens' };
}

export interface RunTurnOptions {
  provider: Provider;
  apiKey: string;
  model: string;
  mcp: MCPClient;
  history: ChatMessage[];
  userMessage: string;
  attachments?: Attachment[];
  /** When set, the LLM is told to default tool calls to this bucket. */
  focusedBucket?: { id: string; name: string } | null;
  /**
   * The focused bucket's Skill (instructions + memory index). When present
   * the instructions become the head of the system prompt so the model
   * behaves the way the creator intended. Ignored without a focused bucket.
   */
  skill?: SkillPromptInput | null;
  /** Hard cap on model↔tool round-trips so a confused agent can't loop forever. */
  maxSteps?: number;
  abortSignal?: AbortSignal;
  /** Test seam: bypass makeModel() and drive the turn with a mock model. */
  modelOverride?: LanguageModel;
  onTextDelta?: (delta: string) => void;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, output: string, isError: boolean) => void;
}

// ─── Prompt ───────────────────────────────────────────────────────────────

export interface SkillPromptInput {
  name: string;
  instructions: string;
  isDefault: boolean;
  memoryIndex: Array<{ title: string; description?: string | null }>;
}

/** Cap on memory index lines folded into the prompt. */
const SKILL_MEMORY_MAX = 30;

const STYLE_RULES =
  'Style: reply like a person in a chat, in plain conversational text. Do not use Markdown formatting: ' +
  'no headings, no bold or italics, no bullet or numbered list syntax, no tables, no code fences unless the user ' +
  'explicitly asks for code. Use short paragraphs and plain sentences. Do not use em dashes.';

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant connected to the user's Plurality memory buckets via MCP tools. " +
  "Use the tools to look up information from the user's buckets when relevant. " +
  'Mention which bucket or context an answer comes from when you use a tool. ' +
  'When the user attaches images or documents, read them directly; offer to save useful content to a bucket. ' +
  STYLE_RULES;

function scopingRules(focused: { id: string; name: string }): string {
  return (
    `When calling \`search_memory\`, pass \`profile_ids: ["${focused.id}"]\` to scope the search. ` +
    `When calling \`list_items_in_memory_bucket\` or \`save_memory\`, pass \`profile_id: "${focused.id}"\`. ` +
    `Only search across all buckets if the user explicitly asks for it.`
  );
}

export function buildSystemPrompt(
  focused?: { id: string; name: string } | null,
  skill?: SkillPromptInput | null,
): string {
  if (!focused) return DEFAULT_SYSTEM_PROMPT;

  if (skill) {
    // Skill-first ordering: instructions, then the memory index, then the
    // tool scoping and house style rules that every turn needs.
    const role = skill.isDefault ? ', the default knowledge assistant' : '';
    const memoryLines = skill.memoryIndex
      .slice(0, SKILL_MEMORY_MAX)
      .map((m) => (m.description ? `- ${m.title}: ${m.description}` : `- ${m.title}`));
    const memory = memoryLines.length ? memoryLines.join('\n') : '(no items yet)';
    return (
      `You are using the Skill "${skill.name}"${role} for the bucket "${focused.name}". ` +
      `Follow these instructions:\n${skill.instructions.trim()}\n\n` +
      `Memory in this Skill:\n${memory}\n\n` +
      `Tool scoping: the bucket "${focused.name}" has profileId ${focused.id}. ${scopingRules(focused)}\n\n` +
      STYLE_RULES
    );
  }

  return (
    `${DEFAULT_SYSTEM_PROMPT}\n\n` +
    `The user is currently focused on the memory bucket "${focused.name}" ` +
    `(profileId: ${focused.id}). ` +
    scopingRules(focused)
  );
}

// ─── Models ───────────────────────────────────────────────────────────────

export function makeModel(provider: Provider, apiKey: string, modelId: string): LanguageModel {
  switch (provider) {
    case 'anthropic':
      // Anthropic's API refuses browser-origin calls unless this header is
      // present (a CSRF guard for people who'd embed *their* key in a page).
      // For BYOK it's the intended use: the key is the user's own, in the
      // user's own browser.
      return createAnthropic({
        apiKey,
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      })(modelId);
    case 'openai':
      return createOpenAI({ apiKey })(modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(modelId);
  }
}

// ─── MCP ──────────────────────────────────────────────────────────────────

/**
 * Connect to the market MCP server (Streamable HTTP, bearer = chat token).
 *
 * We hand createMCPClient the official MCP SDK transport instead of its
 * built-in `{ type: 'http' }` one: the built-in transport stores
 * `globalThis.fetch` on the instance and calls it as `this.fetchFn(...)`,
 * which browsers reject with "Failed to execute 'fetch' on 'Window':
 * Illegal invocation" (fetch must be called with `this === window`). The
 * official transport calls `(this._fetch ?? fetch)(...)` and is browser-safe.
 */
export function connectMcp(token: string): Promise<MCPClient> {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  return createMCPClient({
    // The two packages type JSON-RPC messages via their own zod schemas, so
    // the structurally identical transport needs a cast.
    transport: transport as unknown as MCPTransport,
    clientName: 'plurality-byok-agent',
  });
}

// ─── Message conversion ───────────────────────────────────────────────────

// Text-ish files are inlined as text so every provider can read them —
// only images and PDFs go through as binary parts.
const TEXT_LIKE = new Set(['application/json', 'application/xml', 'application/x-yaml', 'application/yaml']);

export function isTextLike(mediaType: string): boolean {
  return mediaType.startsWith('text/') || TEXT_LIKE.has(mediaType);
}

function toUserContent(text: string, attachments?: Attachment[]): UserContent {
  if (!attachments || attachments.length === 0) return text;
  const parts: Exclude<UserContent, string> = [];
  for (const a of attachments) {
    if (a.mediaType.startsWith('image/')) {
      // AI SDK 7: images are file parts with an image/* media type (the
      // dedicated `image` part is deprecated).
      parts.push({ type: 'file', data: a.data, mediaType: a.mediaType, filename: a.name });
    } else if (isTextLike(a.mediaType)) {
      parts.push({
        type: 'text',
        text: `[Attached file "${a.name}"]\n${new TextDecoder().decode(a.data)}`,
      });
    } else {
      parts.push({ type: 'file', data: a.data, mediaType: a.mediaType, filename: a.name });
    }
  }
  if (text.trim()) parts.push({ type: 'text', text });
  return parts;
}

function toModelMessages(history: ChatMessage[]): ModelMessage[] {
  return history.map((m): ModelMessage =>
    m.role === 'user'
      ? { role: 'user', content: toUserContent(m.content, m.attachments) }
      : { role: 'assistant', content: m.content },
  );
}

// ─── Tool output helpers ──────────────────────────────────────────────────

// MCP tool results arrive as { content: [{type:'text', text}], isError? }.
function flattenToolOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  const o = output as { content?: Array<{ type?: string; text?: string }> } | null;
  if (o && Array.isArray(o.content)) {
    const text = o.content
      .filter((c) => c?.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
    if (text) return text;
  }
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

function isToolError(output: unknown): boolean {
  return !!output && typeof output === 'object' && (output as { isError?: boolean }).isError === true;
}

// ─── Turn ─────────────────────────────────────────────────────────────────

export async function runTurn(opts: RunTurnOptions): Promise<ChatMessage> {
  const {
    provider,
    apiKey,
    model,
    mcp,
    history,
    userMessage,
    attachments,
    focusedBucket,
    skill,
    maxSteps = 8,
    abortSignal,
    modelOverride,
    onTextDelta,
    onToolCall,
    onToolResult,
  } = opts;

  const t0 = Date.now();
  const tools = await getTools(mcp);
  const toolsListMs = Date.now() - t0;

  const result = streamText({
    model: modelOverride ?? makeModel(provider, apiKey, model),
    system: buildSystemPrompt(focusedBucket, skill),
    messages: [...toModelMessages(history), { role: 'user', content: toUserContent(userMessage, attachments) }],
    tools,
    stopWhen: isStepCount(maxSteps),
    abortSignal,
    providerOptions: !modelOverride && provider === 'google'
      ? { google: { thinkingConfig: { thinkingLevel: GOOGLE_THINKING_LEVEL } } }
      : undefined,
  });

  const trace: ToolTrace[] = [];
  let text = '';
  let steps = 0;
  let firstTokenAt: number | null = null;
  let toolMs = 0;
  const toolStarts = new Map<string, number>();
  const finishTool = (toolCallId: string) => {
    const started = toolStarts.get(toolCallId);
    if (started !== undefined) {
      toolMs += Date.now() - started;
      toolStarts.delete(toolCallId);
    }
  };

  // streamText never throws for provider failures — they arrive as `error`
  // parts. Re-throw so the caller's error mapping sees the real APICallError.
  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'start-step': {
        steps += 1;
        break;
      }
      case 'text-delta': {
        if (firstTokenAt === null) firstTokenAt = Date.now();
        text += part.text;
        onTextDelta?.(part.text);
        break;
      }
      case 'tool-call': {
        toolStarts.set(part.toolCallId, Date.now());
        onToolCall?.(part.toolName, (part.input as Record<string, unknown>) || {});
        break;
      }
      case 'tool-result': {
        finishTool(part.toolCallId);
        const output = flattenToolOutput(part.output);
        const failed = isToolError(part.output);
        trace.push({ name: part.toolName, input: (part.input as Record<string, unknown>) || {}, output, isError: failed });
        onToolResult?.(part.toolName, output, failed);
        break;
      }
      case 'error': {
        const err = part.error;
        throw err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
      }
      default: {
        // `tool-error` (execute threw) — surface in the trace, the SDK feeds
        // the failure back to the model and the loop continues.
        const p = part as { type: string; toolName?: string; toolCallId?: string; input?: unknown; error?: unknown };
        if (p.type === 'tool-error' && p.toolName) {
          if (p.toolCallId) finishTool(p.toolCallId);
          const msg = p.error instanceof Error ? p.error.message : String(p.error);
          trace.push({ name: p.toolName, input: (p.input as Record<string, unknown>) || {}, output: msg, isError: true });
          onToolResult?.(p.toolName, msg, true);
        }
      }
    }
  }

  const totalMs = Date.now() - t0;
  const timing: TurnTiming = {
    totalMs,
    toolMs,
    toolsListMs,
    modelMs: Math.max(0, totalMs - toolMs - toolsListMs),
    steps,
    firstTokenMs: firstTokenAt === null ? null : firstTokenAt - t0,
  };

  return {
    role: 'assistant',
    content: text.trim() || (abortSignal?.aborted ? '(stopped)' : '(no response)'),
    trace: trace.length ? trace : undefined,
    timing,
  };
}

// ─── Performance knobs ────────────────────────────────────────────────────

// Gemini 3.x thinks by default, and on gemini-3.6-flash that cost ~20 s per
// call in a direct probe versus ~4 s with thinkingLevel "low". A tool-using
// chat makes 2+ calls per reply, so default thinking alone made replies take
// close to a minute. "low" keeps tool use reliable; raise it if answers get
// sloppy.
const GOOGLE_THINKING_LEVEL = 'low';

// tools/list is one MCP round trip per message otherwise; the tool set of a
// connected client does not change, so fetch it once per client.
const toolsCache = new WeakMap<MCPClient, Promise<Awaited<ReturnType<MCPClient['tools']>>>>();
function getTools(mcp: MCPClient): Promise<Awaited<ReturnType<MCPClient['tools']>>> {
  let pending = toolsCache.get(mcp);
  if (!pending) {
    pending = mcp.tools();
    pending.catch(() => toolsCache.delete(mcp));
    toolsCache.set(mcp, pending);
  }
  return pending;
}
