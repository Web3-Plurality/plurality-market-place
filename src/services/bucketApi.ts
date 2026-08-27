/**
 * Thin wrapper around the backend's /ai/profile + /ai/context endpoints used
 * by Studio (bucket grid + detail) and the C2C bucket picker. Keeps fetch +
 * URL + content-type handling out of the React components so the UI is purely
 * state + render.
 */

import { apiGet, apiPost, apiDelete } from '../utils/api';
import { API_BASE_URL } from '../utils/env';

// ── Bucket (a.k.a. user_ai_profile) ───────────────────────────────────────

export interface Bucket {
  id: string;
  profileName: string;
  image: string;
  createdAt: string;
  contextCount?: number;
  isOwner?: boolean;

  /** Hash-as-identity / NFT-as-access-token state. A bucket is either:
   *  - a draft  (isImmutable=false, mintedTokenId=null) — editable by creator
   *  - prepared (isImmutable=true,  mintedTokenId=null) — frozen pending confirm
   *  - minted   (isImmutable=true,  mintedTokenId=N)   — readable only by NFT holder
   */
  bucketHash?: string | null;
  isImmutable?: boolean;
  mintedTokenId?: number | null;
  mintedAt?: string | null;
  listingActive?: boolean;
  listingPrice?: string | null;
}

interface ListProfilesResponse {
  profiles: Bucket[];
}

/**
 * GET /ai/profile — bucket list for the current wallet.
 *
 * Default (Studio): drafts only. Once a bucket is minted, it leaves Studio
 * and lives in My Minted NFTs.
 *
 * `includeMinted: true` (Talk to Memory / agent): drafts + every minted
 * bucket where the wallet still holds the NFT. Lets the agent search across
 * memory you own as drafts or as NFTs, without exposing buckets you sold.
 */
export async function listBuckets(opts?: { includeMinted?: boolean }): Promise<Bucket[]> {
  const qs = opts?.includeMinted ? '?includeMinted=true' : '';
  const response = await apiGet(`/ai/profile${qs}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch buckets (${response.status})`);
  }
  const data = (await response.json()) as ListProfilesResponse;
  return data.profiles || [];
}

/** POST /ai/profile — create a new bucket. */
export async function createBucket(profileName: string, image?: string): Promise<Bucket> {
  const response = await apiPost('/ai/profile', { profileName, image });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create bucket (${response.status})`);
  }
  return response.json();
}

/** DELETE /ai/profile/:profileId — owner only. Cascades: deletes all contexts
 *  in the bucket plus their vectors on the AI service side. */
export async function deleteBucket(profileId: string): Promise<void> {
  const response = await apiDelete(`/ai/profile/${profileId}`);
  if (!response.ok && response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete bucket (${response.status})`);
  }
}

export type ContextStatus = 'inprogress' | 'completed' | 'error' | 'pending';

export interface BucketContext {
  contextId: string;
  profileId: string;
  title: string;
  description: string | null;
  sourceType: string; // 'text' | 'file' | 'chat' | etc.
  sourcePlatform: string | null;
  status: ContextStatus;
  errorMessage: string | null;
  contentSize: number | null;
  contentHash: string | null;
  registeredOnChain: boolean;
  registryTxHash: string | null;
  createdAt: string;
  originalFileName: string | null;
}

export interface ListContextsResponse {
  contexts: BucketContext[];
}

/** GET /ai/context?profileId=… — returns all contexts in a bucket. */
export async function listContexts(profileId: string): Promise<BucketContext[]> {
  const response = await apiGet(`/ai/context?profileId=${encodeURIComponent(profileId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch contexts (${response.status})`);
  }
  const data = (await response.json()) as ListContextsResponse;
  return data.contexts || [];
}

/** POST /ai/context/add-raw-context — adds a plain-text context. */
export async function addRawContext(profileId: string, context: string): Promise<BucketContext> {
  const response = await apiPost('/ai/context/add-raw-context', { profileId, context });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to add context (${response.status})`);
  }
  return response.json();
}

/**
 * POST /ai/context/upload-file — uploads a file (multipart). Note we use
 * apiFetch directly because apiPost forces JSON content-type, while file
 * upload needs the browser to set the multipart boundary itself.
 */
export async function uploadFile(profileId: string, file: File): Promise<BucketContext> {
  const formData = new FormData();
  formData.append('profileId', profileId);
  formData.append('file', file);

  // Bypass apiFetch to avoid Content-Type collision; still send credentials.
  const response = await fetch(`${API_BASE_URL}/ai/context/upload-file`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to upload file (${response.status})`);
  }
  return response.json();
}

/** DELETE /ai/context/:contextId — owner only. */
export async function deleteContext(contextId: string): Promise<void> {
  const response = await apiDelete(`/ai/context/${contextId}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete context (${response.status})`);
  }
}

