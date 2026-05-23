import { useState, useEffect, useCallback } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { MdInventory2, MdToken, MdShoppingCart, MdStorefront } from 'react-icons/md';
import { apiGet } from '../../utils/api';
import StudioPage from '../../pages/StudioPage';
import MintedNftList from './MintedNftList';
import AcquiredNftList from './AcquiredNftList';
import BrowseListings from './BrowseListings';
import type { NftSnapshot } from './types';

// Scoped palette for the marketplace dashboard — tuned so cards drawn by the
// existing tab components (NftCard, BucketCard, etc.) render against the dark
// glass panel without each file needing to be rewritten.
const marketplacePalette = {
  primary: '#8b5cf6',
  primaryRgb: '139, 92, 246',
  primaryGradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
  extensionAccent: '#a78bfa',
  extensionAccentRgb: '167, 139, 250',
  background: 'rgba(255, 255, 255, 0.02)',
  backgroundSecondary: 'rgba(255, 255, 255, 0.04)',
  backgroundGradient: 'linear-gradient(135deg, rgba(20, 22, 40, 0.5) 0%, rgba(12, 14, 28, 0.5) 100%)',
  backgroundHover: 'rgba(255, 255, 255, 0.08)',
  backgroundSelected: 'rgba(99, 102, 241, 0.18)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.04)',
  shadowColor: 'rgba(0, 0, 0, 0.45)',
  shadowPrimary: 'rgba(99, 102, 241, 0.35)',
  success: '#34d399',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#22d3ee',
};

const marketplaceTheme = {
  mode: 'dark' as const,
  isDark: true,
  colors: marketplacePalette,
};

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const TitleRow = styled.div`
  margin-bottom: 24px;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: -0.3px;
  background: linear-gradient(120deg, #ffffff 0%, #c7d2fe 50%, #f9a8d4 100%);
  background-size: 200% 200%;
  -webkit-background-clip: text;
          background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const PageSubtitle = styled.p`
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.55);
`;

const TabBar = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  margin-bottom: 24px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  flex-wrap: wrap;
`;

const Tab = styled.button<{ $active: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  color: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.6)')};
  background: ${({ $active }) =>
    $active
      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(139, 92, 246, 0.95) 50%, rgba(236, 72, 153, 0.95) 100%)'
      : 'transparent'};
  box-shadow: ${({ $active }) => ($active ? '0 8px 22px rgba(99, 102, 241, 0.35)' : 'none')};
  transition: color 0.2s ease, background 0.2s ease, transform 0.15s ease;

  &:hover {
    color: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.95)')};
    background: ${({ $active }) =>
      $active
        ? 'linear-gradient(135deg, rgba(99, 102, 241, 1) 0%, rgba(139, 92, 246, 1) 50%, rgba(236, 72, 153, 1) 100%)'
        : 'rgba(255, 255, 255, 0.06)'};
  }
`;

const Badge = styled.span<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: ${({ $active }) => ($active ? 'rgba(255, 255, 255, 0.25)' : 'rgba(99, 102, 241, 0.25)')};
  color: ${({ $active }) => ($active ? '#fff' : '#c7d2fe')};
  font-size: 11px;
  font-weight: 600;
`;

const Panel = styled.div`
  position: relative;
  padding: 28px;
  border-radius: 20px;
  /* Solid-ish dark surface (no backdrop-filter) — keeps the look but avoids
     stacking another GPU-blur layer on top of the page-level animations. */
  background: linear-gradient(180deg, rgba(20, 22, 40, 0.92) 0%, rgba(12, 14, 28, 0.92) 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);

  /* Subtle gradient halo border, same family as the login card */
  &::before {
    content: '';
    position: absolute;
    inset: -1px;
    padding: 1px;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(236, 72, 153, 0.25) 50%, rgba(34, 211, 238, 0.25));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
            mask-composite: exclude;
    opacity: 0.5;
    pointer-events: none;
  }

  @media (max-width: 720px) {
    padding: 18px;
    border-radius: 16px;
  }
`;

type TabKey = 'browse' | 'drafts' | 'minted' | 'acquired';

