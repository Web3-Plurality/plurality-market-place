import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { message, Input, Modal } from 'antd';
import { MdRefresh, MdSell, MdRemoveShoppingCart, MdPlayArrow } from 'react-icons/md';
import { useAccount, useWriteContract, useSendTransaction, usePublicClient } from 'wagmi';
import { parseEther } from 'viem';
import { oasisSapphireTestnet } from '../../services/wagmi';
import { describeTxError } from '../../utils/txErrors';
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
  const { address } = useAccount();
  // Always talk to Sapphire for reads / receipts, whatever chain the wallet is on.
  const sapphireClient = usePublicClient({ chainId: oasisSapphireTestnet.id });
  // Upper bound for "copies to list" = what this wallet actually holds.
  const [listingMax, setListingMax] = useState<number>(1);
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
        message.success('Mint cancelled. The Skill is back in Drafts.');
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
          message.error('Mint rejected. You can retry from here at any time.');
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
  const [listingAmount, setListingAmount] = useState('1');
  const [processing, setProcessing] = useState<number | null>(null);
  const [processingLabel, setProcessingLabel] = useState('');
  const [detailNft, setDetailNft] = useState<NftSnapshot | null>(null);

  const getContractAddress = useCallback(async (): Promise<string | null> => {
    const infoRes = await apiGet('/blockchain/contract-info');
    const info = infoRes.ok ? await infoRes.json() : null;
    return info?.nftAddress || null;
  }, []);

  const handleList = useCallback(async (tokenId: number, price: string, amount: string) => {
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      message.error('Please enter a valid price');
      return;
    }

    const amountInt = parseInt(amount, 10);
    if (!Number.isInteger(amountInt) || amountInt < 1) {
      message.error('Please enter a valid number of copies (min 1)');
      return;
    }
    if (amountInt > listingMax) {
      message.error(
        `You hold ${listingMax} cop${listingMax === 1 ? 'y' : 'ies'} of this NFT, so you can list at most ${listingMax}.`,
      );
      return;
    }
    if (!address || !sapphireClient) {
      message.error('Connect your wallet first');
      return;
    }

    setProcessing(tokenId);
    setListingTokenId(null);
    setListingPrice('');
    setListingAmount('1');

    try {
      const addr = await getContractAddress();
      if (!addr) {
        message.error('Contract address not available');
        return;
      }
      const contract = addr as `0x${string}`;
      const priceWei = parseEther(price);

      // Step 1: marketplace approval, only if not granted yet (saves a signature).
      const approved = (await sapphireClient.readContract({
        address: contract,
        abi: PluralityMemoryNFTABI,
        functionName: 'isApprovedForAll',
        args: [address, contract],
      })) as boolean;
      if (!approved) {
        setProcessingLabel('Approving…');
        const approveTx = await writeContractAsync({
          address: contract,
          abi: PluralityMemoryNFTABI,
          functionName: 'setApprovalForAll',
          args: [contract, true],
        });
        const approveReceipt = await sapphireClient.waitForTransactionReceipt({ hash: approveTx });
        if (approveReceipt.status !== 'success') throw new Error('The approval transaction was reverted on-chain');
      }

      // Step 2: dry-run first. A revert (e.g. listing more copies than held)
      // surfaces here with its reason, before the wallet asks for a signature.
      setProcessingLabel('Checking…');
      await sapphireClient.simulateContract({
        address: contract,
        abi: PluralityMemoryNFTABI,
        functionName: 'listBucket',
        args: [BigInt(tokenId), priceWei, BigInt(amountInt)],
        account: address,
      });

      // Step 3: the real transaction.
      setProcessingLabel('Signing…');
      const listTxHash = await writeContractAsync({
        address: contract,
        abi: PluralityMemoryNFTABI,
        functionName: 'listBucket',
        args: [BigInt(tokenId), priceWei, BigInt(amountInt)],
      });

      setProcessingLabel('Confirming…');
      const receipt = await sapphireClient.waitForTransactionReceipt({ hash: listTxHash });
      if (receipt.status !== 'success') {
        throw new Error('The listing transaction was reverted on-chain. Nothing was listed.');
      }

      // Step 4: record in the backend only after on-chain confirmation.
      const res = await apiPost(`/blockchain/list/${tokenId}`, { txHash: listTxHash });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.message || body.error || `The listing is on-chain but could not be recorded (${res.status}). Refresh in a moment.`,
        );
      }
      message.success('NFT listed for sale!');
      onRefresh();
    } catch (error: unknown) {
      message.error(describeTxError(error, 'Listing failed'));
    } finally {
      setProcessing(null);
      setProcessingLabel('');
    }
  }, [address, sapphireClient, listingMax, writeContractAsync, onRefresh, getContractAddress]);

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
          No minted Skills yet. Go to the "Drafts" tab to mint your first Skill as an NFT.
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
                    nft.myListingActive ? (
                      <ActionButton
                        $variant="danger"
                        onClick={() => handleDelist(nft.tokenId!)}
                        disabled={processing === nft.tokenId}
                      >
                        <MdRemoveShoppingCart size={14} />
                        {processing === nft.tokenId ? processingLabel || '…' : 'Delist'}
                      </ActionButton>
                    ) : (
                      <ActionButton
                        onClick={() => {
                          setListingMax(Math.max(1, nft.copiesOwned ?? nft.editionSize ?? 1));
                          setListingTokenId(nft.tokenId);
                        }}
                        disabled={processing === nft.tokenId}
                      >
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
        onOk={() => listingTokenId && handleList(listingTokenId, listingPrice, listingAmount)}
        onCancel={() => { setListingTokenId(null); setListingPrice(''); setListingAmount('1'); }}
        okText="List"
      >
        <p style={{ marginBottom: 4 }}>Price per copy (TEST):</p>
        <Input
          placeholder="e.g. 0.1"
          value={listingPrice}
          onChange={(e) => setListingPrice(e.target.value)}
          suffix="TEST"
        />
        <p style={{ marginBottom: 4, marginTop: 12 }}>Copies to list:</p>
        <Input
          type="number"
          min={1}
          max={listingMax}
          step={1}
          placeholder="1"
          value={listingAmount}
          onChange={(e) => setListingAmount(e.target.value)}
        />
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, opacity: 0.65 }}>
          You hold {listingMax} cop{listingMax === 1 ? 'y' : 'ies'} of this NFT, so that is the maximum.
        </p>
      </Modal>

      <NftDetailModal
        nft={detailNft}
        open={!!detailNft}
        onClose={() => setDetailNft(null)}
        onBuy={() => {}}
        isBuying={false}
        buyingLabel=""
        isOwnListing={!!detailNft?.myListingActive}
      />
    </Container>
  );
};

export default MintedNftList;
