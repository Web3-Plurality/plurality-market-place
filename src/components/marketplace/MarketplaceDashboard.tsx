import { useCallback, useEffect, useMemo, useState } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { Select } from 'antd';
import { MdSearch, MdRefresh, MdExpandMore } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { apiGet } from '../../utils/api';
import { Container, marketplaceTheme } from './pageChrome';
import { CATEGORIES } from './categories';
import HeroSlider from './HeroSlider';
import BrowseListings from './BrowseListings';
import NftDetailModal from './NftDetailModal';
import type { NftSnapshot } from './types';

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'most_contexts';

const HERO_SIZE = 5;

// ─── Search bar (OpenSea-style pill: category picker | query) ────────────

const SearchRow = styled.div`
  display: flex;
  justify-content: center;
  margin: 4px 0 26px;
`;

const SearchPill = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 760px;
  height: 54px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:focus-within {
    border-color: rgba(139, 92, 246, 0.75);
    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.18), 0 10px 40px rgba(0, 0, 0, 0.35);
  }

  /* antd Select inside the pill: strip its chrome so it reads as one control. */
  .ant-select {
    height: 100%;
    min-width: 170px;
  }
  .ant-select .ant-select-selector {
    height: 100% !important;
    padding: 0 12px 0 20px !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    color: #fff !important;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
  .ant-select .ant-select-selection-item {
    color: #fff !important;
    line-height: 1 !important;
  }
  .ant-select .ant-select-arrow {
    color: rgba(255, 255, 255, 0.6);
  }

  @media (max-width: 720px) {
    height: 48px;
    .ant-select { min-width: 60px; }
    .ant-select .ant-select-selection-item span[data-label] { display: none; }
  }
`;

const PillDivider = styled.span`
  width: 1px;
  height: 26px;
  background: rgba(255, 255, 255, 0.14);
  flex-shrink: 0;
`;

const SearchIcon = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0 10px 0 16px;
  color: rgba(255, 255, 255, 0.5);
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: #fff;
  font-size: 15px;
  padding-right: 20px;

  &::placeholder {
    color: rgba(255, 255, 255, 0.42);
  }
`;

// ─── Category pills (row under the hero) ─────────────────────────────────

const Pills = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 26px 0 6px;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const Pill = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border-radius: 999px;
  border: 1px solid ${({ $active }) => ($active ? 'transparent' : 'rgba(255, 255, 255, 0.12)')};
  background: ${({ $active }) =>
    $active
      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(139, 92, 246, 0.95) 50%, rgba(236, 72, 153, 0.95) 100%)'
      : 'rgba(255, 255, 255, 0.04)'};
  color: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.72)')};
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: ${({ $active }) => ($active ? '0 8px 22px rgba(99, 102, 241, 0.35)' : 'none')};

  &:hover {
    color: #fff;
    border-color: ${({ $active }) => ($active ? 'transparent' : 'rgba(139, 92, 246, 0.5)')};
    background: ${({ $active }) =>
      $active
        ? 'linear-gradient(135deg, rgba(99, 102, 241, 1) 0%, rgba(139, 92, 246, 1) 50%, rgba(236, 72, 153, 1) 100%)'
        : 'rgba(99, 102, 241, 0.15)'};
  }
`;

const PillCount = styled.span<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
  background: ${({ $active }) => ($active ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)')};
  color: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.6)')};
`;

// ─── Explore section header ──────────────────────────────────────────────

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 22px 0 16px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: #fff;

  span {
    margin-left: 8px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
  }
`;

const SectionTools = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SortSelect = styled(Select)`
  min-width: 170px;

  .ant-select-selector {
    border-radius: 10px !important;
    height: 38px !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
    background: rgba(255, 255, 255, 0.04) !important;
    color: #fff !important;
  }
  .ant-select-selection-item {
    color: #fff !important;
  }
  .ant-select-arrow {
    color: rgba(255, 255, 255, 0.6);
  }
