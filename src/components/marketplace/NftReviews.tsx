import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { message, Input } from 'antd';
import { MdStar, MdStarBorder, MdRateReview, MdSync } from 'react-icons/md';
import { useAccount, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi';
import { zeroHash } from 'viem';
import { oasisSapphireTestnet } from '../../services/wagmi';
import ReputationRegistryABI from '../../abis/ReputationRegistry.json';
import PluralityMemoryNFTABI from '../../abis/PluralityMemoryNFT.json';
import { apiGet } from '../../utils/api';
import OwnerIdenticon from './OwnerIdenticon';

/*
 * On-chain reviews backed by the ERC-8004 ReputationRegistry (v5).
 *
 * Mapping a "review" onto the contract's feedback model:
 *   - agentId = the NFT tokenId
 *   - value   = star rating 1..5 (valueDecimals = 0)
 *   - tag1    = the comment text
 *
 * Everything is read straight from chain: `readAllFeedback` returns the full
 * non-revoked feedback set (author + rating + comment), and the aggregate is
 * derived from it. (The Paris recompile fixed Sapphire's string-return revert,
 * so the earlier backend mirror is no longer needed.)
 *
 * Restriction honored: giveFeedback reverts for the agent owner
 * (balanceOf(sender, tokenId) > 0), so the write form is hidden for holders.
 */

const MAX_COMMENT = 500;
const ZERO = '0x0000000000000000000000000000000000000000';

interface Review {
  reviewer: string;
  rating: number;
  comment: string;
}

const Wrap = styled.div``;

const SectionLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const AvgValue = styled.span`
  font-weight: 700;
  font-size: 16px;
`;

const StarRow = styled.span`
  display: inline-flex;
  align-items: center;
  color: #faad14;
`;

const ReviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
  max-height: 220px;
  overflow-y: auto;
`;

const ReviewItem = styled.div`
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
`;

const ReviewBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const ReviewHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
`;

const ReviewAddr = styled.span`
  font-family: monospace;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ReviewText = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
  word-break: break-word;
  white-space: pre-wrap;
`;

const Muted = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 4px 0;
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
`;

const StarPicker = styled.div`
  display: inline-flex;
  gap: 2px;
  cursor: pointer;
  color: #faad14;
`;

const SubmitButton = styled.button`
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 13px;
  font-weight: 600;
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

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Render `count` filled stars out of 5 (rounded).
const Stars = ({ value, size = 14 }: { value: number; size?: number }) => {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <StarRow>
      {Array.from({ length: 5 }, (_, i) =>
        i < filled ? <MdStar key={i} size={size} /> : <MdStarBorder key={i} size={size} />,
      )}
    </StarRow>
  );
};

interface Props {
  tokenId: number;
}

