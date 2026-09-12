import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { message, Input, Modal } from 'antd';
import { MdRefresh, MdSell, MdRemoveShoppingCart } from 'react-icons/md';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import { oasisSapphireTestnet } from '../../services/wagmi';
import { describeTxError } from '../../utils/txErrors';
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
  const { address } = useAccount();
  // Always talk to Sapphire for reads / receipts, whatever chain the wallet is on.
  const sapphireClient = usePublicClient({ chainId: oasisSapphireTestnet.id });
  // Upper bound for "copies to list" = what this wallet actually holds.
  const [listingMax, setListingMax] = useState<number>(1);
  const [detailNft, setDetailNft] = useState<NftSnapshot | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);
  const [processingLabel, setProcessingLabel] = useState('');
  const [listingTokenId, setListingTokenId] = useState<number | null>(null);
  const [listingPrice, setListingPrice] = useState('');
  const [listingAmount, setListingAmount] = useState('1');


  const getContractAddress = useCallback(async (): Promise<string | null> => {
    const res = await apiGet('/blockchain/contract-info');
    const info = res.ok ? await res.json() : null;
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
      if (!addr) { message.error('Contract address not available'); return; }
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
                      nft.myListingActive ? (
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
                          onClick={() => {
                            setListingMax(Math.max(1, nft.copiesOwned ?? 1));
                            setListingTokenId(nft.tokenId);
                          }}
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
        // "Your Listing" badge only when THIS wallet actually has a listing —
        // not when the bucket merely has some (other seller's) listing.
        isOwnListing={!!detailNft?.myListingActive}
      />
    </Container>
  );
};

export default AcquiredNftList;
