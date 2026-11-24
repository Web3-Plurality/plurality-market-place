import { apiGet, apiPut, apiDelete } from '../utils/api';
import { SP_API_URL } from '../utils/env';

/**
 * Verified-platform badges for minted buckets.
 *
 * Flow: the creator's Smart Profile private attestation on Sapphire commits
 * to a Merkle root over their connected platform accounts (one salted leaf
 * each). To attach badges, the creator signs a disclosure message with their
 * wallet; sp-api returns a Merkle multi-proof for ONLY the chosen platforms;
 * our backend verifies that proof against the on-chain root before storing.
 * Undisclosed platforms stay private.
 */

export interface BucketBadgeInfo {
  platformType: string;
  username: string | null;
  userPlatformId: string | null;
  wallet?: string;
  privateAttestationUID?: string;
}

export interface AttestationInfo {
  wallet: string;
  onchainAttestationUID: string;
  privateAttestationUID: string | null;
  attestationChain: string | null;
  connectedPlatforms: string[];
}

/**
 * EXACT mirror of sp-api's disclosureMessage() — the signature is verified
 * against this format server-side, so change them in lockstep.
 */
export function disclosureMessage(wallet: string, platforms: string[], issuedAt: string): string {
  return (
    'Plurality Smart Profile disclosure\n' +
    `Wallet: ${wallet.toLowerCase()}\n` +
    `Platforms: ${platforms.map((p) => p.toLowerCase()).sort().join(',')}\n` +
    `Issued at: ${issuedAt}`
  );
}

const spApiBase = () => SP_API_URL.replace(/\/$/, '');

/** Attestation pointers + public platform names for a wallet (404 ⇒ null). */
export async function getAttestationInfo(wallet: string): Promise<AttestationInfo | null> {
  if (!SP_API_URL) return null;
  const res = await fetch(`${spApiBase()}/profile-map/smart-profiles/attestation-index/${wallet}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Smart-profile lookup failed (${res.status})`);
  const json = await res.json();
  return json?.data ?? null;
}

/** Ask sp-api for a Merkle multi-proof over the chosen platforms. */
export async function requestDisclosure(
  wallet: string,
  platforms: string[],
  signature: string,
  issuedAt: string,
): Promise<{ privateAttestationUID: string; proof: unknown }> {
  const res = await fetch(`${spApiBase()}/profile-map/smart-profiles/disclosure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, platforms, signature, issuedAt }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `Disclosure failed (${res.status})`);
  }
  return json.data;
}

/** Public: the badges attached to a bucket. */
export async function getBadges(profileId: string): Promise<BucketBadgeInfo[]> {
  const res = await apiGet(`/blockchain/badges/${profileId}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json?.badges ?? [];
}

/** Owner: replace the bucket's badge set with the verified disclosure. */
export async function setBadges(
  profileId: string,
  privateAttestationUID: string,
  proof: unknown,
): Promise<BucketBadgeInfo[]> {
  const res = await apiPut(`/blockchain/badges/${profileId}`, { privateAttestationUID, proof });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `Failed to attach badges (${res.status})`);
  return json?.badges ?? [];
}

/** Owner: remove all badges from the bucket. */
export async function clearBadges(profileId: string): Promise<void> {
  const res = await apiDelete(`/blockchain/badges/${profileId}`);
  if (!res.ok) throw new Error(`Failed to remove badges (${res.status})`);
}

/** Best-effort public profile link for a verified platform; null when unknown. */
export function platformLink(badge: BucketBadgeInfo): string | null {
  const platform = badge.platformType.toLowerCase();
  const user = badge.username || '';
  const id = badge.userPlatformId || '';
  switch (platform) {
    case 'twitter':
    case 'x':
      if (user) return `https://x.com/${encodeURIComponent(user)}`;
      // Numeric-id permalink works when only the platform id was attested.
      return id ? `https://x.com/i/user/${encodeURIComponent(id)}` : null;
    case 'github':
      return user ? `https://github.com/${encodeURIComponent(user)}` : null;
    case 'youtube':
      return user ? `https://www.youtube.com/@${encodeURIComponent(user)}` : null;
    case 'twitch':
      return user ? `https://www.twitch.tv/${encodeURIComponent(user)}` : null;
    case 'reddit':
      return user ? `https://www.reddit.com/user/${encodeURIComponent(user)}` : null;
    case 'roblox':
      if (id) return `https://www.roblox.com/users/${encodeURIComponent(id)}/profile`;
      // The roblox OAuth flow attests username only (userPlatformId stays
      // empty); this profile-search permalink resolves by username.
      return user ? `https://www.roblox.com/users/profile?username=${encodeURIComponent(user)}` : null;
    case 'steam':
      return id ? `https://steamcommunity.com/profiles/${encodeURIComponent(id)}` : null;
    default:
      return null;
  }
}
