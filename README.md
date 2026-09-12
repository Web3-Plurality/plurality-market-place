# Plurality Skills Marketplace UI

React + Vite single-page app that hosts the three user-facing surfaces of the Plurality Market stack:

- **My Skills**: create and edit Skills (memory buckets), add knowledge, write the Skill's instructions, mint as NFTs
- **Marketplace**: list, browse and buy other creators' Skill NFTs (ERC-1155 on Oasis Sapphire Testnet)
- **Use a Skill**: in-browser BYOK agent that loads a Skill's instructions and talks to the market MCP server with the user's own LLM API key

Wallet-only authentication (MetaMask via SIWE). No email/password, no Google. The same wallet that signs the SIWE message owns the user's Skills, contexts and NFTs across the stack.

## Skills

A **Skill** is a memory bucket with two parts: *instructions* (a markdown playbook telling an AI how to behave) plus *memory* (the bucket's contexts: files, notes, chats). One bucket is one Skill. Instructions are optional: a bucket without them is sold as **Knowledge only** and comes with the built-in default knowledge assistant. Once a bucket is minted, its instructions and memory are frozen; the instructions' hash is the first item registered on chain and is folded into the bucket hash.

Where Skills show up in this UI:

| Surface | What you see |
|---|---|
| **My Skills > Drafts** | Each card shows `Skill: <name>` or `No skill yet`. Open a card to find the **Skill panel** at the top of the bucket dialog: **Add skill** / **Edit** / **Remove** for drafts (a template is prefilled), **View instructions** for minted buckets. |
| **Mint dialog** | The NFT title defaults to the Skill name. A green note confirms `Skill included`, an amber note reminds you that buyers get the default assistant if you mint without one. Minting is never blocked. |
| **Marketplace** | Cards, the hero and the detail modal show the Skill name and summary (public). Filter with the **Skill included only** pill. Holders get a **View skill** button that opens the full instructions plus the memory index; browsers see `Full instructions unlock after purchase.` |
| **Use a Skill** | Pick a Skill in the toolbar; its instructions become the system prompt (`Skill: <name>` chip, or `Default assistant`) and every tool call is scoped to that bucket. |
| **API tokens** | After revealing a token the dialog shows copyable **Connect this token** snippets for Claude Code and JSON-configured clients (Claude Desktop, Cursor). |

Full instructions are only readable by the bucket creator and by wallets holding the NFT; name and summary are public. The default skill text is served by the backend (`GET /ai/profile/:id/skill` with `isDefault: true`) and never hardcoded here.

### Use your Skills outside the browser

Any MCP client can use the Skills a wallet owns. Mint a token (wallet pill > API tokens > Generate new token), then:

**Claude Code (CLI)**

```bash
claude mcp add --transport http plurality <MCP_URL> --header "Authorization: Bearer <TOKEN>"
```

**Claude Desktop / Cursor / other JSON-configured clients**

```json
{
  "mcpServers": {
    "plurality": {
      "url": "<MCP_URL>",
      "headers": {
        "Authorization": "Bearer <TOKEN>"
      }
    }
  }
}
```

`<MCP_URL>` is the value of `VITE_APP_MCP_URL` (for example `http://localhost:5051/mcp`). Once connected, your Skills show up as tools (`get_bucket_skill`, `search_memory`, `read_context`, ...) and the `use_skill` prompt (`/mcp__plurality__use_skill <bucket id or name>` in Claude Code) loads one by name.

## Architecture

```
   Browser (this UI, :3001)
   ├─ session JWT  → market-backend (:5001)
   │                  ├─ Postgres
   │                  └─ Sapphire Testnet RPC (NFT-ownership lookups)
   └─ chat token   → market-mcp     (:5051)  ← BYOK agent only
                       └─ forwards to backend /pat/tokens/verify
```

The UI never holds an LLM API key on disk: the Use a Skill BYOK key lives in memory for the session only.

### Use a Skill internals

- Built on the [Vercel AI SDK](https://ai-sdk.dev) (`ai` + `@ai-sdk/anthropic` / `@ai-sdk/openai` / `@ai-sdk/google`): one provider-agnostic `streamText` tool loop in [`src/services/byokAgent.ts`](src/services/byokAgent.ts). Anthropic is called from the browser with the `anthropic-dangerous-direct-browser-access` header, which is legitimate for BYOK since the key is the user's own.
- `buildSystemPrompt(focused, skill)` puts the Skill's instructions first, then the memory index, then the tool-scoping and plain-text style rules. Without a focused Skill the generic prompt is used.
- Memory tools come from the market MCP server via `@ai-sdk/mcp` (Streamable HTTP). The chat authenticates with an **auto-minted chat token**: the backend issues a 1-hour `mcp:tools` PAT (`POST /pat/tokens { auto: true }`) that is held in memory only, re-minted silently on expiry / 401, revoked on logout, and never listed in the API tokens dialog. Manual PATs are only for external MCP clients (Claude Code, Cursor, ...).
- Attachments: images, PDFs and text files (10 MB each, 6 per message) go straight to the model as multimodal parts; text-like files are inlined. Nothing is uploaded to Plurality unless the user explicitly saves it to a bucket.
- Responses stream token-by-token and render as Markdown; the Stop button aborts the in-flight request.

## Prerequisites

- Node.js `20+`
- A running [`plurality-market-backend`](https://github.com/Web3-Plurality/plurality-market-backend) at `http://localhost:5001`
- (Optional, for Use a Skill) a running [`plurality-market-mcp`](https://github.com/Web3-Plurality/plurality-market-mcp) at `http://localhost:5051`
- MetaMask installed in the browser

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```env
# Backend (market-backend, NOT prod backend)
VITE_APP_API_BASE_URL=http://localhost:5001

# Market MCP server (used by the Use a Skill BYOK agent and shown in the API tokens dialog).
VITE_APP_MCP_URL=http://localhost:5051/mcp
```

## Running

```bash
npm run dev       # Vite dev server with HMR, opens browser automatically
npm run build     # tsc + vite build → dist/
npm run preview   # serve the built dist/ locally
npm test          # vitest: Use a Skill agent loop against the AI SDK mock model (no API keys needed)
```

The dev server listens on **`http://localhost:3001`** (hardcoded in [`vite.config.ts`](vite.config.ts)). The backend's CORS allow-list and the MCP server's `MCP_DEV_CORS_ORIGIN` are wired to this origin, so don't change the port unless you also update those two.

## Smart contracts

Contract addresses the UI talks to (Oasis Sapphire Testnet, chainId `23295`):

| Contract | Address |
|---|---|
| ContextRegistry | `0xDBED42F3e8b860831cFb0B67dd67400f900aEB9C` |
| PluralityMemoryNFT | `0x83C5846569156ce0Dd4b988f3c2b510423B2fcdc` |
| ReputationRegistry | `0xca998e6C770B84fbEE6319d16F4781bc1C9E9757` |

ABIs live in [`src/abis/`](src/abis/). They are kept in sync with the deployed bytecode by [`scripts/deploy-market.ts`](https://github.com/Web3-Plurality/plurality-context-contracts/blob/main/scripts/deploy-market.ts) in the contracts repo; re-running that script overwrites these files automatically.

## Troubleshooting

**Wallet pill won't connect**
- Make sure MetaMask is on Oasis Sapphire Testnet (chainId `23295`). The UI prompts for a network switch but some MetaMask versions need a manual confirm.

**`401 Unauthorized` on every backend call**
- The session JWT cookie is missing/expired. Click the wallet pill → "Sign out" then sign in again to re-do SIWE.

**Use a Skill shows "Couldn't connect to your memory" / "Your chat session has expired"**
- Backend not reachable (chat-token mint or verify fails): check `VITE_APP_API_BASE_URL` and that the backend is running.
- The MCP server isn't reachable at `VITE_APP_MCP_URL`, or its `MCP_DEV_CORS_ORIGIN` doesn't match this origin.
- The login session itself is gone (logged out in another tab): the auto token is refreshed once automatically; if that fails, sign out and back in.

**"Your … API key was rejected"**
- Google: use a Gemini key from Google AI Studio (`AIza…`), not a Cloud key for another service (Custom Search, Maps). The notice's "Technical details" shows the provider's raw response.

**External MCP client (Claude Code / Cursor) gets 403 `insufficient_scope`**
- The PAT was minted with `mcp:tools:read` / `mcp:tools:write` only, which are reserved placeholders that grant nothing yet. The API tokens dialog now always mints `mcp:tools`; re-create the token.

**Skill panel says "This bucket is minted. Its skill is frozen on chain."**
- Expected: instructions cannot change after mint, the same rule contexts follow. Create a new draft if you need a different Skill.

**On-chain reads return stale data after a buy**
- The UI caches NFT-ownership reads briefly. Hard-refresh, or call the buy → wait for the explorer link in the toast.

## License

MIT.
