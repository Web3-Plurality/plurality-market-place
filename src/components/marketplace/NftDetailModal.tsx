import { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Modal } from 'antd';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;
import { MdOpenInNew, MdVerified, MdShield, MdShoppingCart, MdHistory, MdToken, MdSell, MdShoppingBag, MdDownload, MdSync } from 'react-icons/md';
import { formatEther } from 'viem';
import OwnerIdenticon from './OwnerIdenticon';
import { apiGet } from '../../utils/api';
import type { NftSnapshot } from './types';

interface Props {
  nft: NftSnapshot | null;
  open: boolean;
  onClose: () => void;
  onBuy: (nft: NftSnapshot) => void;
  isBuying: boolean;
  buyingLabel: string;
  isOwnListing: boolean;
}

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  /* Reserve space on the right so the token chip never collides with antd's
     close (X) button, which sits at the top-right of the modal. */
  padding-right: 36px;
`;

const BucketName = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const TokenBadge = styled.span`
  font-size: 13px;
  padding: 3px 10px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary}15;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
`;

const Section = styled.div`
  margin-bottom: 16px;
`;

const SectionLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 8px;
  font-weight: 600;
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: 6px;
`;

const InfoValue = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ContextListContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  overflow: hidden;
`;

const ContextRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 13px;

  &:last-child {
    border-bottom: none;
  }
`;

const ContextTitle = styled.span`
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
  margin-right: 8px;
`;

const ContextTypeBadge = styled.span`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-right: 8px;
`;

