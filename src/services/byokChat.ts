/**
 * BYOK chat orchestration. Provider-agnostic interface backed by three
 * provider-specific tool-loops (Anthropic / OpenAI / Google).
 *
 * Tool-loop pattern (same shape across providers):
 *   1. List tools from the MCP client.
 *   2. Call the LLM with the user's history + new message + the tool defs.
 *   3. If the LLM responds with tool calls, run each via MCP, feed the
 *      results back as the appropriate provider-specific block, and loop.
 *   4. Stop when the LLM returns plain text (end_turn / no tool_calls /
 *      no functionCalls), or when maxIterations is reached.
 *
 * Tool calls are surfaced via `onToolCall` / `onToolResult` callbacks so
 * the UI can render the trace as the loop progresses.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI, type Part } from '@google/genai';
import type { Provider } from './byokStorage';
import { ByokMcpClient } from './byokMcpClient';

export interface ToolTrace {
  name: string;
  input: Record<string, unknown>;
  output: string;
  isError?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Tool calls performed by this assistant turn (if any). */
  trace?: ToolTrace[];
  /**
   * Set when this entry is a failure notice rendered in the chat, not a real
   * assistant reply. Entries with `error` are excluded from the history sent
   * to the LLM. Shape lives in byokErrors.ts.
   */
  error?: { title: string; hint: string; details: string; action?: 'settings' | 'tokens' };
}

export interface RunTurnOptions {
  apiKey: string;
  model: string;
  systemPrompt?: string;
  mcp: ByokMcpClient;
  history: ChatMessage[];
  userMessage: string;
  /** When set, the LLM is told to default tool calls to this bucket. */
  focusedBucket?: { id: string; name: string } | null;
  /** Hard cap on tool-loop iterations to prevent runaway agents. */
  maxIterations?: number;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, output: string, isError: boolean) => void;
}

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful assistant connected to the user\'s Plurality memory buckets via MCP tools. ' +
  'Use the tools to look up information from the user\'s buckets when relevant. ' +
  'Cite which bucket / context an answer comes from when you use a tool.';

/** Compose the final system prompt — base + optional focused-bucket note. */
function buildSystemPrompt(base: string, focused?: { id: string; name: string } | null): string {
  if (!focused) return base;
  return (
    `${base}\n\n` +
    `The user is currently focused on the memory bucket "${focused.name}" ` +
    `(profileId: ${focused.id}). ` +
    `When calling \`search_memory\`, pass \`profileIds: ["${focused.id}"]\` to scope the search. ` +
    `When calling \`list_items_in_memory_bucket\` or \`save_memory\`, use that same profileId. ` +
    `Only search across all buckets if the user explicitly asks for it.`
  );
}

export async function runAnthropicTurn(opts: RunTurnOptions): Promise<ChatMessage> {
  const {
    apiKey,
    model,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    mcp,
    history,
    userMessage,
    focusedBucket,
    maxIterations = 8,
    onToolCall,
    onToolResult,
  } = opts;

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const mcpTools = await mcp.listTools();
  const anthropicTools = mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  // Build the messages array from prior history + this user turn. We keep
  // tool_use / tool_result blocks within the local loop only — the persisted
  // history holds plain text per turn so UI rendering stays simple.
  type AnthMsg = Anthropic.MessageParam;
  const messages: AnthMsg[] = [
    ...history.map((m): AnthMsg => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const trace: ToolTrace[] = [];
  let finalText = '';

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: buildSystemPrompt(systemPrompt, focusedBucket),
      tools: anthropicTools,
      messages,
    });

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }

    if (response.stop_reason === 'tool_use') {
      // Push the assistant turn (text + tool_use blocks) onto the message list
      messages.push({ role: 'assistant', content: response.content });

      // Run every tool_use block, collect tool_result blocks
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const input = (block.input as Record<string, unknown>) || {};
        onToolCall?.(block.name, input);
        try {
          const result = await mcp.callTool(block.name, input);
          const text = result.content
            .filter((c) => c.type === 'text' && typeof c.text === 'string')
            .map((c) => c.text!)
            .join('\n');
          trace.push({ name: block.name, input, output: text, isError: result.isError });
          onToolResult?.(block.name, text, result.isError === true);
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: text || '(empty)',
            is_error: result.isError === true,
          });
        } catch (err) {
          const errText = err instanceof Error ? err.message : String(err);
          trace.push({ name: block.name, input, output: errText, isError: true });
          onToolResult?.(block.name, errText, true);
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Tool call failed: ${errText}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: 'user', content: toolResultBlocks });
      continue;
    }

    // Any other stop reason (max_tokens, etc.) — bail with what we have.
    finalText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    break;
  }

  return {
    role: 'assistant',
    content: finalText || '(no response)',
    trace: trace.length ? trace : undefined,
  };
}

