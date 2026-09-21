import { useCallback, useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { MdChevronLeft, MdChevronRight, MdLayers, MdToken, MdArrowForward, MdAutoAwesome } from 'react-icons/md';
import { formatEther } from 'viem';
import type { NftSnapshot } from './types';
import { findCategory } from './categories';
import { optimizeImageUrl } from '../../utils/imageUrl';

interface Props {
  items: NftSnapshot[];
  onSelect: (nft: NftSnapshot) => void;
  /** Called from the empty-state CTA (no listings yet). */
  onEmptyCta?: () => void;
}

const AUTO_ADVANCE_MS = 6000;

// ─── Frame ───────────────────────────────────────────────────────────────

const floatIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Frame = styled.div`
  position: relative;
  height: 380px;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #0b0d1c;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);

  @media (max-width: 720px) {
    height: 420px;
    border-radius: 18px;
  }
`;

const Track = styled.div<{ $index: number }>`
  display: flex;
  height: 100%;
  transform: translateX(${({ $index }) => -$index * 100}%);
  transition: transform 0.65s cubic-bezier(0.22, 0.61, 0.36, 1);
`;

const Slide = styled.div<{ $url?: string }>`
  position: relative;
  flex: 0 0 100%;
  height: 100%;
  background: ${({ $url }) =>
    $url
      ? `url(${$url}) center / cover no-repeat`
      : 'linear-gradient(135deg, #312e81 0%, #6d28d9 45%, #be185d 100%)'};

  /* Readability scrim: dark on the left where the copy sits, and a floor
     gradient so the stats row never fights the image. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(5, 7, 21, 0.94) 0%, rgba(5, 7, 21, 0.72) 42%, rgba(5, 7, 21, 0.18) 100%),
      linear-gradient(0deg, rgba(5, 7, 21, 0.85) 0%, transparent 55%);
  }
`;

const Content = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  padding: 36px 44px;

  @media (max-width: 720px) {
    padding: 22px 20px;
  }
`;

const Copy = styled.div`
  max-width: 620px;
  animation: ${floatIn} 0.5s ease;
`;

const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  backdrop-filter: blur(6px);
  margin-bottom: 14px;
`;

const Title = styled.h2`
  margin: 0 0 10px;
  font-size: 38px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #fff;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);

  @media (max-width: 720px) {
    font-size: 28px;
  }
`;

const Tagline = styled.p`
  margin: 0 0 18px;
  font-size: 15px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.78);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Stats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  margin-bottom: 20px;
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StatLabel = styled.span`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(255, 255, 255, 0.55);
`;

const StatValue = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
`;

const Cta = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border: none;
  border-radius: 12px;
  background: #fff;
  color: #0b0d1c;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
  }
`;

const Poster = styled.div<{ $url?: string }>`
  flex-shrink: 0;
  width: 210px;
  height: 210px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: ${({ $url }) =>
    $url ? `url(${$url}) center / cover no-repeat` : 'linear-gradient(135deg, #6366f1, #ec4899)'};
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  animation: ${floatIn} 0.6s ease;

  @media (max-width: 900px) {
    display: none;
  }
`;

// ─── Controls ────────────────────────────────────────────────────────────

const Arrow = styled.button<{ $side: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  ${({ $side }) => ($side === 'left' ? 'left: 16px;' : 'right: 16px;')}
  transform: translateY(-50%);
  z-index: 2;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 28, 0.55);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.15s ease, transform 0.15s ease;

  &:hover {
    background: rgba(99, 102, 241, 0.6);
    transform: translateY(-50%) scale(1.05);
  }

  @media (max-width: 720px) {
    display: none;
  }
`;

const Dots = styled.div`
  position: absolute;
  right: 24px;
  bottom: 20px;
  z-index: 2;
  display: flex;
  gap: 6px;

  @media (max-width: 720px) {
    right: 16px;
    bottom: 14px;
  }
`;

const Dot = styled.button<{ $active: boolean }>`
  width: ${({ $active }) => ($active ? '22px' : '8px')};
  height: 8px;
  border-radius: 999px;
  border: none;
  padding: 0;
  cursor: pointer;
  background: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.4)')};
  transition: width 0.25s ease, background 0.2s ease;
`;

// ─── Empty state ─────────────────────────────────────────────────────────

