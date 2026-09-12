import styled from 'styled-components';
import { MdStorefront } from 'react-icons/md';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import NftPreviewCard from './NftPreviewCard';
import type { NftSnapshot } from './types';

/**
 * The explore grid — purely presentational. Fetching, search, category and
 * sort state live in MarketplaceDashboard (the homepage) so the hero slider
 * and the grid share one listings source.
 */
interface Props {
  listings: NftSnapshot[];
  loading: boolean;
  /** True when the user has typed a query / picked a category — tunes the empty copy. */
  filtered: boolean;
  onSelect: (nft: NftSnapshot) => void;
}

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 18px;
`;

// One card == one bucket. It shows the aggregate across all sellers; picking a
// seller + quantity (the actual buy) happens inside the detail modal.
const ViewButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.85;
  }
`;

const AggregateInfo = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Price = styled.span`
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const OwnBadge = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 6px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 56px 24px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 14px;
  border-radius: 16px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
`;

const SkeletonCard = styled.div`
  height: 300px;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.04) 25%, rgba(255, 255, 255, 0.09) 50%, rgba(255, 255, 255, 0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;

  @keyframes shimmer {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }
`;

function aggregateSummary(nft: NftSnapshot) {
  const floorWei = nft.floorPrice ?? nft.listingPrice;
  const copies = nft.copiesAvailable ?? 0;
  const sellers = nft.sellerCount ?? 0;
  return (
    <AggregateInfo>
      {floorWei ? (
        <>
          from <Price>{formatEther(BigInt(floorWei))} TEST</Price>
        </>
      ) : (
        'price unavailable'
      )}
      {' · '}
      {copies} cop{copies === 1 ? 'y' : 'ies'} · {sellers} seller{sellers === 1 ? '' : 's'}
    </AggregateInfo>
  );
}

const BrowseListings = ({ listings, loading, filtered, onSelect }: Props) => {
  const { address } = useAccount();

  if (loading) {
    return (
      <GridContainer>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </GridContainer>
    );
  }

  if (listings.length === 0) {
    return (
      <EmptyState>
        {filtered
          ? 'Nothing matches that search or category yet. Try another one.'
          : 'No listings available yet. When someone lists a Skill for sale, it will appear here.'}
      </EmptyState>
    );
  }

  return (
    <GridContainer>
      {listings.map((nft) => {
        const isOwnListing =
          !!address && !!nft.ownerWallet && nft.ownerWallet.toLowerCase() === address.toLowerCase();

        return (
          <NftPreviewCard
            key={nft.id}
            nft={nft}
            onClick={() => onSelect(nft)}
            meta={aggregateSummary(nft)}
            actions={
              isOwnListing ? (
                <OwnBadge>Your Listing</OwnBadge>
              ) : (
                <ViewButton onClick={() => onSelect(nft)}>
                  <MdStorefront size={14} />
                  View
                </ViewButton>
              )
            }
          />
        );
      })}
    </GridContainer>
  );
};

export default BrowseListings;