// ─── OpenAI ────────────────────────────────────────────────────────────────

export async function runOpenAiTurn(opts: RunTurnOptions): Promise<ChatMessage> {
  const {
    apiKey,
    model,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    mcp,
    history,
    userMessage,
    focusedBucket,
    maxIterations = 8,
    onToolCall,
    onToolResult,
  } = opts;

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const mcpTools = await mcp.listTools();
  const openaiTools: OpenAI.Chat.ChatCompletionTool[] = mcpTools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema as Record<string, unknown>,
    },
  }));

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(systemPrompt, focusedBucket) },
    ...history.map(
      (m): OpenAI.Chat.ChatCompletionMessageParam => ({ role: m.role, content: m.content }),
    ),
    { role: 'user', content: userMessage },
  ];

  const trace: ToolTrace[] = [];
  let finalText = '';

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    });

    const choice = response.choices[0];
    const msg = choice.message;
    const toolCalls = msg.tool_calls || [];

    if (toolCalls.length === 0) {
      finalText = (msg.content || '').trim();
      break;
    }

    // Append the assistant turn (with its tool_calls) so OpenAI can
    // correlate the tool messages we send next.
    messages.push({
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      // Only function-type tool calls are supported.
      if (tc.type !== 'function') continue;

      let input: Record<string, unknown> = {};
      try {
        input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        // Malformed JSON args — let the tool fail with empty input.
        input = {};
      }

      onToolCall?.(tc.function.name, input);
      try {
        const result = await mcp.callTool(tc.function.name, input);
        const text = ByokMcpClient.contentToText(result);
        trace.push({ name: tc.function.name, input, output: text, isError: result.isError });
        onToolResult?.(tc.function.name, text, result.isError === true);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: text || '(empty)',
        });
      } catch (err) {
        const errText = err instanceof Error ? err.message : String(err);
        trace.push({ name: tc.function.name, input, output: errText, isError: true });
        onToolResult?.(tc.function.name, errText, true);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: `Tool call failed: ${errText}`,
        });
      }
    }
  }

  return {
    role: 'assistant',
    content: finalText || '(no response)',
    trace: trace.length ? trace : undefined,
  };
}

// ─── Google Gemini ─────────────────────────────────────────────────────────

// Google's Schema validator is stricter than open JSON Schema. It rejects
// $ref / $defs / $schema / $id (standard JSON Schema), so we inline every
// $ref by resolving it against the schema's own $defs, then drop those
// top-level keys. Anthropic and OpenAI accept the original schema as-is,
// so this transform is Google-only.
function googleifySchema(schema: unknown): unknown {
  if (typeof schema !== 'object' || schema === null) return schema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = schema as Record<string, any>;
  const defs: Record<string, unknown> = (root.$defs as Record<string, unknown>) || {};

  // Resolves "#/$defs/Foo" → defs.Foo (recursively). Depth-limited so a
  // circular schema can't lock the page.
  const inline = (node: unknown, depth: number): unknown => {
    if (depth > 16) return node;
    if (Array.isArray(node)) return node.map((n) => inline(n, depth + 1));
    if (typeof node !== 'object' || node === null) return node;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = node as Record<string, any>;
    if (typeof obj.$ref === 'string') {
      const m = obj.$ref.match(/^#\/\$defs\/(.+)$/);
      if (m && defs[m[1]]) {
        const target = inline(defs[m[1]], depth + 1);
        // Preserve sibling fields on the $ref node (rarely used).
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $ref: _ignored, ...siblings } = obj;
        return { ...(target as object), ...siblings };
      }
      // Unresolvable ref — leave it; Google will reject but at least we
      // gave it a clear error to surface.
      return obj;
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = inline(v, depth + 1);
    }
    return out;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $defs: _d, $schema: _s, $id: _i, ...rest } = root;
  return inline(rest, 0);
}

