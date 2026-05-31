import { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { message, Input, Select } from 'antd';
import {
  MdRefresh,
  MdShoppingCart,
  MdSearch,
  MdGridView,
  MdViewList,
  MdStorefront,
  MdTrendingUp,
  MdLocalOffer,
} from 'react-icons/md';
import { useAccount, useWriteContract, useSwitchChain } from 'wagmi';
import { formatEther } from 'viem';
import { apiGet, apiPost } from '../../utils/api';
import PluralityMemoryNFTABI from '../../abis/PluralityMemoryNFT.json';
import { oasisSapphireTestnet } from '../../services/wagmi';
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

/* ── List-view buy controls (reused from old code) ────── */

const BuyButton = styled.button`
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

const OwnBadge = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 6px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
`;

const PriceInfo = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-right: 8px;
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

/* ══════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════ */

const BrowseListings = ({ onPurchased }: Props) => {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [listings, setListings] = useState<NftSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingTokenId, setBuyingTokenId] = useState<number | null>(null);
  const [buyingLabel, setBuyingLabel] = useState('');

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
    const prices = listings
      .filter((n) => n.listingPrice)
      .map((n) => BigInt(n.listingPrice!));
    const floor = prices.length > 0 ? prices.reduce((a, b) => (a < b ? a : b)) : BigInt(0);
    const volume = prices.length > 0 ? prices.reduce((a, b) => a + b, BigInt(0)) : BigInt(0);
    return {
      total,
      floor: prices.length > 0 ? formatEther(floor) : '--',
      volume: prices.length > 0 ? formatEther(volume) : '--',
    };
  }, [listings]);

  /* ── Buy handler (preserved from original) ───────────── */

  const handleBuy = useCallback(
    async (nft: NftSnapshot) => {
      if (!isConnected || !address) {
        message.error('Please connect your wallet first');
        return;
      }

      if (chainId !== oasisSapphireTestnet.id) {
        try {
          switchChain({ chainId: oasisSapphireTestnet.id });
          message.info('Please switch to Oasis Sapphire Testnet');
          return;
        } catch {
          message.error('Failed to switch network');
          return;
        }
      }

      if (!nft.tokenId || !nft.listingPrice) {
        message.error('Invalid listing data');
        return;
      }

      // Belt-and-suspenders: contract rejects own-buy with "Cannot buy own
       // listing". Backend may omit ownerWallet (v1 — no chain lookup yet);
       // in that case skip the local check and let the contract enforce.
      if (nft.ownerWallet && nft.ownerWallet.toLowerCase() === address.toLowerCase()) {
        message.error('You cannot buy your own listing');
        return;
      }

      setBuyingTokenId(nft.tokenId);
      try {
        const infoRes = await apiGet('/blockchain/contract-info');
        const info = infoRes.ok ? await infoRes.json() : null;
        const contractAddr = info?.nftAddress;
        if (!contractAddr) {
          message.error('Contract address not available');
          return;
        }

        setBuyingLabel('Confirm in MetaMask...');
        const txHash = await writeContractAsync({
          address: contractAddr as `0x${string}`,
          abi: PluralityMemoryNFTABI,
          functionName: 'buyBucket',
          args: [BigInt(nft.tokenId)],
          value: BigInt(nft.listingPrice),
        });

        setBuyingLabel('Confirming on-chain...');

        const { createPublicClient, http, defineChain } = await import('viem');
        const chain = defineChain({
          id: 23295,
          name: 'Oasis Sapphire Testnet',
          nativeCurrency: { name: 'TEST', symbol: 'TEST', decimals: 18 },
          rpcUrls: { default: { http: ['https://testnet.sapphire.oasis.io'] } },
        });
        const publicClient = createPublicClient({ chain, transport: http() });
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        // Record purchase in backend
        setBuyingLabel('Updating records...');
        await apiPost(`/blockchain/buy/${nft.tokenId}`, { txHash });

        message.success('NFT purchased successfully!');
        setDetailNft(null); // close modal if open
        onPurchased?.();
        fetchListings();
      } catch (error: any) {
        const msg = error.message?.includes('User rejected')
          ? 'Transaction rejected'
          : 'Failed to buy';
        message.error(msg);
      } finally {
        setBuyingTokenId(null);
        setBuyingLabel('');
      }
    },
    [isConnected, address, chainId, switchChain, writeContractAsync, onPurchased, fetchListings],
  );

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
        <StatCard>
          <StatIcon>
            <MdTrendingUp size={20} />
          </StatIcon>
          <StatContent>
            <StatValue>{stats.volume}</StatValue>
            <StatLabel>Total Volume (TEST)</StatLabel>
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
            const isBuying = buyingTokenId === nft.tokenId;
            const priceDisplay = nft.listingPrice
              ? formatEther(BigInt(nft.listingPrice))
              : '?';

            return (
              <NftPreviewCard
                key={nft.id}
                nft={nft}
                onClick={() => setDetailNft(nft)}
                actions={
                  isOwnListing ? (
                    <OwnBadge>Your Listing</OwnBadge>
                  ) : (
                    <BuyButton onClick={() => handleBuy(nft)} disabled={isBuying}>
                      <MdShoppingCart size={14} />
                      {isBuying ? buyingLabel || '…' : `Buy ${priceDisplay} TEST`}
                    </BuyButton>
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
            const isBuying = buyingTokenId === nft.tokenId;
            const priceDisplay = nft.listingPrice
              ? formatEther(BigInt(nft.listingPrice))
              : '?';

            return (
              <NftCard
                key={nft.id}
                nft={{ ...nft, listingActive: true }}
                actions={
                  <>
                    <PriceInfo>Price: {priceDisplay} TEST</PriceInfo>
                    {isOwnListing ? (
                      <OwnBadge>Your Listing</OwnBadge>
                    ) : (
                      <BuyButton onClick={() => handleBuy(nft)} disabled={isBuying}>
                        <MdShoppingCart size={16} />
                        {isBuying
                          ? buyingLabel || 'Processing...'
                          : `Buy for ${priceDisplay} TEST`}
                      </BuyButton>
                    )}
                  </>
                }
              />
            );
          })}
        </ListContainer>
      )}

      {/* Detail Modal */}
      <NftDetailModal
        nft={detailNft}
        open={!!detailNft}
        onClose={() => setDetailNft(null)}
        onBuy={handleBuy}
        isBuying={buyingTokenId === detailNft?.tokenId}
        buyingLabel={buyingLabel}
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
