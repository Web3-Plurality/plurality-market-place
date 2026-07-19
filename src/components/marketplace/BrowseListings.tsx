import { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Input, Select } from 'antd';
import {
  MdRefresh,
  MdStorefront,
  MdSearch,
  MdGridView,
  MdViewList,
  MdLocalOffer,
} from 'react-icons/md';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { apiGet } from '../../utils/api';
import NftCard from './NftCard';
import NftPreviewCard from './NftPreviewCard';
import NftDetailModal from './NftDetailModal';
import type { NftSnapshot } from './types';

interface Props {
  onPurchased?: () => void;
}

type SortOption = 'price_asc' | 'price_desc' | 'newest' | 'most_contexts';
type LayoutMode = 'grid' | 'list';

/* ── Stats Bar ─────────────────────────────────────────── */

const StatsBar = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
`;

const StatCard = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
`;

const StatIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.primary}12;
  color: ${({ theme }) => theme.colors.primary};
`;

const StatContent = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatValue = styled.span`
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const StatLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

/* ── Search + Sort Bar ─────────────────────────────────── */

const ToolBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const SearchWrapper = styled.div`
  flex: 1;
  min-width: 200px;
  position: relative;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }) => theme.colors.textMuted};
  display: flex;
  align-items: center;
  z-index: 1;
  pointer-events: none;
`;

const SearchInput = styled(Input)`
  padding-left: 36px !important;
  border-radius: 10px !important;
  border-color: ${({ theme }) => theme.colors.border} !important;
  background: ${({ theme }) => theme.colors.background} !important;
  color: ${({ theme }) => theme.colors.textPrimary} !important;
  height: 38px;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textMuted} !important;
  }
`;

const SortSelect = styled(Select)`
  min-width: 180px;

  .ant-select-selector {
    border-radius: 10px !important;
    height: 38px !important;
    border-color: ${({ theme }) => theme.colors.border} !important;
    background: ${({ theme }) => theme.colors.background} !important;
    color: ${({ theme }) => theme.colors.textPrimary} !important;
  }
`;

const LayoutToggle = styled.div`
  display: flex;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  overflow: hidden;
`;

const LayoutBtn = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 36px;
  border: none;
  cursor: pointer;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.textMuted};
  background: ${({ $active, theme }) =>
    $active ? `${theme.colors.primary}12` : theme.colors.background};
  transition: all 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 12px;
  cursor: pointer;
  height: 38px;

  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

/* ── Grid / List containers ────────────────────────────── */

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
`;

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

/* ── Card aggregate summary + view action ─────────────── */

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
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AggregateInfo = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-right: 8px;
`;

const OwnBadge = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 6px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
`;

/* ── Empty / Loading ───────────────────────────────────── */

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 14px;
`;