const NftReviews = ({ tokenId }: Props) => {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChain } = useSwitchChain();
  // Reputation data lives on Sapphire regardless of the wallet's current chain.
  const publicClient = usePublicClient({ chainId: oasisSapphireTestnet.id });

  const [reputationAddr, setReputationAddr] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const infoRes = await apiGet('/blockchain/contract-info');
      const info = infoRes.ok ? await infoRes.json() : null;
      const repAddr: string | undefined = info?.reputationAddress;
      const memNft: string | undefined = info?.nftAddress;
      if (!repAddr || repAddr === ZERO) {
        setUnavailable(true);
        return;
      }
      setReputationAddr(repAddr);
      setUnavailable(false);

      // readAllFeedback(agentId, clients[], tag1, tag2, includeRevoked=false)
      // → [clients, feedbackIndexes, values, valueDecimals, tag1s, tag2s, revoked]
      const fb = (await publicClient.readContract({
        address: repAddr as `0x${string}`,
        abi: ReputationRegistryABI,
        functionName: 'readAllFeedback',
        args: [BigInt(tokenId), [], '', '', false],
      })) as readonly [string[], bigint[], bigint[], number[], string[], string[], boolean[]];

      const clients = fb[0] || [];
      const values = fb[2] || [];
      const decimals = fb[3] || [];
      const tag1s = fb[4] || [];
      setReviews(
        clients.map((c, i) => ({
          reviewer: c,
          rating: Number(values[i] ?? 0n) / 10 ** Number(decimals[i] ?? 0),
          comment: tag1s[i] || '',
        })),
      );

      // Only the bucket CREATOR is barred from reviewing — copy-holders
      // (buyers) can review. Gate on tokenCreator, not balanceOf.
      if (isConnected && address && memNft) {
        const creator = (await publicClient.readContract({
          address: memNft as `0x${string}`,
          abi: PluralityMemoryNFTABI,
          functionName: 'tokenCreator',
          args: [BigInt(tokenId)],
        })) as string;
        setIsOwner(creator.toLowerCase() === address.toLowerCase());
      } else {
        setIsOwner(false);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [publicClient, tokenId, address, isConnected]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!isConnected || !address) {
      message.error('Connect your wallet to leave a review');
      return;
    }
    if (!reputationAddr) {
      message.error('Reputation contract unavailable');
      return;
    }
    if (!comment.trim()) {
      message.error('Write a short comment first');
      return;
    }
    if (chainId !== oasisSapphireTestnet.id) {
      try {
        switchChain({ chainId: oasisSapphireTestnet.id });
        message.info('Please switch to Oasis Sapphire Testnet');
      } catch {
        message.error('Failed to switch network');
      }
      return;
    }

    setSubmitting(true);
    try {
      // giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)
      const txHash = await writeContractAsync({
        address: reputationAddr as `0x${string}`,
        abi: ReputationRegistryABI,
        functionName: 'giveFeedback',
        args: [BigInt(tokenId), BigInt(rating), 0, comment.trim(), '', '', '', zeroHash],
      });
      message.info('Submitting review on-chain…');
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
      message.success('Review submitted!');
      setComment('');
      setRating(5);
      await load();
    } catch (err: any) {
      const m = String(err?.message || err || '');
      if (m.includes('Submitter is the agent owner')) {
        message.error("You can't review an NFT you own");
      } else if (m.toLowerCase().includes('reject') || m.toLowerCase().includes('denied')) {
        message.error('Transaction rejected');
      } else if (m.includes('cap reached')) {
        message.error('Review limit reached for this NFT');
      } else {
        message.error('Failed to submit review');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (unavailable) {
    return (
      <Wrap>
        <SectionLabel>
          <MdRateReview size={14} /> Reviews
        </SectionLabel>
        <Muted>Reviews are not available right now.</Muted>
      </Wrap>
    );
  }

  const canReview = isConnected && !isOwner;
  const count = reviews.length;
  const avg = count > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;

  return (
    <Wrap>
      <SectionLabel>
        <MdRateReview size={14} /> Reviews
      </SectionLabel>

      {loading ? (
        <Muted>
          <MdSync size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Loading reviews…
        </Muted>
      ) : (
        <>
          <SummaryRow>
            {count > 0 ? (
              <>
                <AvgValue>{avg.toFixed(1)}</AvgValue>
                <Stars value={avg} size={16} />
                <span style={{ opacity: 0.7 }}>
                  ({count} review{count === 1 ? '' : 's'})
                </span>
              </>
            ) : (
              <Muted>No reviews yet — be the first.</Muted>
            )}
          </SummaryRow>

          {count > 0 && (
            <ReviewList>
              {reviews.map((r, i) => (
                <ReviewItem key={`${r.reviewer}-${i}`}>
                  <OwnerIdenticon address={r.reviewer} size={28} />
                  <ReviewBody>
                    <ReviewHead>
                      <Stars value={r.rating} />
                      <ReviewAddr>{truncateAddress(r.reviewer)}</ReviewAddr>
                    </ReviewHead>
                    {r.comment && <ReviewText>{r.comment}</ReviewText>}
                  </ReviewBody>
                </ReviewItem>
              ))}
            </ReviewList>
          )}

          {canReview ? (
            <Form>
              <StarPicker onMouseLeave={() => setHoverRating(0)} role="radiogroup" aria-label="Star rating">
                {Array.from({ length: 5 }, (_, i) => {
                  const v = i + 1;
                  const active = (hoverRating || rating) >= v;
                  return active ? (
                    <MdStar
                      key={v}
                      size={24}
                      onMouseEnter={() => setHoverRating(v)}
                      onClick={() => setRating(v)}
                    />
                  ) : (
                    <MdStarBorder
                      key={v}
                      size={24}
                      onMouseEnter={() => setHoverRating(v)}
                      onClick={() => setRating(v)}
                    />
                  );
                })}
              </StarPicker>
              <Input.TextArea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={MAX_COMMENT}
                rows={3}
                placeholder="Share your experience with this memory bucket…"
                style={{ resize: 'none' }}
              />
              <SubmitButton onClick={handleSubmit} disabled={submitting || !comment.trim()}>
                <MdRateReview size={16} />
                {submitting ? 'Submitting…' : 'Submit review'}
              </SubmitButton>
            </Form>
          ) : isOwner ? (
            <Muted>You're the creator of this bucket, so you can't review it.</Muted>
          ) : (
            <Muted>Connect your wallet to leave a review.</Muted>
          )}
        </>
      )}
    </Wrap>
  );
};

export default NftReviews;
