import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { message, Input, Modal } from 'antd';
import { MdRefresh, MdSell, MdRemoveShoppingCart } from 'react-icons/md';
import { useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import NftPreviewCard from './NftPreviewCard';
import NftDetailModal from './NftDetailModal';
import { apiPost, apiGet } from '../../utils/api';
import PluralityMemoryNFTABI from '../../abis/PluralityMemoryNFT.json';
import type { NftSnapshot } from './types';

interface Props {
  nfts: NftSnapshot[];
  loading: boolean;
  onRefresh: () => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const Count = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 12px;
  cursor: pointer;

  &:hover { color: ${({ theme }) => theme.colors.textPrimary}; }
`;

const ActionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'danger' | 'default' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid ${({ theme, $variant }) =>
    $variant === 'danger' ? '#ff4d4f' : $variant === 'primary' ? theme.colors.primary : theme.colors.border};
  background: transparent;
  color: ${({ theme, $variant }) =>
    $variant === 'danger' ? '#ff4d4f' : $variant === 'primary' ? theme.colors.primary : theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: ${({ theme, $variant }) =>
      $variant === 'danger' ? '#ff4d4f' : $variant === 'primary' ? theme.colors.primary : theme.colors.backgroundSecondary};
    color: ${({ $variant }) => ($variant === 'danger' || $variant === 'primary' ? '#fff' : undefined)};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

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

const AcquiredNftList = ({ nfts, loading, onRefresh }: Props) => {
  const { writeContractAsync } = useWriteContract();
  const [detailNft, setDetailNft] = useState<NftSnapshot | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);
  const [processingLabel, setProcessingLabel] = useState('');
  const [listingTokenId, setListingTokenId] = useState<number | null>(null);
  const [listingPrice, setListingPrice] = useState('');


  const getContractAddress = useCallback(async (): Promise<string | null> => {
    const res = await apiGet('/blockchain/contract-info');
    const info = res.ok ? await res.json() : null;
    return info?.nftAddress || null;
  }, []);

  const handleList = useCallback(async (tokenId: number, price: string) => {
    if (!price || isNaN(parseFloat(price))) {
      message.error('Please enter a valid price');
      return;
    }

    setProcessing(tokenId);
    setListingTokenId(null);
    setListingPrice('');

    try {
      const addr = await getContractAddress();
      if (!addr) { message.error('Contract address not available'); return; }

      const priceWei = parseEther(price);

      // Approve
      setProcessingLabel('Approving…');
      try {
        await writeContractAsync({
          address: addr as `0x${string}`,
          abi: PluralityMemoryNFTABI,
          functionName: 'setApprovalForAll',
          args: [addr as `0x${string}`, true],
        });
      } catch (e: any) {
        if (e.message?.includes('User rejected')) { message.error('Approval rejected'); return; }
      }

      // List
      setProcessingLabel('Signing…');
      const listTxHash = await writeContractAsync({
        address: addr as `0x${string}`,
        abi: PluralityMemoryNFTABI,
        functionName: 'listBucket',
        args: [BigInt(tokenId), priceWei],
      });

      setProcessingLabel('Confirming…');
      const { createPublicClient, http, defineChain } = await import('viem');
      const chain = defineChain({
        id: 23295, name: 'Oasis Sapphire Testnet',
        nativeCurrency: { name: 'TEST', symbol: 'TEST', decimals: 18 },
        rpcUrls: { default: { http: ['https://testnet.sapphire.oasis.io'] } },
      });
      const publicClient = createPublicClient({ chain, transport: http() });
      await publicClient.waitForTransactionReceipt({ hash: listTxHash });

      await apiPost(`/blockchain/list/${tokenId}`, { price: priceWei.toString(), txHash: listTxHash });
      message.success('NFT listed for sale!');
      onRefresh();
    } catch (error: any) {
      const msg = error.message?.includes('User rejected') ? 'Transaction rejected' : 'Failed to list';
      message.error(msg);
    } finally {
      setProcessing(null);
      setProcessingLabel('');
    }
  }, [writeContractAsync, onRefresh, getContractAddress]);

  const handleDelist = useCallback(async (tokenId: number) => {
    setProcessing(tokenId);
    try {
      const addr = await getContractAddress();
      if (!addr) { message.error('Contract address not available'); return; }

      setProcessingLabel('Signing…');
      const txHash = await writeContractAsync({
        address: addr as `0x${string}`,
        abi: PluralityMemoryNFTABI,
        functionName: 'delistBucket',
        args: [BigInt(tokenId)],
      });

      setProcessingLabel('Confirming…');
      const { createPublicClient, http, defineChain } = await import('viem');
      const chain = defineChain({
        id: 23295, name: 'Oasis Sapphire Testnet',
        nativeCurrency: { name: 'TEST', symbol: 'TEST', decimals: 18 },
        rpcUrls: { default: { http: ['https://testnet.sapphire.oasis.io'] } },
      });
      const publicClient = createPublicClient({ chain, transport: http() });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      await apiPost(`/blockchain/delist/${tokenId}`, { txHash });
      message.success('NFT delisted');
      onRefresh();
    } catch (error: any) {
      const msg = error.message?.includes('User rejected') ? 'Transaction rejected' : 'Failed to delist';
      message.error(msg);
    } finally {
      setProcessing(null);
      setProcessingLabel('');
    }
  }, [writeContractAsync, onRefresh, getContractAddress]);

  if (loading) return <Loading>Loading acquired NFTs...</Loading>;

  return (
    <Container>
      <TopBar>
        <Count>{nfts.length} acquired NFT{nfts.length !== 1 ? 's' : ''}</Count>
        <RefreshButton onClick={onRefresh}>
          <MdRefresh size={14} />
          Refresh
        </RefreshButton>
      </TopBar>

      {nfts.length === 0 ? (
        <EmptyState>
          No acquired NFTs yet. When you buy an NFT from the marketplace, it will appear here.
        </EmptyState>
      ) : (
        <Grid>
          {nfts.map((nft) => {
            const isProcessing = processing === nft.tokenId;

            return (
              <NftPreviewCard
                key={nft.id}
                nft={nft}
                onClick={() => setDetailNft(nft)}
                actions={
                  <ActionsRow>
                    {nft.tokenId && (
                      nft.listingActive ? (
                        <ActionButton
                          $variant="danger"
                          onClick={() => handleDelist(nft.tokenId!)}
                          disabled={isProcessing}
                        >
                          <MdRemoveShoppingCart size={11} />
                          {isProcessing ? processingLabel || '…' : 'Delist'}
                        </ActionButton>
                      ) : (
                        <ActionButton
                          $variant="primary"
                          onClick={() => setListingTokenId(nft.tokenId)}
                          disabled={isProcessing}
                        >
                          <MdSell size={11} />
                          {isProcessing ? processingLabel || '…' : 'List'}
                        </ActionButton>
                      )
                    )}
                  </ActionsRow>
                }
              />
            );
          })}
        </Grid>
      )}

      <Modal
        title="List NFT for Sale"
        open={listingTokenId !== null}
        onOk={() => listingTokenId && handleList(listingTokenId, listingPrice)}
        onCancel={() => { setListingTokenId(null); setListingPrice(''); }}
        okText="List"
      >
        <p>Set the price in TEST (Oasis Sapphire Testnet native token):</p>
        <Input
          placeholder="e.g. 0.1"
          value={listingPrice}
          onChange={(e) => setListingPrice(e.target.value)}
          suffix="TEST"
        />
      </Modal>

      <NftDetailModal
        nft={detailNft}
        open={!!detailNft}
        onClose={() => setDetailNft(null)}
        onBuy={() => {}}
        isBuying={false}
        buyingLabel=""
        isOwnListing={true}
        // Buyers see only verified/unverified status — they don't own the
        // underlying bucket, so registering on-chain belongs to the minter.
        // Backend enforces this independently via resolveProfileAccess.
      />
    </Container>
  );
};

export default AcquiredNftList;
