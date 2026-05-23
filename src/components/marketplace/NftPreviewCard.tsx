import type { ReactNode } from 'react';
import styled from 'styled-components';
import { MdToken, MdImage } from 'react-icons/md';
import type { NftSnapshot } from './types';

interface Props {
  nft: NftSnapshot;
  actions?: ReactNode;
  onClick?: () => void;
}

const Card = styled.div<{ $clickable?: boolean }>`
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    ${({ $clickable }) =>
      $clickable
        ? `
      transform: translateY(-2px);
      border-color: rgba(139, 92, 246, 0.55);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    `
        : ''}
  }
`;

const Cover = styled.div<{ $url?: string }>`
  width: 100%;
  aspect-ratio: 16 / 10;
  background: ${({ $url }) =>
    $url ? `url(${$url}) center / cover` : 'linear-gradient(135deg, #6366f1, #ec4899)'};
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 60%, rgba(0, 0, 0, 0.45) 100%);
  }
`;

const CoverFallback = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.7);
`;

const TokenChip = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(4px);
  z-index: 1;
`;

const Body = styled.div`
  padding: 14px 16px 16px;
`;

const Title = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Tagline = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 32px;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
`;

const FooterLeft = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const Actions = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const NftPreviewCard = ({ nft, actions, onClick }: Props) => {
  const cover = nft.coverImage || nft.profileImage || undefined;
  const title = nft.title || nft.profileName;
  const tagline = nft.tagline || nft.description?.split('\n')[0] || 'A memory bucket minted on-chain.';
  const tokenLabel = nft.tokenId !== null && nft.tokenId !== undefined ? `#${nft.tokenId}` : null;

  return (
    <Card $clickable={!!onClick} onClick={onClick}>
      <Cover $url={cover}>
        {tokenLabel && <TokenChip>{tokenLabel}</TokenChip>}
        {!cover && (
          <CoverFallback>
            <MdImage size={36} />
          </CoverFallback>
        )}
      </Cover>
      <Body>
        <Title>{title}</Title>
        <Tagline>{tagline}</Tagline>
        <Footer>
          <FooterLeft>
            <MdToken size={12} />
            {nft.contexts?.length ?? 0} context{(nft.contexts?.length ?? 0) === 1 ? '' : 's'}
          </FooterLeft>
          {actions && <Actions onClick={(e) => e.stopPropagation()}>{actions}</Actions>}
        </Footer>
      </Body>
    </Card>
  );
};

export default NftPreviewCard;
