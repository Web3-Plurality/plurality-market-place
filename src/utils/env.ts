// API
export const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || '';

// MCP server (BYOK Agent connects here via Streamable HTTP)
export const MCP_URL = import.meta.env.VITE_APP_MCP_URL || 'http://localhost:5051/mcp';

// Chain the marketplace transacts on: 'testnet' (Sapphire testnet) or 'mainnet' (Sapphire mainnet).
// vite.config.ts fails the build on any other value.
export const MARKETPLACE_CHAIN: 'testnet' | 'mainnet' = import.meta.env.VITE_APP_CHAIN || 'testnet';
