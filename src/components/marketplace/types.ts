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

/** One seller's active listing for a token (from /marketplace/listings/:tokenId). */
export interface SellerListing {
  seller: string; // wallet, lowercased
  price: string; // PER-UNIT price in wei
  amount: number; // units available from this seller
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
  /** Marketplace category key (see categories.ts); null for legacy mints. */
  category?: string | null;
  contexts?: SnapshotContext[]; // dropped from backend; left optional for UI compat
  contextCount?: number;        // batch-counted by backend (replaces contexts.length on cards)
  metadataURI: string | null;
  bucketHash?: string | null;
  mintTxHash: string | null;
  chain: string | null;
  ownerWallet?: string; // requires chain lookup; absent in v1 responses
  listingActive: boolean;
  listingPrice: string | null; // on browse = floor (min per-unit) across sellers
  importedProfileId?: string | null; // gone — no more auto-import on buy

  // ── Limited-edition (multi-copy) fields ──────────────────────────
  editionSize?: number; // copies minted (1..MAX_COPIES); 1 for legacy single mints
  // Marketplace aggregate for the browse "one card per bucket" view:
  floorPrice?: string | null; // min per-unit price across active sellers (wei)
  copiesAvailable?: number; // total units listed across all sellers
  sellerCount?: number; // number of distinct active sellers

  // The CURRENT wallet's own listing on this token (from /my-nfts, /acquired-nfts).
  // Distinct from listingActive (bucket-level "anyone listed") — this drives the
  // List-vs-Delist button + the "Your Listing" badge for the holder.
  myListingActive?: boolean;
  myListingPrice?: string | null; // per-unit wei
  myListingAmount?: number;
  copiesOwned?: number; // how many copies of this edition the current wallet holds

  mintedAt: string | null;
  createdAt: string;

  /** Derived by the backend on /my-nfts. Sold buckets are filtered out
   *  server-side so they never reach this client.
   *   frozen     — tx1 (registerContextBatch) not yet on-chain; can be cancelled
   *   registered — tx1 confirmed but tx2 (mintBucket) not yet signed; can resume
   *   minted     — tokenId set AND wallet still holds the NFT */
  mintStatus?: 'frozen' | 'registered' | 'minted';
}
