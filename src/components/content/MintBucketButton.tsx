import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAccount, useSendTransaction, usePublicClient, useSwitchChain } from 'wagmi';
import { message, Tooltip } from 'antd';
import { MdToken } from 'react-icons/md';
import { useMemoryNFT, type NftMintMetadata } from '../../hooks/useMemoryNFT';
import { oasisSapphireTestnet } from '../../services/wagmi';
import MintNftDialog from './MintNftDialog';

interface MintBucketButtonProps {
  profileId: string;
  isOwner: boolean;
  /** Hide the button when the bucket is already minted or mid-mint. */
  isImmutable?: boolean;
  defaultTitle?: string;
  onMinted?: (tokenId: number) => void;
  /** Fires after a frozen bucket was successfully reverted to draft via
   *  /cancel — parents use this to refresh views. */
  onCancelled?: () => void;
}

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const Container = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const MintButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) { opacity: 0.85; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Spinner = styled.div`
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

/**
 * Two-tx mint flow:
 *
 *   1. /prepare-registration → MetaMask signs registerContextBatch     (tx1)
 *   2. /confirm-registration  → backend verifies tx1 on chain
 *   3. /prepare-mint          → MetaMask signs mintBucket             (tx2)
 *   4. /confirm-mint          → backend verifies tx2 + sets mintedTokenId
 *
 * UX surfaces the current step via the button label ("Sign 1/2…",
 * "Confirming 1/2…", "Sign 2/2…", "Confirming 2/2…"). On rejection of either
 * tx, the bucket can be cancelled only if tx1 hasn't landed yet.
 */
type Step =
  | 'idle'
  | 'preparing-tx1'
  | 'signing-tx1'
  | 'mining-tx1'
  | 'confirming-tx1'
  | 'preparing-tx2'
  | 'signing-tx2'
  | 'mining-tx2'
  | 'confirming-tx2';

const STEP_LABEL: Record<Step, string> = {
  idle: 'Mint',
  'preparing-tx1': 'Hashing…',
  'signing-tx1': 'Sign 1/2 in MetaMask…',
  'mining-tx1': 'Publishing contexts (1/2)…',
  'confirming-tx1': 'Verifying registration…',
  'preparing-tx2': 'Preparing mint…',
  'signing-tx2': 'Sign 2/2 in MetaMask…',
  'mining-tx2': 'Minting NFT (2/2)…',
  'confirming-tx2': 'Confirming mint…',
};

export const MintBucketButton: React.FC<MintBucketButtonProps> = ({
  profileId,
  isOwner,
  isImmutable = false,
  defaultTitle,
  onMinted,
  onCancelled,
}) => {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const {
    prepareRegistration,
    confirmRegistration,
    prepareMint,
    confirmMint,
    cancelMint,
    uploadCover,
  } = useMemoryNFT();

  const [step, setStep] = useState<Step>('idle');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  // Refs for callbacks — keep them out of effect deps so re-renders don't
  // re-run logic.
  const onMintedRef = useRef(onMinted);
  const onCancelledRef = useRef(onCancelled);
  useEffect(() => {
    onMintedRef.current = onMinted;
  }, [onMinted]);
  useEffect(() => {
    onCancelledRef.current = onCancelled;
  }, [onCancelled]);

  const openDialog = useCallback(() => {
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
    setDialogOpen(true);
  }, [isConnected, address, chainId, switchChain]);

  const handleUploadCover = useCallback(
    async (dataUrl: string) => {
      setCoverUploading(true);
      try {
        return await uploadCover(dataUrl);
      } finally {
        setCoverUploading(false);
      }
    },
    [uploadCover],
  );

  // Detect user-rejection from a wagmi error message — variants we treat as
  // "rejected": "User rejected the request", "User denied transaction
  // signature", "rejected by user".
  const isUserRejection = (err: unknown): boolean => {
    const msg = ((err as Error)?.message || '').toLowerCase();
    return msg.includes('reject') || msg.includes('denied');
  };

  const handleSubmitMetadata = useCallback(
    async (metadata: NftMintMetadata) => {
      // ────────────── tx1: register contexts ──────────────
      setStep('preparing-tx1');
      let prep;
      try {
        prep = await prepareRegistration(profileId, metadata);
      } catch (err) {
        setStep('idle');
        message.error((err as Error).message || 'Failed to prepare registration');
        return;
      }
      setDialogOpen(false);

      setStep('signing-tx1');
      let tx1Hash: `0x${string}`;
      try {
        tx1Hash = await sendTransactionAsync({
          to: prep.contractAddress,
          data: prep.callData,
        });
      } catch (err) {
        // User rejected the first tx — bucket is still frozen but no on-chain
        // writes happened. Cancel cleanly so it goes back to draft.
        message.error(isUserRejection(err) ? 'Transaction rejected' : 'Transaction failed');
        await cancelMint(profileId);
        setStep('idle');
        onCancelledRef.current?.();
        return;
      }

      setStep('mining-tx1');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx1Hash });
      }

      setStep('confirming-tx1');
      try {
        const confirmResult = await confirmRegistration(profileId, tx1Hash, prep.contextIds);
        if (confirmResult.pending.length > 0) {
          // Partial confirmation — rare; let the user know and stop. They can
          // retry the mint later (already-registered contexts are no-ops).
          message.warning(
            `${confirmResult.confirmed.length}/${prep.contextIds.length} contexts confirmed on-chain. ` +
              `Retry minting to pick up the rest.`,
          );
          setStep('idle');
          onCancelledRef.current?.();
          return;
        }
      } catch (err) {
        setStep('idle');
        message.error((err as Error).message || 'Failed to confirm registration');
        return;
      }

      // ────────────── tx2: mint NFT ───────────────────────
      setStep('preparing-tx2');
      let mintPrep;
      try {
        mintPrep = await prepareMint(profileId, metadata.copies ?? 1);
      } catch (err) {
        setStep('idle');
        message.error((err as Error).message || 'Failed to prepare mint');
        return;
      }

      setStep('signing-tx2');
      let tx2Hash: `0x${string}`;
      try {
        tx2Hash = await sendTransactionAsync({
          to: mintPrep.contractAddress,
          data: mintPrep.callData,
          value: BigInt(mintPrep.mintFee),
        });
      } catch (err) {
        // tx1 already landed on-chain — we can't roll back. The bucket stays
        // "registered", and the user can resume the mint later via the
        // Pending UI in My Minted NFTs.
        message.error(
          isUserRejection(err)
            ? 'Mint rejected. Contexts are already on-chain — resume from My Minted NFTs.'
            : 'Mint transaction failed. Contexts are already on-chain — resume from My Minted NFTs.',
        );
        setStep('idle');
        onCancelledRef.current?.();
        return;
      }

      setStep('mining-tx2');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx2Hash });
      }

      setStep('confirming-tx2');
      try {
        const minted = await confirmMint(profileId, tx2Hash);
        if (minted?.tokenId) {
          message.success(`Minted as NFT #${minted.tokenId}!`);
          onMintedRef.current?.(minted.tokenId);
        }
      } catch (err) {
        message.error((err as Error).message || 'Failed to confirm mint');
      } finally {
        setStep('idle');
      }
    },
    [
      profileId,
      prepareRegistration,
      sendTransactionAsync,
      publicClient,
      confirmRegistration,
      prepareMint,
      confirmMint,
      cancelMint,
    ],
  );

  if (!isOwner || !isConnected || isImmutable) return null;

  const isLoading = step !== 'idle';

  return (
    <Container>
      <Tooltip title="Mint this bucket as an ERC-1155 NFT. Two signatures: (1) publish context hashes on-chain, (2) mint the NFT.">
        <MintButton onClick={openDialog} disabled={isLoading}>
          {isLoading ? <Spinner /> : <MdToken size={14} />}
          {STEP_LABEL[step]}
        </MintButton>
      </Tooltip>
      <MintNftDialog
        open={dialogOpen}
        defaultTitle={defaultTitle || ''}
        uploading={coverUploading}
        submitting={isLoading}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmitMetadata}
        onUploadCover={handleUploadCover}
      />
    </Container>
  );
};

export default MintBucketButton;