`;

const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    color: #fff;
    border-color: rgba(139, 92, 246, 0.5);
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────

function sortListings(list: NftSnapshot[], sort: SortOption): NftSnapshot[] {
  const clone = [...list];
  const price = (n: NftSnapshot) => BigInt(n.floorPrice ?? n.listingPrice ?? '0');
  switch (sort) {
    case 'price_asc':
      return clone.sort((a, b) => (price(a) < price(b) ? -1 : price(a) > price(b) ? 1 : 0));
    case 'price_desc':
      return clone.sort((a, b) => (price(a) > price(b) ? -1 : price(a) < price(b) ? 1 : 0));
    case 'most_contexts':
      return clone.sort(
        (a, b) => (b.contextCount ?? b.contexts?.length ?? 0) - (a.contextCount ?? a.contexts?.length ?? 0),
      );
    case 'newest':
    default:
      return clone.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

// Hero picks: newest listings, cover-image ones first so the slider looks
// good, capped at HERO_SIZE.
function pickFeatured(list: NftSnapshot[]): NftSnapshot[] {
  const newest = sortListings(list, 'newest');
  const withCover = newest.filter((n) => n.coverImage || n.profileImage);
  const without = newest.filter((n) => !(n.coverImage || n.profileImage));
  return [...withCover, ...without].slice(0, HERO_SIZE);
}

// ─── Homepage ────────────────────────────────────────────────────────────

const MarketplaceDashboard = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const [listings, setListings] = useState<NftSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [detailNft, setDetailNft] = useState<NftSnapshot | null>(null);

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
    void fetchListings();
  }, [fetchListings]);

  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of listings) {
      const key = n.category || 'other';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [listings]);

  const visible = useMemo(() => {
    let result = listings;
    if (category !== 'all') {
      result = result.filter((n) => (n.category || 'other') === category);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((n) =>
        [n.title, n.profileName, n.tagline, n.description]
          .filter((s): s is string => !!s)
          .some((s) => s.toLowerCase().includes(q)),
      );
    }
    return sortListings(result, sort);
  }, [listings, category, query, sort]);

  const featured = useMemo(() => pickFeatured(listings), [listings]);
  const isFiltered = category !== 'all' || query.trim().length > 0;

  // Buying happens inside the detail modal; on success re-fetch so sold-out
  // copies drop out of the grid and the hero.
  const handlePurchased = useCallback(() => {
    setDetailNft(null);
    void fetchListings();
  }, [fetchListings]);

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: <span>🌐 <span data-label>All categories</span></span> },
      ...CATEGORIES.map((c) => ({
        value: c.key,
        label: (
          <span>
            {c.emoji} <span data-label>{c.label}</span>
          </span>
        ),
      })),
    ],
    [],
  );

  return (
    <ThemeProvider theme={marketplaceTheme}>
      <Container>
        <SearchRow>
          <SearchPill>
            <Select
              value={category}
              onChange={(v) => setCategory(v as string)}
              options={categoryOptions}
              popupMatchSelectWidth={false}
              variant="borderless"
              suffixIcon={<MdExpandMore size={18} />}
            />
            <PillDivider />
            <SearchIcon>
              <MdSearch size={20} />
            </SearchIcon>
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search memories by title, topic or description…"
              aria-label="Search marketplace"
            />
          </SearchPill>
        </SearchRow>

        <HeroSlider
          items={featured}
          onSelect={setDetailNft}
          onEmptyCta={() => navigate('/marketplace/playground')}
        />

        <Pills>
          <Pill $active={category === 'all'} onClick={() => setCategory('all')}>
            🌐 All
            <PillCount $active={category === 'all'}>{listings.length}</PillCount>
          </Pill>
          {CATEGORIES.map((c) => {
            const n = countsByCategory[c.key] ?? 0;
            return (
              <Pill key={c.key} $active={category === c.key} onClick={() => setCategory(c.key)}>
                <span>{c.emoji}</span>
                {c.label}
                {n > 0 && <PillCount $active={category === c.key}>{n}</PillCount>}
              </Pill>
            );
          })}
        </Pills>

        <SectionHeader>
          <SectionTitle>
            Explore memories
            <span>
              {visible.length} item{visible.length === 1 ? '' : 's'}
            </span>
          </SectionTitle>
          <SectionTools>
            <SortSelect
              value={sort}
              onChange={(v) => setSort(v as SortOption)}
              options={[
                { value: 'newest', label: 'Recently listed' },
                { value: 'price_asc', label: 'Price: low to high' },
                { value: 'price_desc', label: 'Price: high to low' },
                { value: 'most_contexts', label: 'Most contexts' },
              ]}
            />
            <RefreshButton onClick={() => void fetchListings()}>
              <MdRefresh size={14} />
              Refresh
            </RefreshButton>
          </SectionTools>
        </SectionHeader>

        <BrowseListings listings={visible} loading={loading} filtered={isFiltered} onSelect={setDetailNft} />

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
            !!address && !!detailNft?.ownerWallet && detailNft.ownerWallet.toLowerCase() === address.toLowerCase()
          }
        />
      </Container>
    </ThemeProvider>
  );
};

export default MarketplaceDashboard;