const TAB_META: Record<TabKey, { title: string; subtitle: string }> = {
  browse: {
    title: 'Browse Marketplace',
    subtitle: 'Discover memory NFTs minted by other users.',
  },
  drafts: {
    title: 'My Drafts',
    subtitle: 'Editable memory buckets. Once minted, they move to My Minted NFTs and become read-only.',
  },
  minted: {
    title: 'My Minted NFTs',
    subtitle: 'NFTs you minted from your own buckets. Sell on the marketplace to transfer ownership.',
  },
  acquired: {
    title: 'Acquired NFTs',
    subtitle: 'NFTs you purchased from other creators.',
  },
};

const MarketplaceDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('browse');
  const [mintedNfts, setMintedNfts] = useState<NftSnapshot[]>([]);
  const [acquiredNfts, setAcquiredNfts] = useState<NftSnapshot[]>([]);
  const [loadingMinted, setLoadingMinted] = useState(false);
  const [loadingAcquired, setLoadingAcquired] = useState(false);

  const fetchMintedNfts = useCallback(async () => {
    setLoadingMinted(true);
    try {
      const nftsRes = await apiGet('/blockchain/my-nfts');
      if (nftsRes.ok) {
        const data = await nftsRes.json();
        setMintedNfts(data.nfts || []);
      }
    } catch (error) {
      console.error('Failed to fetch minted NFTs:', error);
    } finally {
      setLoadingMinted(false);
    }
  }, []);

  const fetchAcquiredNfts = useCallback(async () => {
    setLoadingAcquired(true);
    try {
      const response = await apiGet('/blockchain/acquired-nfts');
      if (response.ok) {
        const data = await response.json();
        setAcquiredNfts(data.nfts || []);
      }
    } catch (error) {
      console.error('Failed to fetch acquired NFTs:', error);
    } finally {
      setLoadingAcquired(false);
    }
  }, []);

  useEffect(() => {
    fetchMintedNfts();
    fetchAcquiredNfts();
  }, [fetchMintedNfts, fetchAcquiredNfts]);

  const handlePurchased = useCallback(() => {
    fetchAcquiredNfts();
  }, [fetchAcquiredNfts]);

  const meta = TAB_META[activeTab];

  return (
    <Container>
      <TitleRow>
        <PageTitle>{meta.title}</PageTitle>
        <PageSubtitle>{meta.subtitle}</PageSubtitle>
      </TitleRow>

      <TabBar>
        <Tab $active={activeTab === 'browse'} onClick={() => setActiveTab('browse')}>
          <MdStorefront size={16} />
          Browse
        </Tab>
        <Tab $active={activeTab === 'drafts'} onClick={() => setActiveTab('drafts')}>
          <MdInventory2 size={16} />
          My Drafts
        </Tab>
        <Tab $active={activeTab === 'minted'} onClick={() => setActiveTab('minted')}>
          <MdToken size={16} />
          My Minted NFTs
          {mintedNfts.length > 0 && <Badge $active={activeTab === 'minted'}>{mintedNfts.length}</Badge>}
        </Tab>
        <Tab $active={activeTab === 'acquired'} onClick={() => setActiveTab('acquired')}>
          <MdShoppingCart size={16} />
          Acquired NFTs
          {acquiredNfts.length > 0 && <Badge $active={activeTab === 'acquired'}>{acquiredNfts.length}</Badge>}
        </Tab>
      </TabBar>

      <Panel>
        <ThemeProvider theme={marketplaceTheme}>
          {activeTab === 'browse' && <BrowseListings onPurchased={handlePurchased} />}
          {/* StudioPage tells us whenever a draft is minted (moves to My Minted)
              or a mint is cancelled (comes back as a draft). Either way the
              minted list needs to refetch so it doesn't show a stale state. */}
          {activeTab === 'drafts' && <StudioPage onBucketStateChanged={fetchMintedNfts} />}
          {activeTab === 'minted' && <MintedNftList nfts={mintedNfts} loading={loadingMinted} onRefresh={fetchMintedNfts} />}
          {activeTab === 'acquired' && <AcquiredNftList nfts={acquiredNfts} loading={loadingAcquired} onRefresh={fetchAcquiredNfts} />}
        </ThemeProvider>
      </Panel>
    </Container>
  );
};

export default MarketplaceDashboard;
