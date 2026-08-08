import { useCallback } from 'react';
import { apiPost } from '../utils/api';
import ContextRegistryABI from '../abis/ContextRegistry.json';
import PluralityMemoryNFTABI from '../abis/PluralityMemoryNFT.json';

// Re-exported so callers (MintBucketButton, MintNftDialog) can typecheck against
// the same shape as the hook returns.
export interface NftMintMetadata {
  title?: string;
  tagline?: string;
  description?: string;
  coverImage?: string;
  /** Number of NFT copies to mint (1..10). Each copy is a tradable read-access token. */
  copies?: number;
}

/**
 * Step 1 of 2 — register-batch prepare.
 * After this you call MetaMask with the returned callData. The frontend
 * doesn't need to know the ABI; the backend already encoded the function call.
 */
export interface RegisterPrepareResult {
  profileId: string;
  bucketHash: `0x${string}`;
  contextIds: string[];        // echoed back to confirmRegistration
  contractAddress: `0x${string}`;
  callData: `0x${string}`;
}

/** Step 1 confirm — tells backend the tx landed; backend re-checks the registry. */
export interface RegisterConfirmResult {
  confirmed: string[];          // contextIds the chain shows as registered
  pending: string[];            // not yet visible — try again or accept partial
  txHash: string;
  bucketHash: string;
}

/** Step 2 of 2 — mintBucket prepare. */
export interface MintPrepareResult {
  profileId: string;
  bucketHash: `0x${string}`;
  metadataURI: string;
  contractAddress: `0x${string}`;
  callData: `0x${string}`;
  mintFee: string;
}

/**
 * Hook for the two-tx register-then-mint flow.
 *
 *   tx1: registerContextBatch  →  ContextRegistry          (user pays gas)
 *   tx2: mintBucket            →  PluralityMemoryNFT       (user pays gas + mintFee)
 *
 * The hook only does the network plumbing — MetaMask signing is wired by
 * the consuming component (MintBucketButton) via wagmi's useSendTransaction
 * + useWriteContract. Splitting prevents the hook from owning UI-coupled
 * state (isSigning, isConfirming).
 *
 * The ABI imports below aren't strictly needed (backend encodes callData)
 * but re-exported so consumers that want to call the contract directly
 * (e.g. setApprovalForAll in the marketplace components) have it handy.
 */
export const MEMORY_NFT_ABI = PluralityMemoryNFTABI;
export const CONTEXT_REGISTRY_ABI = ContextRegistryABI;

export function useMemoryNFT() {
  // ── tx1: register-batch ────────────────────────────────────────────────
  const prepareRegistration = useCallback(
    async (profileId: string, metadata?: NftMintMetadata): Promise<RegisterPrepareResult> => {
      const response = await apiPost(`/blockchain/mint/${profileId}/prepare-registration`, metadata || {});
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Failed to prepare registration');
      }
      return (await response.json()) as RegisterPrepareResult;
    },
    [],
  );

  const confirmRegistration = useCallback(
    async (profileId: string, txHash: string, contextIds: string[]): Promise<RegisterConfirmResult> => {
      const response = await apiPost(`/blockchain/mint/${profileId}/confirm-registration`, {
        txHash,
        contextIds,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Failed to confirm registration');
      }
      return (await response.json()) as RegisterConfirmResult;
    },
    [],
  );

  // ── tx2: mint ──────────────────────────────────────────────────────────
  // `copies` (1..10, default 1) mints N tradable read-access NFTs. The mint fee
  // is flat regardless of copies — the backend echoes it back in `mintFee`.
  const prepareMint = useCallback(async (profileId: string, copies = 1): Promise<MintPrepareResult> => {
    const response = await apiPost(`/blockchain/mint/${profileId}/prepare-mint`, { copies });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to prepare mint');
    }
    return (await response.json()) as MintPrepareResult;
  }, []);

  const confirmMint = useCallback(async (profileId: string, txHash: string) => {
    const response = await apiPost(`/blockchain/mint/${profileId}/confirm-mint`, { txHash });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to confirm mint');
    }
    return (await response.json()) as { status: string; tokenId: number; txHash: string; bucketHash: string };
  }, []);

  // ── cancel (only valid in `frozen` state — see backend) ────────────────
  const cancelMint = useCallback(async (profileId: string) => {
    try {
      const response = await apiPost(`/blockchain/mint/${profileId}/cancel`, {});
      return await response.json();
    } catch (error: any) {
      console.error('Failed to cancel mint:', error);
      return null;
    }
  }, []);

  // ── helpers ────────────────────────────────────────────────────────────
  const uploadCover = useCallback(async (dataUrl: string): Promise<string | null> => {
    try {
      const response = await apiPost('/blockchain/upload-cover', { image: dataUrl });
      if (!response.ok) return null;
      const data = await response.json();
      return data?.url || null;
    } catch {
      return null;
    }
  }, []);

  return {
    prepareRegistration,
    confirmRegistration,
    prepareMint,
    confirmMint,
    cancelMint,
    uploadCover,
  };
}
