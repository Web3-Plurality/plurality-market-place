import { apiGet } from '../utils/api';

/**
 * Result of probing the backend for a live auth session via the HttpOnly
 * cookie. On a successful response the user is signed in; on 401 or
 * network errors the caller should treat them as anonymous.
 */
export interface SessionRecoveryResult {
  success: boolean;
  userId?: string;
  authAddress?: string;
  /** Wallet is on the team's ADMIN_WALLETS allowlist (curation UI only;
   *  the backend re-checks on every curation call). */
  isAdmin?: boolean;
}

/**
 * Probe the backend's `/auth/siwe/session` endpoint to recover the current
 * user's identity from the HttpOnly auth cookie. Used by AuthInitializer on
 * every app load so localStorage state can never trust a token the backend
 * no longer recognises (logout in another tab, cookie expiry, manual clear).
 */
export async function tryRecoverSession(): Promise<SessionRecoveryResult> {
  try {
    const response = await apiGet('/auth/siwe/session');
    if (!response.ok) return { success: false };
    const data = await response.json();
    if (!data?.success) return { success: false };
    return {
      success: true,
      userId: data.userId,
      authAddress: data.authAddress,
      isAdmin: data.isAdmin === true,
    };
  } catch {
    return { success: false };
  }
}
