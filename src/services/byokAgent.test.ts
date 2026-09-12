import { describe, expect, it } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import { APICallError, simulateReadableStream, tool } from 'ai';
import { z } from 'zod';
import type { MCPClient } from '@ai-sdk/mcp';
import { runTurn, buildSystemPrompt, type Attachment } from './byokAgent';
import { describeProviderError } from './byokErrors';

// ─── Mock helpers ─────────────────────────────────────────────────────────

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const finish = (unified: 'stop' | 'tool-calls') => ({
  type: 'finish' as const,
  finishReason: { unified, raw: unified },
  usage: USAGE,
});

// A plain text reply, streamed as several deltas.
const textChunks = (deltas: string[]) => [
  { type: 'stream-start' as const, warnings: [] },
  { type: 'text-start' as const, id: 't' },
  ...deltas.map((delta) => ({ type: 'text-delta' as const, id: 't', delta })),
  { type: 'text-end' as const, id: 't' },
  finish('stop'),
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const streamOf = (chunks: any[]) => ({ stream: simulateReadableStream({ chunks }) });

// Minimal MCPClient stand-in: runTurn only touches tools() (and close()).
function mcpWith(tools: Record<string, unknown> = {}): MCPClient {
  return { tools: async () => tools, close: async () => {} } as unknown as MCPClient;
}

const base = {
  provider: 'openai' as const,
  apiKey: 'test-key',
  model: 'test-model',
  history: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────

describe('runTurn', () => {
  it('streams text deltas and returns the assembled reply', async () => {
    const model = new MockLanguageModelV3({
      doStream: async () => streamOf(textChunks(['Hello ', 'world'])),
    });
    const deltas: string[] = [];

    const reply = await runTurn({
      ...base,
      mcp: mcpWith(),
      userMessage: 'hi',
      modelOverride: model,
      onTextDelta: (d) => deltas.push(d),
    });

    expect(reply.role).toBe('assistant');
    expect(reply.content).toBe('Hello world');
    expect(deltas).toEqual(['Hello ', 'world']);
    expect(reply.trace).toBeUndefined();
  });

  it('scopes the system prompt to the focused bucket and keeps prior turns', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let seenPrompt: any[] = [];
    const model = new MockLanguageModelV3({
      doStream: async (options) => {
        seenPrompt = options.prompt as unknown[];
        return streamOf(textChunks(['ok']));
      },
    });

    await runTurn({
      ...base,
      mcp: mcpWith(),
      history: [
        { role: 'user', content: 'earlier question' },
        { role: 'assistant', content: 'earlier answer' },
      ],
      userMessage: 'now',
      focusedBucket: { id: 'bucket-123', name: 'Crypto Research' },
      modelOverride: model,
    });

    expect(seenPrompt[0].role).toBe('system');
    const system = JSON.stringify(seenPrompt[0].content);
    expect(system).toContain('Crypto Research');
    expect(system).toContain('bucket-123');
    expect(seenPrompt.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });

  it('sends images as binary parts and inlines text files', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let seenPrompt: any[] = [];
    const model = new MockLanguageModelV3({
      doStream: async (options) => {
        seenPrompt = options.prompt as unknown[];
        return streamOf(textChunks(['ok']));
      },
    });
    const png: Attachment = { id: '1', name: 'shot.png', mediaType: 'image/png', size: 3, data: new Uint8Array([1, 2, 3]) };
    const md: Attachment = {
      id: '2',
      name: 'notes.md',
      mediaType: 'text/markdown',
      size: 4,
      data: new TextEncoder().encode('# hi'),
    };

    await runTurn({ ...base, mcp: mcpWith(), userMessage: 'look at these', attachments: [png, md], modelOverride: model });

    const user = seenPrompt.at(-1);
    expect(user.role).toBe('user');
    // Provider-level prompt: images arrive as file parts carrying their media type.
    const binary = user.content.filter((p: { type: string }) => p.type === 'file');
    expect(binary).toHaveLength(1);
    expect(binary[0].mediaType).toBe('image/png');
    const text = user.content
      .filter((p: { type: string }) => p.type === 'text')
      .map((p: { text: string }) => p.text)
      .join('\n');
    expect(text).toContain('Attached file "notes.md"');
    expect(text).toContain('# hi');
    expect(text).toContain('look at these');
  });

  it('surfaces provider failures as APICallError so the UI can explain them', async () => {
    const model = new MockLanguageModelV3({
      doStream: async () => {
        throw new APICallError({
          message: 'Bad Request',
          url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent',
          requestBodyValues: {},
          statusCode: 400,
          responseBody: '{"error":{"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}',
        });
      },
    });

    let caught: unknown;
    try {
      await runTurn({ ...base, mcp: mcpWith(), userMessage: 'hi', modelOverride: model });
    } catch (err) {
      caught = err;
    }
    expect(APICallError.isInstance(caught)).toBe(true);

    const friendly = describeProviderError('google', 'gemini-3.6-flash', caught);
    expect(friendly.title).toMatch(/Google Gemini API key was rejected/);
    expect(friendly.action).toBe('settings');
    expect(friendly.hint).toContain('aistudio.google.com');
  });

  it('explains a retired model and passes on the provider suggestion', () => {
    const err = new APICallError({
      message: 'Not Found',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      requestBodyValues: {},
      statusCode: 404,
      responseBody:
        '{"error":{"code":404,"message":"This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash for the latest features and improvements.","status":"NOT_FOUND"}}',
    });
    const friendly = describeProviderError('google', 'gemini-2.5-flash', err);
    expect(friendly.title).toContain('gemini-2.5-flash');
    expect(friendly.hint).toContain('gemini-3.6-flash');
    expect(friendly.action).toBe('settings');
  });

  it('runs MCP tools through the loop, feeds results back, and records a trace', async () => {
    let call = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let secondPrompt: any[] = [];
    const model = new MockLanguageModelV3({
      doStream: async (options) => {
        call += 1;
        if (call === 1) {
          // Step 1: the model asks for a tool.
          return streamOf([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId: 'c1', toolName: 'search_memory', input: JSON.stringify({ query: 'roadmap' }) },
            finish('tool-calls'),
          ]);
        }
        // Step 2: the model answers with the tool result in context.
        secondPrompt = options.prompt as unknown[];
        return streamOf(textChunks(['Found it.']));
      },
    });

    const tools = {
      search_memory: tool({
        description: 'Semantic search across buckets',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => ({ content: [{ type: 'text', text: `hit for ${query}` }] }),
      }),
    };
    const calls: string[] = [];

    const reply = await runTurn({
      ...base,
      mcp: mcpWith(tools),
      userMessage: 'find the roadmap',
      modelOverride: model,
      onToolCall: (name) => calls.push(name),
    });

    expect(call).toBe(2);
    expect(calls).toEqual(['search_memory']);
    expect(secondPrompt.map((m) => m.role)).toContain('tool');
    expect(reply.content).toBe('Found it.');
    expect(reply.trace).toHaveLength(1);
    expect(reply.trace?.[0]).toMatchObject({
      name: 'search_memory',
      input: { query: 'roadmap' },
      output: 'hit for roadmap',
      isError: false,
    });
  });
});

