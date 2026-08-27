/**
 * Thin wrapper around the backend's /pat/tokens endpoints. Used by the
 * Tokens Manager dialog in the header dropdown.
 *
 * Backend reference: src/services/token-service/controllers/token-controller.ts
 *  - GET    /pat/tokens          → list visible (active + recently revoked)
 *  - POST   /pat/tokens          → create; plaintext returned ONCE in `token`
 *  - DELETE /pat/tokens/:id      → revoke
 */

import { apiDelete, apiGet, apiPost } from '../utils/api';

export type PatScope = 'mcp:tools' | 'mcp:tools:read' | 'mcp:tools:write';
export type PatStatus = 'active' | 'expired' | 'revoked' | 'rotated';

export interface PatRow {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: PatScope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  rotatedToId: string | null;
  status: PatStatus;
}

/** The full record returned at create time, including the plaintext token
 *  (shown to the user exactly once — never re-fetchable). */
export interface PatCreatedRecord {
  id: string;
  token: string;
  name: string;
  tokenPrefix: string;
  scopes: PatScope[];
  expiresAt: string | null;
  createdAt: string;
}

export interface CreatePatPayload {
  name: string;
  scopes: PatScope[];
  /** Days as a number (e.g. 30) or the literal string "never". */
  expiresIn?: number | 'never';
}

export async function listPats(): Promise<PatRow[]> {
  const r = await apiGet('/pat/tokens');
  if (!r.ok) throw new Error(`Failed to list tokens (${r.status})`);
  return r.json();
}

export async function createPat(payload: CreatePatPayload): Promise<PatCreatedRecord> {
  const body: Record<string, unknown> = { name: payload.name, scopes: payload.scopes };
  if (payload.expiresIn !== undefined) {
    body.expiresIn = payload.expiresIn === 'never' ? 'never' : String(payload.expiresIn);
  }
  const r = await apiPost('/pat/tokens', body);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Failed to create token (${r.status})`);
  }
  return r.json();
}

export async function revokePat(id: string): Promise<void> {
  const r = await apiDelete(`/pat/tokens/${id}`);
  if (!r.ok && r.status !== 204) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `Failed to revoke token (${r.status})`);
  }
}
