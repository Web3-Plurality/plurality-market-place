# Plurality Marketplace UI

React + Vite single-page app that hosts the three user-facing surfaces of the Plurality Market stack:

- **Studio** — create / edit memory buckets, ingest contexts, manage NFT minting
- **C2C Marketplace** — list, browse, and buy other users' bucket NFTs (ERC-1155 on Oasis Sapphire Testnet)
- **Talk to Memory** — in-browser BYOK agent that connects to the market MCP server with the user's own LLM API key

Wallet-only authentication (MetaMask via SIWE). No email/password, no Google. The same wallet that signs the SIWE message owns the user's profiles, contexts, and NFTs across the stack.

## Architecture

```
   Browser (this UI, :3001)
   ├─ session JWT  → market-backend (:5001)
   │                  ├─ Postgres
   │                  └─ Sapphire Testnet RPC (NFT-ownership lookups)
   └─ PAT bearer   → market-mcp     (:5051)  ← BYOK agent only
                       └─ forwards to backend /pat/tokens/verify
```

The UI never holds an LLM API key on disk — Talk-to-Memory's BYOK key lives in memory for the session only.

## Prerequisites

- Node.js `20+`
- A running [`plurality-market-backend`](../plurality-market-backend) at `http://localhost:5001`
- (Optional, for Talk-to-Memory) a running [`plurality-market-mcp`](../plurality-market-mcp) at `http://localhost:5051`
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

# Market MCP server (used by Talk-to-Memory's BYOK agent only).
VITE_APP_MCP_URL=http://localhost:5051/mcp
```

## Running

```bash
npm run dev       # Vite dev server with HMR, opens browser automatically
npm run build     # tsc + vite build → dist/
npm run preview   # serve the built dist/ locally
```

The dev server listens on **`http://localhost:3001`** (hardcoded in [`vite.config.ts`](vite.config.ts)). The backend's CORS allow-list and the MCP server's `MCP_DEV_CORS_ORIGIN` are wired to this origin — don't change the port unless you also update those two.

## Smart contracts

Contract addresses the UI talks to (Oasis Sapphire Testnet, chainId `23295`):

| Contract | Address |
|---|---|
| ContextRegistry | `0xDBED42F3e8b860831cFb0B67dd67400f900aEB9C` |
| PluralityMemoryNFT | `0x83C5846569156ce0Dd4b988f3c2b510423B2fcdc` |
| ReputationRegistry | `0xca998e6C770B84fbEE6319d16F4781bc1C9E9757` |

ABIs live in [`src/abis/`](src/abis/). They are kept in sync with the deployed bytecode by [`scripts/deploy-market.ts`](../plurality-context-contracts/scripts/deploy-market.ts) in the contracts repo — re-running that script overwrites these files automatically.

## Troubleshooting

**Wallet pill won't connect**
- Make sure MetaMask is on Oasis Sapphire Testnet (chainId `23295`). The UI prompts for a network switch but some MetaMask versions need a manual confirm.

**`401 Unauthorized` on every backend call**
- The session JWT cookie is missing/expired. Click the wallet pill → "Sign out" then sign in again to re-do SIWE.

**Talk-to-Memory says "0 MCP tools"**
- Backend not reachable (PAT verify fails) — check `VITE_APP_API_BASE_URL` and that the backend is running.
- PAT was minted with `mcp:tools:read` or `mcp:tools:write` only — those scopes are reserved placeholders and grant nothing in v1. Mint a fresh PAT with `mcp:tools` (or no scopes, which defaults to `mcp:tools`).

**On-chain reads return stale data after a buy**
- The UI caches NFT-ownership reads briefly. Hard-refresh, or call the buy → wait for the explorer link in the toast.

## License

MIT.
