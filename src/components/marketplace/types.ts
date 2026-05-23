/**
 * Shape returned by /blockchain/{my-nfts,acquired-nfts,marketplace/listings}.
 * Post-rewrite the NFT *is* the bucket (no snapshot table), so this type is
 * really "bucket-as-NFT" — but the name is kept stable so the component code
 * doesn't churn during the rewrite.
 *
 * Fields that came from the old snapshot table (contexts[], ownerWallet,
 * importedProfileId) are now optional. The backend may fill them in later
 * via chain-lookups; for v1 the marketplace UI must tolerate them being
 * absent.
 */
export interface SnapshotContext {
  contextId: string;
  title: string;
  description: string;
  contentHash: string;
  sourceType: string;
  registeredOnChain: boolean;
}

export interface NftSnapshot {
  id: string;
  tokenId: number | null;
  profileId: string;
  profileName: string;
  profileImage: string | null;
  title: string | null;
  tagline: string | null;
  description: string | null;
  coverImage: string | null;
  contexts?: SnapshotContext[]; // dropped from backend; left optional for UI compat
  metadataURI: string | null;
  bucketHash?: string | null;
  mintTxHash: string | null;
  chain: string | null;
  ownerWallet?: string; // requires chain lookup; absent in v1 responses
  listingActive: boolean;
  listingPrice: string | null;
  importedProfileId?: string | null; // gone — no more auto-import on buy
  mintedAt: string | null;
  createdAt: string;

  /** Derived by the backend on /my-nfts. Sold buckets are filtered out
   *  server-side so they never reach this client.
   *   frozen     — tx1 (registerContextBatch) not yet on-chain; can be cancelled
   *   registered — tx1 confirmed but tx2 (mintBucket) not yet signed; can resume
   *   minted     — tokenId set AND wallet still holds the NFT */
  mintStatus?: 'frozen' | 'registered' | 'minted';
}