// ─── System prompt ────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  const focused = { id: 'bucket-123', name: 'Crypto Research' };
  const scoping = 'profile_ids: ["bucket-123"]';

  it('puts the skill instructions first, then the memory index, then scoping and style', () => {
    const prompt = buildSystemPrompt(focused, {
      name: 'Trading coach',
      instructions: '# Trading coach\nAlways quote the source note.',
      isDefault: false,
      memoryIndex: [
        { title: 'Q3 notes', description: 'Earnings summary' },
        { title: 'Watchlist', description: null },
      ],
    });

    expect(prompt.startsWith('You are using the Skill "Trading coach" for the bucket "Crypto Research".')).toBe(true);
    expect(prompt).not.toContain('default knowledge assistant');
    const instructionsAt = prompt.indexOf('Always quote the source note.');
    const memoryAt = prompt.indexOf('Memory in this Skill:');
    const scopingAt = prompt.indexOf(scoping);
    const styleAt = prompt.indexOf('Do not use em dashes.');
    expect(instructionsAt).toBeGreaterThan(-1);
    expect(memoryAt).toBeGreaterThan(instructionsAt);
    expect(scopingAt).toBeGreaterThan(memoryAt);
    expect(styleAt).toBeGreaterThan(scopingAt);
    expect(prompt).toContain('- Q3 notes: Earnings summary');
    expect(prompt).toContain('- Watchlist\n');
  });

  it('labels the built-in default skill and copes with an empty memory index', () => {
    const prompt = buildSystemPrompt(focused, {
      name: 'Knowledge assistant',
      instructions: 'Answer only from the memory.',
      isDefault: true,
      memoryIndex: [],
    });
    expect(prompt).toContain('You are using the Skill "Knowledge assistant", the default knowledge assistant');
    expect(prompt).toContain('(no items yet)');
    expect(prompt).toContain(scoping);
  });

  it('caps the memory index at 30 lines', () => {
    const memoryIndex = Array.from({ length: 40 }, (_, i) => ({ title: `Item ${i + 1}` }));
    const prompt = buildSystemPrompt(focused, { name: 'S', instructions: 'x', isDefault: false, memoryIndex });
    expect(prompt).toContain('- Item 30');
    expect(prompt).not.toContain('- Item 31');
  });

  it('keeps the focused-bucket prompt unchanged when no skill is supplied', () => {
    const prompt = buildSystemPrompt(focused);
    expect(prompt).not.toContain('You are using the Skill');
    expect(prompt).toContain('focused on the memory bucket "Crypto Research"');
    expect(prompt).toContain(scoping);
    expect(prompt).toContain('Do not use em dashes.');
    expect(buildSystemPrompt(focused, null)).toBe(prompt);
  });

  it('ignores the skill and returns the plain prompt without a focused bucket', () => {
    const prompt = buildSystemPrompt(null, { name: 'S', instructions: 'x', isDefault: false, memoryIndex: [] });
    expect(prompt).not.toContain('You are using the Skill');
    expect(prompt).toBe(buildSystemPrompt());
  });
});

describe('runTurn with a skill', () => {
  it('sends the skill instructions as the head of the system message', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let seenPrompt: any[] = [];
    const model = new MockLanguageModelV3({
      doStream: async (options) => {
        seenPrompt = options.prompt as unknown[];
        return streamOf(textChunks(['ok']));
      },
    });

    await runTurn({
      ...base,
      mcp: mcpWith(),
      userMessage: 'hi',
      focusedBucket: { id: 'bucket-123', name: 'Crypto Research' },
      skill: {
        name: 'Trading coach',
        instructions: 'Always quote the source note.',
        isDefault: false,
        memoryIndex: [{ title: 'Q3 notes', description: 'Earnings summary' }],
      },
      modelOverride: model,
    });

    expect(seenPrompt[0].role).toBe('system');
    const system = String(seenPrompt[0].content);
    expect(system.startsWith('You are using the Skill "Trading coach"')).toBe(true);
    expect(system).toContain('Always quote the source note.');
    expect(system).toContain('- Q3 notes: Earnings summary');
    expect(system).toContain('profile_ids: ["bucket-123"]');
  });
});
