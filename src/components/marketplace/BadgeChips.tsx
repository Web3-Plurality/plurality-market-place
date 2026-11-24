import styled from 'styled-components';
import { MdVerified, MdOpenInNew } from 'react-icons/md';
import { type BucketBadgeInfo, platformLink } from '../../services/badgeApi';

/**
 * Verified-platform chips for a bucket. Each badge was proven against the
 * creator's on-chain smart-profile attestation before it was stored (see
 * market-backend PUT /blockchain/badges), so the chip asserts: the bucket's
 * creator wallet controls this platform account.
 */

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Chip = styled.a<{ $link: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  background: rgba(52, 199, 123, 0.12);
  border: 1px solid rgba(52, 199, 123, 0.35);
  color: #58d69a;
  text-decoration: none;
  cursor: ${({ $link }) => ($link ? 'pointer' : 'default')};

  &:hover {
    color: #58d69a;
    border-color: ${({ $link }) => ($link ? 'rgba(52, 199, 123, 0.7)' : 'rgba(52, 199, 123, 0.35)')};
  }

  .platform {
    text-transform: capitalize;
    font-weight: 600;
  }

  .handle {
    color: rgba(255, 255, 255, 0.6);
  }
`;

export const BadgeChips = ({ badges }: { badges: BucketBadgeInfo[] }) => {
  if (!badges.length) return null;
  return (
    <Row>
      {badges.map((b) => {
        const href = platformLink(b);
        return (
          <Chip
            key={b.platformType}
            $link={!!href}
            {...(href
              ? { href, target: '_blank', rel: 'noopener noreferrer' }
              : { as: 'span' as const })}
            title={`Verified via on-chain Smart Profile attestation${b.privateAttestationUID ? ` (${b.privateAttestationUID.slice(0, 10)}…)` : ''}`}
          >
            <MdVerified size={13} />
            <span className="platform">{b.platformType}</span>
            {b.username && <span className="handle">@{b.username}</span>}
            {href && <MdOpenInNew size={11} />}
          </Chip>
        );
      })}
    </Row>
  );
};

export default BadgeChips;
