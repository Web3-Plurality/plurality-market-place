// API
export const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || '';

// MCP server (BYOK Agent connects here via Streamable HTTP)
export const MCP_URL = import.meta.env.VITE_APP_MCP_URL || 'http://localhost:5051/mcp';

// Chain the marketplace transacts on: 'testnet' (Sapphire testnet) or 'mainnet' (Sapphire mainnet).
// vite.config.ts fails the build on any other value.
export const MARKETPLACE_CHAIN: 'testnet' | 'mainnet' = import.meta.env.VITE_APP_CHAIN || 'testnet';

// Smart-profile widget (sp-ui), embedded in the Verify Profile dialog so users
// can attest their profile / connect socials and raise their daily AI quota.
// The widget takes the client-app id as a query param, so one deployment
// serves any registered client. Both empty → the dialog entry is hidden.
export const SP_WIDGET_URL = import.meta.env.VITE_APP_SP_WIDGET_URL || '';
export const SP_CLIENT_ID = import.meta.env.VITE_APP_SP_CLIENT_ID || '';
export const SP_API_URL = import.meta.env.VITE_APP_SP_API_URL || '';