export async function runGoogleTurn(opts: RunTurnOptions): Promise<ChatMessage> {
  const {
    apiKey,
    model,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    mcp,
    history,
    userMessage,
    focusedBucket,
    maxIterations = 8,
    onToolCall,
    onToolResult,
  } = opts;

  // @google/genai (not the retired @google/generative-ai): it is the SDK
  // Google maintains for the current key format ("AQ." keys) and model
  // generations. Same tool-loop shape as the other providers.
  const ai = new GoogleGenAI({ apiKey });

  const mcpTools = await mcp.listTools();
  const tools =
    mcpTools.length > 0
      ? [
          {
            functionDeclarations: mcpTools.map((t) => ({
              name: t.name,
              description: t.description,
              // Raw JSON Schema is accepted here; we still inline $refs since
              // Google's validator rejects $ref / $defs.
              parametersJsonSchema: googleifySchema(t.inputSchema),
            })),
          },
        ]
      : undefined;

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: buildSystemPrompt(systemPrompt, focusedBucket),
      tools,
    },
    history: history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  });

  const trace: ToolTrace[] = [];
  let finalText = '';

  // First turn: user's new message.
  let response = await chat.sendMessage({ message: userMessage });

  for (let i = 0; i < maxIterations; i++) {
    const functionCalls = response.functionCalls ?? [];

    if (functionCalls.length === 0) {
      finalText = (response.text ?? '').trim();
      break;
    }

    const functionResponses: Part[] = [];
    for (const fc of functionCalls) {
      const name = fc.name ?? '';
      const input = (fc.args ?? {}) as Record<string, unknown>;
      onToolCall?.(name, input);
      try {
        const mcpResult = await mcp.callTool(name, input);
        const text = ByokMcpClient.contentToText(mcpResult);
        trace.push({ name, input, output: text, isError: mcpResult.isError });
        onToolResult?.(name, text, mcpResult.isError === true);
        functionResponses.push({
          functionResponse: { id: fc.id, name, response: { content: text || '(empty)' } },
        });
      } catch (err) {
        const errText = err instanceof Error ? err.message : String(err);
        trace.push({ name, input, output: errText, isError: true });
        onToolResult?.(name, errText, true);
        functionResponses.push({
          functionResponse: { id: fc.id, name, response: { error: errText } },
        });
      }
    }

    response = await chat.sendMessage({ message: functionResponses });
  }

  return {
    role: 'assistant',
    content: finalText || '(no response)',
    trace: trace.length ? trace : undefined,
  };
}

/**
 * Models the given Gemini key can actually call. Google gates model
 * generations per account (a key from a newer account gets 404 "no longer
 * available to new users" on gemini-2.x), so a hard-coded list is wrong for
 * someone. Filters to chat-capable gemini-* models, newest first.
 */
export async function listGoogleModels(apiKey: string): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  const out: string[] = [];
  for await (const m of pager) {
    const name = (m.name ?? '').replace(/^models\//, '');
    if (!name.startsWith('gemini')) continue;
    const actions = m.supportedActions ?? [];
    if (actions.length > 0 && !actions.includes('generateContent')) continue;
    // Non-chat variants that still advertise generateContent.
    if (/-(image|tts|embedding|live|audio|transcribe|customtools|computer-use|robotics)/i.test(name)) continue;
    // The list endpoint still returns gemini-2.x for accounts that get 404
    // "no longer available to new users" when calling them (verified live),
    // so the listing alone can't be trusted for gating — drop generations
    // below 3. Versionless aliases (gemini-flash-latest) are kept.
    const gen = name.match(/^gemini-(\d+)/);
    if (gen && Number(gen[1]) < 3) continue;
    out.push(name);
  }
  return out.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

// ─── Provider dispatcher ───────────────────────────────────────────────────

export function runTurn(provider: Provider, opts: RunTurnOptions): Promise<ChatMessage> {
  switch (provider) {
    case 'anthropic':
      return runAnthropicTurn(opts);
    case 'openai':
      return runOpenAiTurn(opts);
    case 'google':
      return runGoogleTurn(opts);
  }
}
