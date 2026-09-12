import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from 'styled-components';
import { MdInventory2, MdToken, MdShoppingCart } from 'react-icons/md';
import { apiGet } from '../../utils/api';
import StudioPage from '../../pages/StudioPage';
import MintedNftList from './MintedNftList';
import AcquiredNftList from './AcquiredNftList';
import type { NftSnapshot } from './types';
import {
  Container,
  TitleRow,
  PageTitle,
  PageSubtitle,
  TabBar,
  Tab,
  Badge,
  Panel,
  marketplaceTheme,
} from './pageChrome';

type TabKey = 'drafts' | 'minted' | 'acquired';

const TAB_SUBTITLES: Record<TabKey, string> = {
  drafts: 'Editable memories. Once minted, they move to My Minted NFTs and become read-only.',
  minted: 'NFTs you minted from your own memories. Sell on the marketplace to transfer ownership.',
  acquired: 'NFTs you purchased from other creators.',
};

const MyPlayground = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('drafts');
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

  return (
    <Container>
      <TitleRow>
        <PageTitle>My Playground</PageTitle>
        <PageSubtitle>{TAB_SUBTITLES[activeTab]}</PageSubtitle>
      </TitleRow>

      <TabBar>
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
          {/* StudioPage tells us whenever a draft is minted (moves to Minted Skills)
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

export default MyPlayground;
