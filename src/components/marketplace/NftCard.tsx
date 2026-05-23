import styled from 'styled-components';
import { MdOpenInNew, MdShield, MdVerified, MdExpandMore, MdExpandLess } from 'react-icons/md';
import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import { apiPost, apiGet } from '../../utils/api';
import type { NftSnapshot, SnapshotContext } from './types';

interface Props {
  nft: NftSnapshot;
  actions?: React.ReactNode;
  readOnly?: boolean; // true = no Register button, just show status (for Browse/Acquired)
}

const Card = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  overflow: hidden;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
`;

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TokenLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TokenName = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const TokenId = styled.span`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.primary}15;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ExplorerLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;

  &:hover { text-decoration: underline; }
`;

const ListingBadge = styled.span<{ $active: boolean }>`
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 10px;
  background: ${({ $active }) => ($active ? '#52c41a15' : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? '#52c41a' : '#d9d9d9')};
  color: ${({ $active }) => ($active ? '#52c41a' : '#999')};
`;

const ExpandButton = styled.button`
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;

  &:hover { color: ${({ theme }) => theme.colors.textPrimary}; }
`;

const ContextList = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const ContextItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 13px;

  &:last-child { border-bottom: none; }
`;

const ContextInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const ContextType = styled.span`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const OnChainBadge = styled.button<{ $registered: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid ${({ $registered }) => ($registered ? '#52c41a' : '#d9d9d9')};
  color: ${({ $registered }) => ($registered ? '#52c41a' : '#999')};
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    ${({ $registered }) => $registered
      ? `opacity: 0.8;`
      : `border-color: #6366f1; color: #6366f1;`
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ActionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.background};
`;

const NftCard = ({ nft, actions, readOnly = false }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registeredContexts, setRegisteredContexts] = useState<Set<string>>(new Set());
  const [contextTxHashes, setContextTxHashes] = useState<Record<string, string>>({});
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Check live on-chain status for contexts when expanded
  useEffect(() => {
    if (!expanded || !nft.contexts?.length) return;

    const unchecked = nft.contexts.filter(
      (ctx) => !ctx.registeredOnChain && !registeredContexts.has(ctx.contextId),
    );
    if (unchecked.length === 0) return;

    setCheckingStatus(true);
    const checkLiveStatus = async () => {
      const registered = new Set<string>();
      const txHashes: Record<string, string> = {};
      for (const ctx of unchecked) {
        try {
          const res = await apiGet(`/blockchain/verify/${ctx.contextId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.registeredOnChain) {
              registered.add(ctx.contextId);
              if (data.registryTxHash) txHashes[ctx.contextId] = data.registryTxHash;
            }
          }
        } catch { /* ignore */ }
      }
      if (registered.size > 0) {
        setRegisteredContexts((prev) => new Set([...prev, ...registered]));
        setContextTxHashes((prev) => ({ ...prev, ...txHashes }));
      }
      setCheckingStatus(false);
    };
    checkLiveStatus();
  }, [expanded, nft.contexts]);

  const explorerUrl = nft.mintTxHash
    ? `https://explorer.oasis.io/testnet/sapphire/tx/${nft.mintTxHash}`
    : null;

  const mintDate = nft.mintedAt ? new Date(nft.mintedAt).toLocaleDateString() : 'Pending';

  const handleRegister = useCallback(async (contextId: string) => {
    setRegisteringId(contextId);
    try {
      const response = await apiPost(`/blockchain/register-context/${contextId}`);
      const data = await response.json();

      if (response.ok && data.success) {
        message.success('Context registered on-chain');
        setRegisteredContexts((prev) => new Set(prev).add(contextId));
        if (data.txHash) setContextTxHashes((prev) => ({ ...prev, [contextId]: data.txHash }));
      } else if (response.status === 409) {
        message.info('Context is already registered on-chain');
        setRegisteredContexts((prev) => new Set(prev).add(contextId));
      } else {
        message.error(data.error || 'Failed to register on-chain');
      }
    } catch (error: any) {
      message.error('Failed to register: ' + (error.message || 'Unknown error'));
    } finally {
      setRegisteringId(null);
    }
  }, []);

  const isContextRegistered = (ctx: SnapshotContext) =>
    ctx.registeredOnChain || registeredContexts.has(ctx.contextId);

  return (
    <Card>
      <CardHeader>
        <HeaderLeft>
          <TokenLabel>
            <TokenName>{nft.profileName}</TokenName>
            {nft.tokenId && <TokenId>#{nft.tokenId}</TokenId>}
          </TokenLabel>
          <MetaRow>
            <span>{nft.contexts?.length || 0} contexts</span>
            <span>Minted: {mintDate}</span>
            {nft.listingActive && (
              <ListingBadge $active>Listed</ListingBadge>
            )}
          </MetaRow>
        </HeaderLeft>
        <HeaderRight>
          {explorerUrl && (
            <ExplorerLink href={explorerUrl} target="_blank" rel="noopener noreferrer">
              Explorer <MdOpenInNew size={12} />
            </ExplorerLink>
          )}
          <ExpandButton onClick={() => setExpanded(!expanded)}>
            {expanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
          </ExpandButton>
        </HeaderRight>
      </CardHeader>

      {expanded && (
        <ContextList>
          {(nft.contexts || []).length === 0 ? (
            <ContextItem>
              <ContextInfo style={{ color: '#999' }}>No contexts in this snapshot</ContextInfo>
            </ContextItem>
          ) : (
            (nft.contexts || []).map((ctx) => {
              const registered = isContextRegistered(ctx);
              const isRegistering = registeringId === ctx.contextId;
              const txHash = contextTxHashes[ctx.contextId];
              const explorerLink = txHash
                ? `https://explorer.oasis.io/testnet/sapphire/tx/${txHash}`
                : registered && nft.mintTxHash
                  ? `https://explorer.oasis.io/testnet/sapphire/tx/${nft.mintTxHash}`
                  : null;
              return (
                <ContextItem key={ctx.contextId}>
                  <ContextInfo>
                    <span>{ctx.title}</span>
                    <ContextType>{ctx.sourceType}</ContextType>
                  </ContextInfo>
                  {ctx.contentHash && (
                    registered ? (
                      <OnChainBadge
                        as="a"
                        href={explorerLink || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        $registered
                        style={{ cursor: 'pointer', textDecoration: 'none' }}
                        title={txHash ? 'View registration transaction' : 'View on explorer'}
                      >
                        <MdVerified size={12} />
                        On-chain
                        <MdOpenInNew size={10} />
                      </OnChainBadge>
                    ) : readOnly ? (
                      <OnChainBadge $registered={false} disabled style={{ cursor: 'default' }}>
                        <MdShield size={12} />
                        Not verified
                      </OnChainBadge>
                    ) : (
                      <OnChainBadge
                        $registered={false}
                        onClick={() => !isRegistering && !checkingStatus && handleRegister(ctx.contextId)}
                        disabled={isRegistering || checkingStatus}
                        title={checkingStatus ? 'Checking status...' : 'Click to register on-chain'}
                      >
                        <MdShield size={12} />
                        {checkingStatus ? 'Checking...' : isRegistering ? 'Registering...' : 'Register'}
                      </OnChainBadge>
                    )
                  )}
                </ContextItem>
              );
            })
          )}
        </ContextList>
      )}

      {actions && <ActionsRow>{actions}</ActionsRow>}
    </Card>
  );
};

export default NftCard;
