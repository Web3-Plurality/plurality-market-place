// API
export const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || '';

// Stytch (Email OTP) — DEPRECATED in wallet-only stack, kept while legacy
// imports still reference these constants. Phase 1 will clean up env.ts.
export const PUBLIC_STYTCH_PROJECT_ID = import.meta.env.VITE_APP_PUBLIC_STYTCH_PROJECT_ID || '';
export const STYTCH_PUBLIC_TOKEN = import.meta.env.VITE_APP_PUBLIC_STYTCH_TOKEN || '';

// MCP server (BYOK Agent connects here via Streamable HTTP)
export const MCP_URL = import.meta.env.VITE_APP_MCP_URL || 'http://localhost:5051/mcp';

// Where the SPA fetches `.well-known/oauth-protected-resource/mcp` and runs
// DCR. In production (Traefik in front) this is the same host as MCP_URL.
// In local dev without Traefik, the discovery endpoints live on the backend
// (5001), not the MCP server (5051), so we default to API_BASE_URL.
export const MCP_DISCOVERY_URL = import.meta.env.VITE_APP_MCP_DISCOVERY_URL || API_BASE_URL;