const EmptyHero = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 44px;
  background:
    radial-gradient(ellipse at 80% 20%, rgba(236, 72, 153, 0.35), transparent 55%),
    radial-gradient(ellipse at 20% 80%, rgba(99, 102, 241, 0.45), transparent 55%),
    linear-gradient(135deg, #14162a, #0b0d1c);

  @media (max-width: 720px) {
    padding: 24px 20px;
  }
`;

// ─── Component ───────────────────────────────────────────────────────────

const HeroSlider = ({ items, onSelect, onEmptyCta }: Props) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  // Clamp if the item list shrinks (e.g. after a purchase sells out a bucket).
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused, count]);

  if (count === 0) {
    return (
      <Frame>
        <EmptyHero>
          <Eyebrow>
            <MdAutoAwesome size={14} /> Memory Marketplace
          </Eyebrow>
          <Title>Discover memories minted as NFTs</Title>
          <Tagline>
            Curated memories from other creators. Hold a copy, and your AI can use it.
            Nothing is listed yet. Be the first to mint one.
          </Tagline>
          {onEmptyCta && (
            <Cta onClick={onEmptyCta}>
              Go to My Playground <MdArrowForward size={16} />
            </Cta>
          )}
        </EmptyHero>
      </Frame>
    );
  }

  return (
    <Frame onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <Track $index={index}>
        {items.map((nft) => {
          const rawCover = nft.coverImage || nft.profileImage;
          const cover = optimizeImageUrl(rawCover, 1600);
          const poster = optimizeImageUrl(rawCover, 480);
          const cat = findCategory(nft.category);
          const floorWei = nft.floorPrice ?? nft.listingPrice;
          const contexts = nft.contextCount ?? nft.contexts?.length ?? 0;
          return (
            <Slide key={nft.id} $url={cover}>
              <Content>
                <Copy>
                  <Eyebrow>
                    {cat ? (
                      <>
                        <span>{cat.emoji}</span> {cat.label}
                      </>
                    ) : (
                      <>
                        <MdAutoAwesome size={14} /> Featured Memory
                      </>
                    )}
                    {nft.hasSkill && <span>· Skill</span>}
                  </Eyebrow>
                  <Title>{nft.title || nft.profileName}</Title>
                  {/* The skill summary is the one-liner the creator wrote for
                      buyers, so it beats the generic tagline when present. */}
                  <Tagline>
                    {nft.skillSummary ||
                      nft.tagline ||
                      nft.description?.split('\n')[0] ||
                      'A memory minted on-chain.'}
                  </Tagline>
                  <Stats>
                    <Stat>
                      <StatLabel>Floor price</StatLabel>
                      <StatValue>{floorWei ? `${formatEther(BigInt(floorWei))} TEST` : 'n/a'}</StatValue>
                    </Stat>
                    <Stat>
                      <StatLabel>Available</StatLabel>
                      <StatValue>
                        <MdLayers size={15} />
                        {nft.copiesAvailable ?? 0} / {nft.editionSize ?? 1} copies
                      </StatValue>
                    </Stat>
                    <Stat>
                      <StatLabel>Inside</StatLabel>
                      <StatValue>
                        <MdToken size={15} />
                        {contexts} context{contexts === 1 ? '' : 's'}
                      </StatValue>
                    </Stat>
                  </Stats>
                  <Cta onClick={() => onSelect(nft)}>
                    View &amp; buy <MdArrowForward size={16} />
                  </Cta>
                </Copy>
                <Poster $url={poster} onClick={() => onSelect(nft)} style={{ cursor: 'pointer' }} />
              </Content>
            </Slide>
          );
        })}
      </Track>

      {count > 1 && (
        <>
          <Arrow $side="left" aria-label="Previous" onClick={() => go(index - 1)}>
            <MdChevronLeft size={24} />
          </Arrow>
          <Arrow $side="right" aria-label="Next" onClick={() => go(index + 1)}>
            <MdChevronRight size={24} />
          </Arrow>
          <Dots>
            {items.map((nft, i) => (
              <Dot key={nft.id} $active={i === index} aria-label={`Slide ${i + 1}`} onClick={() => go(i)} />
            ))}
          </Dots>
        </>
      )}
    </Frame>
  );
};

export default HeroSlider;