const Loading = styled.div`
  text-align: center;
  padding: 48px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

/* ── Sort helpers ──────────────────────────────────────── */

function sortListings(list: NftSnapshot[], sort: SortOption): NftSnapshot[] {
  const clone = [...list];
  switch (sort) {
    case 'price_asc':
      return clone.sort((a, b) => {
        const pa = BigInt(a.listingPrice || '0');
        const pb = BigInt(b.listingPrice || '0');
        return pa < pb ? -1 : pa > pb ? 1 : 0;
      });
    case 'price_desc':
      return clone.sort((a, b) => {
        const pa = BigInt(a.listingPrice || '0');
        const pb = BigInt(b.listingPrice || '0');
        return pa > pb ? -1 : pa < pb ? 1 : 0;
      });
    case 'newest':
      return clone.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case 'most_contexts':
      return clone.sort(
        (a, b) => (b.contexts?.length || 0) - (a.contexts?.length || 0),
      );
    default:
      return clone;
  }
}

/* ── Aggregate summary for the browse card (one card == one bucket) ── */

function aggregateSummary(nft: NftSnapshot): string {
  const floorWei = nft.floorPrice ?? nft.listingPrice;
  const from = floorWei ? `from ${formatEther(BigInt(floorWei))} TEST` : 'price unavailable';
  const copies = nft.copiesAvailable ?? 0;
  const sellers = nft.sellerCount ?? 0;
  return `${from} · ${copies} cop${copies === 1 ? 'y' : 'ies'} · ${sellers} seller${sellers === 1 ? '' : 's'}`;
}

/* ══════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════ */

const BrowseListings = ({ onPurchased }: Props) => {
  const { address } = useAccount();
  const [listings, setListings] = useState<NftSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [detailNft, setDetailNft] = useState<NftSnapshot | null>(null);

  /* ── Fetch ────────────────────────────────────────────── */

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet('/blockchain/marketplace/listings');
      if (response.ok) {
        const data = await response.json();
        setListings(data.listings || []);
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  /* ── Filtered + sorted list ──────────────────────────── */

  const filteredListings = useMemo(() => {
    let result = listings;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((nft) => nft.profileName.toLowerCase().includes(q));
    }
    return sortListings(result, sortOption);
  }, [listings, searchQuery, sortOption]);

  /* ── Stats ───────────────────────────────────────────── */

  const stats = useMemo(() => {
    const total = listings.length;
    // floorPrice is the min per-unit price for the bucket; listingPrice mirrors
    // it, so either works — prefer floorPrice when present.
    const prices = listings
      .map((n) => n.floorPrice ?? n.listingPrice)
      .filter((p): p is string => !!p)
      .map((p) => BigInt(p));
    const floor = prices.length > 0 ? prices.reduce((a, b) => (a < b ? a : b)) : BigInt(0);
    return {
      total,
      floor: prices.length > 0 ? formatEther(floor) : '--',
    };
  }, [listings]);

  /* ── Purchase-complete: refresh the (now-changed) listings ─ */

  // Buying moved into the detail modal (a bucket has copies across multiple
  // sellers, so the buyer must pick one). The modal drives the tx and calls
  // this back on success so the browse view re-fetches and the parent can react.
  const handlePurchased = useCallback(() => {
    setDetailNft(null);
    onPurchased?.();
    fetchListings();
  }, [onPurchased, fetchListings]);

  /* ── Render ──────────────────────────────────────────── */

  if (loading) return <Loading>Loading marketplace listings...</Loading>;

  return (
    <div>
      {/* Stats Bar */}
      <StatsBar>
        <StatCard>
          <StatIcon>
            <MdStorefront size={20} />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.total}</StatValue>
            <StatLabel>Total Listings</StatLabel>
          </StatContent>
        </StatCard>
        <StatCard>
          <StatIcon>
            <MdLocalOffer size={20} />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.floor}</StatValue>
            <StatLabel>Floor Price (TEST)</StatLabel>
          </StatContent>
        </StatCard>
      </StatsBar>

      {/* Search + Sort + Layout toggle */}
      <ToolBar>
        <SearchWrapper>
          <SearchIcon>
            <MdSearch size={18} />
          </SearchIcon>
          <SearchInput
            placeholder="Search by bucket name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
          />
        </SearchWrapper>

        <SortSelect
          value={sortOption}
          onChange={(val) => setSortOption(val as SortOption)}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'price_asc', label: 'Price: Low to High' },
            { value: 'price_desc', label: 'Price: High to Low' },
            { value: 'most_contexts', label: 'Most Contexts' },
          ]}
        />

        <LayoutToggle>
          <LayoutBtn $active={layout === 'grid'} onClick={() => setLayout('grid')} title="Grid view">
            <MdGridView size={18} />
          </LayoutBtn>
          <LayoutBtn $active={layout === 'list'} onClick={() => setLayout('list')} title="List view">
            <MdViewList size={18} />
          </LayoutBtn>
        </LayoutToggle>

        <RefreshButton onClick={fetchListings}>
          <MdRefresh size={14} />
          Refresh
        </RefreshButton>
      </ToolBar>

      {/* Listings */}
      {filteredListings.length === 0 ? (
        <EmptyState>
          {searchQuery
            ? 'No listings match your search.'
            : 'No listings available yet. When someone lists an NFT for sale, it will appear here.'}
        </EmptyState>
      ) : layout === 'grid' ? (
        <GridContainer>
          {filteredListings.map((nft) => {
            const isOwnListing =
              !!address && !!nft.ownerWallet && nft.ownerWallet.toLowerCase() === address.toLowerCase();

            return (
              <NftPreviewCard
                key={nft.id}
                nft={nft}
                onClick={() => setDetailNft(nft)}
                meta={<AggregateInfo>{aggregateSummary(nft)}</AggregateInfo>}
                actions={
                  isOwnListing ? (
                    <OwnBadge>Your Listing</OwnBadge>
                  ) : (
                    <ViewButton onClick={() => setDetailNft(nft)}>
                      <MdStorefront size={14} />
                      View
                    </ViewButton>
                  )
                }
              />
            );
          })}
        </GridContainer>
      ) : (
        <ListContainer>
          {filteredListings.map((nft) => {
            const isOwnListing =
              !!address && !!nft.ownerWallet && nft.ownerWallet.toLowerCase() === address.toLowerCase();

            return (
              <NftCard
                key={nft.id}
                nft={{ ...nft, listingActive: true }}
                actions={
                  <>
                    <AggregateInfo>{aggregateSummary(nft)}</AggregateInfo>
                    {isOwnListing ? (
                      <OwnBadge>Your Listing</OwnBadge>
                    ) : (
                      <ViewButton onClick={() => setDetailNft(nft)}>
                        <MdStorefront size={16} />
                        View & Buy
                      </ViewButton>
                    )}
                  </>
                }
              />
            );
          })}
        </ListContainer>
      )}

      {/* Detail Modal — the buy surface. onBuy is a no-op here (the modal owns
          the multi-seller buy flow); handlePurchased refreshes on success. */}
      <NftDetailModal
        nft={detailNft}
        open={!!detailNft}
        onClose={() => setDetailNft(null)}
        onBuy={() => {}}
        isBuying={false}
        buyingLabel=""
        previewOnly
        onPurchased={handlePurchased}
        isOwnListing={
          !!address &&
          !!detailNft?.ownerWallet &&
          detailNft.ownerWallet.toLowerCase() === address.toLowerCase()
        }
      />
    </div>
  );
};

export default BrowseListings;