const StatusBadge = styled.span<{ $verified: boolean; $clickable?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid ${({ $verified }) => ($verified ? '#52c41a' : '#d9d9d9')};
  color: ${({ $verified }) => ($verified ? '#52c41a' : '#999')};
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  /* Unverified + clickable: hover swaps to "Register" affordance.
     The two label spans are toggled via display so the badge behaves like
     a single chip with a hover state, no separate button. */
  ${({ $clickable }) =>
    $clickable
      ? `
    &:hover {
      border-color: rgba(139, 92, 246, 0.6);
      background: rgba(139, 92, 246, 0.12);
      color: #c4b5fd;
    }
    .status-default { display: inline-flex; }
    .status-hover { display: none; }
    &:hover .status-default { display: none; }
    &:hover .status-hover { display: inline-flex; }
  `
      : ''}

  /* Disabled state during the in-flight register call. */
  &[aria-disabled='true'] {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
`;

const ExplorerLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const OwnerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  margin: 20px 0;
`;

const PriceSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border-radius: 10px;
  margin-top: 16px;
`;

const PriceDisplay = styled.div`
  font-size: 22px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const PriceUnit = styled.span`
  font-size: 14px;
  font-weight: 400;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-left: 4px;
`;

const BuyButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 10px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 14px;
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

const OwnBadge = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 8px 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
`;

const SpinLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;

  svg {
    animation: ${spin} 1s linear infinite;
  }
`;

/* ── Transaction History ──────────────────────────────── */

const Timeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
`;

const TimelineItem = styled.div`
  display: flex;
  gap: 12px;
  padding: 10px 0;
  position: relative;
`;

const TimelineDot = styled.div<{ $color: string }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${({ $color }) => `${$color}15`};
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
`;

const TimelineLine = styled.div`
  position: absolute;
  left: 15px;
  top: 42px;
  bottom: 0;
  width: 2px;
  background: ${({ theme }) => theme.colors.border};
`;

const TimelineContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const TimelineEvent = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const TimelineDetail = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const TimelineAddr = styled.span`
  font-family: monospace;
  font-size: 11px;
`;

const TimelinePrice = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

interface HistoryEvent {
  event: string;
  from?: string;
  to?: string;
  price?: string;
  txHash?: string;
  timestamp: string;
}

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  Minted: { icon: <MdToken size={16} />, color: '#6366f1' },
  Listed: { icon: <MdSell size={16} />, color: '#faad14' },
  Sold: { icon: <MdShoppingBag size={16} />, color: '#52c41a' },
  Imported: { icon: <MdDownload size={16} />, color: '#13c2c2' },
};

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Load the live contexts of a bucket from /ai/context. Returns the contexts
// AND a fetchError when the call failed — callers can distinguish a genuinely
// empty bucket from a permission/network failure that was silently swallowed.
async function fetchBucketContexts(profileId: string): Promise<{
  contexts: Array<{ contextId: string; title: string; sourceType: string; contentHash: string | null; registeredOnChain: boolean }>;
  fetchError: string | null;
}> {
  try {
    const res = await apiGet(`/ai/context?profileId=${encodeURIComponent(profileId)}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { contexts: [], fetchError: `HTTP ${res.status}${body ? ` — ${body.slice(0, 120)}` : ''}` };
    }
    const data = await res.json();
    const list = (data.contexts || []) as Array<{
      contextId: string;
      title: string;
      sourceType: string | null;
      contentHash: string | null;
      registeredOnChain: boolean;
    }>;
    return {
      contexts: list.map((c) => ({
        contextId: c.contextId,
        title: c.title,
        sourceType: c.sourceType || 'text',
        contentHash: c.contentHash,
        registeredOnChain: !!c.registeredOnChain,
      })),
      fetchError: null,
    };
  } catch (err) {
    return { contexts: [], fetchError: (err as Error)?.message || 'Network error' };
  }
}

const NftDetailModal = ({
  nft,
  open,
  onClose,
  onBuy,
  isBuying,
  buyingLabel,
  isOwnListing,
}: Props) => {
  // Registration is now part of the mint flow (one batch tx, signed by the
  // creator before tx2 = mintBucket). Once a bucket is minted, every context
  // is on-chain by definition. The modal only shows ✓ verification state;
  // there are no register buttons or per-context tx wiring.
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [verifiedContextIds, setVerifiedContextIds] = useState<Set<string>>(new Set());
  const [checkingContexts, setCheckingContexts] = useState(false);
  const [contextsError, setContextsError] = useState<string | null>(null);

  // Post-rewrite: NFT response no longer carries contexts[]. Fetch them live
  // from /ai/context on open — the backend's permission resolver lets the
  // NFT holder read this. Falls back to nft.contexts if a caller still
  // populated it (browse-listing path may not have access; we just show
  // empty in that case).
  const [liveContexts, setLiveContexts] = useState<
    Array<{ contextId: string; title: string; sourceType: string; contentHash: string | null; registeredOnChain: boolean }>
  >([]);
  const contexts = liveContexts.length > 0 ? liveContexts : nft?.contexts || [];

  // Fetch history + bucket contexts + live verification status when modal opens
  useEffect(() => {
    if (!open || !nft) {
      setHistory([]);
      setVerifiedContextIds(new Set());
      setLiveContexts([]);
      setContextsError(null);
      return;
    }

    // Fetch history (needs a tokenId — pending mints have none yet)
    if (nft.tokenId) {
      apiGet(`/blockchain/history/${nft.tokenId}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setHistory(data.history || []);
          }
        })
        .catch(() => {});
    }

    // Fetch contexts via /ai/context. Failures (404, 403) used to be silently
    // swallowed and rendered as "no contexts" — now surfaced so the user can
    // tell "bucket really is empty" apart from "endpoint refused us".
    let fetched: Array<{ contextId: string; title: string; sourceType: string; contentHash: string | null; registeredOnChain: boolean }> = [];
    setCheckingContexts(true);
    setContextsError(null);
    fetchBucketContexts(nft.profileId)
      .then(({ contexts: ctxs, fetchError }) => {
        fetched = ctxs;
        setLiveContexts(ctxs);
        setContextsError(fetchError);
      })
      .catch((err) => {
        setLiveContexts([]);
        setContextsError((err as Error)?.message || 'Network error');
      })
      .finally(async () => {
        // Now verify each context against the on-chain ContextRegistry.
        const verified = new Set<string>();
        for (const ctx of fetched) {
          if (ctx.registeredOnChain) {
            verified.add(ctx.contextId);
            continue;
          }
          try {
            const res = await apiGet(`/blockchain/verify/${ctx.contextId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.registeredOnChain) verified.add(ctx.contextId);
            }
          } catch {
            /* ignore */
          }
        }
        setVerifiedContextIds(verified);
        setCheckingContexts(false);
      });
  }, [open, nft?.profileId, nft?.tokenId]);

  // ── Hooks must run on every render — keep them above the early return.
  // Register handlers used to live here. In the new flow registration is
  // part of mint (tx1), so by the time a NFT exists in this modal, every
  // context is already on-chain. Nothing to wire post-mint.

  if (!nft) return null;

  const priceDisplay = nft.listingPrice ? formatEther(BigInt(nft.listingPrice)) : '?';
  const mintDate = nft.mintedAt ? new Date(nft.mintedAt).toLocaleDateString() : 'Pending';
  const explorerUrl = nft.mintTxHash
    ? `https://explorer.oasis.io/testnet/sapphire/tx/${nft.mintTxHash}`
    : null;

  const isContextVerified = (ctx: { contextId: string; registeredOnChain: boolean }) =>
    ctx.registeredOnChain || verifiedContextIds.has(ctx.contextId);

  const verifiedCount = contexts.filter((c) => isContextVerified(c)).length;
  const totalContexts = contexts.length;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      title={null}
      destroyOnHidden
    >
      <Header>
        <BucketName>{nft.profileName}</BucketName>
        {nft.tokenId && <TokenBadge>#{nft.tokenId}</TokenBadge>}
      </Header>

      <Section>
        <SectionLabel>Details</SectionLabel>
        <InfoRow>
          Mint Date: <InfoValue>{mintDate}</InfoValue>
        </InfoRow>
        <InfoRow>
          Chain: <InfoValue>{nft.chain || 'Oasis Sapphire Testnet'}</InfoValue>
        </InfoRow>
        {explorerUrl && (
          <InfoRow>
            <ExplorerLink href={explorerUrl} target="_blank" rel="noopener noreferrer">
              View on Explorer <MdOpenInNew size={12} />
            </ExplorerLink>
          </InfoRow>
        )}
      </Section>

      {nft.ownerWallet && (
        <Section>
          <SectionLabel>Owner</SectionLabel>
          <OwnerRow>
            <OwnerIdenticon address={nft.ownerWallet} size={28} />
            <span>{truncateAddress(nft.ownerWallet)}</span>
          </OwnerRow>
        </Section>
      )}

      <Section>
        <SectionLabel>
          Contexts {checkingContexts ? (
            <SpinLabel>
              <MdSync size={12} /> verifying...
            </SpinLabel>
          ) : (
            <>({verifiedCount}/{totalContexts} verified on-chain)</>
          )}
        </SectionLabel>
        {totalContexts > 0 ? (
          <ContextListContainer>
            {contexts.map((ctx) => {
              const verified = isContextVerified(ctx);
              return (
                <ContextRow key={ctx.contextId}>
                  <ContextTitle>{ctx.title}</ContextTitle>
                  <ContextTypeBadge>{ctx.sourceType}</ContextTypeBadge>
                  <StatusBadge $verified={verified} $clickable={false}>
                    {verified ? (
                      <span className="status-default">
                        <MdVerified size={12} /> Verified
                      </span>
                    ) : (
                      <span className="status-default">
                        <MdShield size={12} /> Unverified
                      </span>
                    )}
                  </StatusBadge>
                </ContextRow>
              );
            })}
          </ContextListContainer>
        ) : contextsError ? (
          <InfoRow>
            <InfoValue style={{ color: '#f87171' }}>
              Failed to load contexts: {contextsError}
            </InfoValue>
          </InfoRow>
        ) : (
          <InfoRow>
            <InfoValue>No contexts in this snapshot</InfoValue>
          </InfoRow>
        )}
      </Section>

      {history.length > 0 && (
        <Section>
          <SectionLabel>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MdHistory size={14} /> Transaction History
            </span>
          </SectionLabel>
          <Timeline>
            {history.map((evt, i) => {
              const config = EVENT_CONFIG[evt.event] || { icon: <MdHistory size={16} />, color: '#999' };
              const isLast = i === history.length - 1;
              return (
                <TimelineItem key={`${evt.event}-${i}`}>
                  <div style={{ position: 'relative' }}>
                    <TimelineDot $color={config.color}>{config.icon}</TimelineDot>
                    {!isLast && <TimelineLine />}
                  </div>
                  <TimelineContent>
                    <TimelineEvent>{evt.event}</TimelineEvent>
                    <TimelineDetail>
                      <span>{new Date(evt.timestamp).toLocaleDateString()}</span>
                      {evt.from && (
                        <span>
                          from <TimelineAddr>{truncateAddress(evt.from)}</TimelineAddr>
                        </span>
                      )}
                      {evt.to && (
                        <span>
                          to <TimelineAddr>{truncateAddress(evt.to)}</TimelineAddr>
                        </span>
                      )}
                      {evt.price && (
                        <TimelinePrice>{formatEther(BigInt(evt.price))} TEST</TimelinePrice>
                      )}
                      {evt.txHash && (
                        <ExplorerLink
                          href={`https://explorer.oasis.io/testnet/sapphire/tx/${evt.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          tx <MdOpenInNew size={10} />
                        </ExplorerLink>
                      )}
                    </TimelineDetail>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>
        </Section>
      )}

      {/* Only show price/buy section when the NFT is actually listed for sale.
          Owner-viewed unlisted NFTs (My Minted / Acquired tabs) skip this block
          so we don't display "? TEST" or a redundant "Your Listing" badge. */}
      {nft.listingActive && (
        <>
          <Divider />
          <PriceSection>
            <PriceDisplay>
              {priceDisplay}
              <PriceUnit>TEST</PriceUnit>
            </PriceDisplay>
            {isOwnListing ? (
              <OwnBadge>Your Listing</OwnBadge>
            ) : (
              <BuyButton onClick={() => onBuy(nft)} disabled={isBuying}>
                <MdShoppingCart size={18} />
                {isBuying ? buyingLabel || 'Processing...' : 'Buy Now'}
              </BuyButton>
            )}
          </PriceSection>
        </>
      )}
    </Modal>
  );
};

export default NftDetailModal;
