import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { message, Input, Modal } from 'antd';
import { MdRefresh, MdSell, MdRemoveShoppingCart, MdPlayArrow } from 'react-icons/md';
import { useWriteContract, useSendTransaction, usePublicClient } from 'wagmi';
import { parseEther } from 'viem';
import NftPreviewCard from './NftPreviewCard';
import NftDetailModal from './NftDetailModal';
import { apiPost, apiGet } from '../../utils/api';
import PluralityMemoryNFTABI from '../../abis/PluralityMemoryNFT.json';
import { useMemoryNFT } from '../../hooks/useMemoryNFT';
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

const ActionButton = styled.button<{ $variant?: 'primary' | 'danger' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid ${({ theme, $variant }) =>
    $variant === 'danger' ? '#ff4d4f' : theme.colors.primary};
  background: transparent;
  color: ${({ theme, $variant }) =>
    $variant === 'danger' ? '#ff4d4f' : theme.colors.primary};
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: ${({ theme, $variant }) =>
      $variant === 'danger' ? '#ff4d4f' : theme.colors.primary};
    color: #fff;
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

const MintedNftList = ({ nfts, loading, onRefresh }: Props) => {
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const { prepareMint, confirmMint } = useMemoryNFT();
  const [listingTokenId, setListingTokenId] = useState<number | null>(null);
  const [cancellingProfileId, setCancellingProfileId] = useState<string | null>(null);
  const [resumingProfileId, setResumingProfileId] = useState<string | null>(null);

  // Escape hatch for stuck "frozen" mints (tx1 never landed): /cancel flips
  // isImmutable back to false so the bucket reappears in My Drafts. Only
  // valid while status='frozen' — once tx1 lands, the backend rejects /cancel
  // because the contexts are already on-chain.
  const handleCancelPending = useCallback(
    async (profileId: string) => {
      setCancellingProfileId(profileId);
      try {
        const res = await apiPost(`/blockchain/mint/${profileId}/cancel`, {});
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          message.error(err.message || err.error || 'Failed to cancel mint');
          return;
        }
        message.success('Mint cancelled — bucket back in My Drafts');
        await onRefresh();
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Failed to cancel mint');
      } finally {
        setCancellingProfileId(null);
      }
    },
    [onRefresh],
  );

  // Resume tx2 (mintBucket) for buckets stuck in 'registered' state. Contexts
  // already landed in tx1 so we can't roll back — only forward. Re-runs the
  // same prepareMint → sendTransaction → confirmMint flow MintBucketButton
  // uses for tx2, just without the dialog (metadata was already captured the
  // first time and persisted by the backend).
  const handleResumeMint = useCallback(
    async (profileId: string) => {
      setResumingProfileId(profileId);
      try {
        const mintPrep = await prepareMint(profileId);
        const txHash = await sendTransactionAsync({
          to: mintPrep.contractAddress,
          data: mintPrep.callData,
          value: BigInt(mintPrep.mintFee),
        });
        message.info('Minting… waiting for on-chain confirmation');
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        }
        const minted = await confirmMint(profileId, txHash);
        if (minted?.tokenId) {
          message.success(`Minted as NFT #${minted.tokenId}!`);
        }
        await onRefresh();
      } catch (err) {
        const msg = (err as Error)?.message || '';
        if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied')) {
          message.error('Mint rejected — you can retry from here at any time.');
        } else {
          message.error(msg || 'Failed to resume mint');
        }
      } finally {
        setResumingProfileId(null);
      }
    },
    [prepareMint, sendTransactionAsync, publicClient, confirmMint, onRefresh],
  );
  const [listingPrice, setListingPrice] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);
  const [processingLabel, setProcessingLabel] = useState('');
  const [detailNft, setDetailNft] = useState<NftSnapshot | null>(null);

  const getContractAddress = useCallback(async (): Promise<string | null> => {
    const infoRes = await apiGet('/blockchain/contract-info');
    const info = infoRes.ok ? await infoRes.json() : null;
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
      if (!addr) {
        message.error('Contract address not available');
        return;
      }

      const priceWei = parseEther(price);

      // Step 1: Approve contract (setApprovalForAll) if needed. We don't
      // use the return value — wagmi will revert if signing failed.
      setProcessingLabel('Approving…');
      try {
        await writeContractAsync({
          address: addr as `0x${string}`,
          abi: PluralityMemoryNFTABI,
          functionName: 'setApprovalForAll',
          args: [addr as `0x${string}`, true],
        });
      } catch (e: any) {
        // If already approved, this might fail — that's ok
        if (!e.message?.includes('User rejected')) {
          // Ignore non-rejection errors (already approved)
        } else {
          message.error('Approval rejected');
          return;
        }
      }

      // Step 2: List on-chain
      setProcessingLabel('Signing…');
      const listTxHash = await writeContractAsync({
        address: addr as `0x${string}`,
        abi: PluralityMemoryNFTABI,
        functionName: 'listBucket',
        args: [BigInt(tokenId), priceWei],
      });

      setProcessingLabel('Confirming…');
      message.info('Waiting for on-chain confirmation...');

      // Wait for tx to be mined (poll for receipt)
      const { createPublicClient, http } = await import('viem');
      const { defineChain } = await import('viem');
      const chain = defineChain({
        id: 23295,
        name: 'Oasis Sapphire Testnet',
        nativeCurrency: { name: 'TEST', symbol: 'TEST', decimals: 18 },
        rpcUrls: { default: { http: ['https://testnet.sapphire.oasis.io'] } },
      });
      const publicClient = createPublicClient({ chain, transport: http() });
      await publicClient.waitForTransactionReceipt({ hash: listTxHash });

      // Step 3: Record in backend AFTER on-chain confirmation
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
      if (!addr) {
        message.error('Contract address not available');
        return;
      }

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
        id: 23295,
        name: 'Oasis Sapphire Testnet',
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

  if (loading) return <Loading>Loading minted NFTs...</Loading>;

  return (
    <Container>
      <TopBar>
        <Count>{nfts.length} minted NFT{nfts.length !== 1 ? 's' : ''}</Count>
        <RefreshButton onClick={onRefresh}>
          <MdRefresh size={14} />
          Refresh
        </RefreshButton>
      </TopBar>

      {nfts.length === 0 ? (
        <EmptyState>
          No minted NFTs yet. Go to "My Drafts" tab to mint your first memory bucket as an NFT.
        </EmptyState>
      ) : (
        <Grid>
          {nfts.map((nft) => {
            // mintStatus is set by /my-nfts (frozen|registered|minted). Older
            // clients may still see absent mintStatus → infer from tokenId.
            const status =
              nft.mintStatus || (nft.tokenId ? 'minted' : 'frozen');
            const isCancelling = cancellingProfileId === nft.profileId;
            const isResuming = resumingProfileId === nft.profileId;
            // frozen → tx1 never landed, safe to cancel
            // registered → tx1 on-chain, can only move forward (resume tx2)
            const statusBadge =
              status === 'registered' ? (
                <ActionButton
                  onClick={() => handleResumeMint(nft.profileId)}
                  disabled={isResuming}
                >
                  <MdPlayArrow size={14} />
                  {isResuming ? 'Resuming…' : 'Resume mint'}
                </ActionButton>
              ) : status === 'frozen' ? (
                <ActionButton
                  $variant="danger"
                  onClick={() => handleCancelPending(nft.profileId)}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelling…' : 'Cancel pending mint'}
                </ActionButton>
              ) : null;
            return (
              <NftPreviewCard
                key={nft.id}
                nft={nft}
                onClick={() => setDetailNft(nft)}
                actions={
                  status === 'minted' && nft.tokenId ? (
                    nft.listingActive ? (
                      <ActionButton
                        $variant="danger"
                        onClick={() => handleDelist(nft.tokenId!)}
                        disabled={processing === nft.tokenId}
                      >
                        <MdRemoveShoppingCart size={14} />
                        {processing === nft.tokenId ? processingLabel || '…' : 'Delist'}
                      </ActionButton>
                    ) : (
                      <ActionButton onClick={() => setListingTokenId(nft.tokenId)} disabled={processing === nft.tokenId}>
                        <MdSell size={14} />
                        {processing === nft.tokenId ? processingLabel || '…' : 'List for Sale'}
                      </ActionButton>
                    )
                  ) : (
                    statusBadge
                  )
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
      />
    </Container>
  );
};

export default MintedNftList;
