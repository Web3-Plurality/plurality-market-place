import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { Modal, Checkbox, Button, Spin, message } from 'antd';
import { ethers } from 'ethers';
import { MdVerified } from 'react-icons/md';
import {
  type AttestationInfo,
  type BucketBadgeInfo,
  disclosureMessage,
  getAttestationInfo,
  getBadges,
  requestDisclosure,
  setBadges,
  clearBadges,
} from '../../services/badgeApi';
import BadgeChips from './BadgeChips';
import VerifyProfileDialog from './VerifyProfileDialog';
import { tryRecoverSession } from '../../services/sessionRecovery';

/**
 * Owner dialog: attach verified-platform badges to a minted bucket.
 *
 * The creator picks which connected platforms to reveal, signs a disclosure
 * message with the SAME wallet that owns the smart-profile attestation (and
 * this marketplace session), and the proof round-trips sp-api → our backend,
 * which verifies it against the on-chain Merkle root before storing. Nothing
 * about unselected platforms leaves the private store.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  profileId: string | null;
}

const Hint = styled.p`
  font-size: 12.5px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.65);
  margin: 0 0 14px;

  a {
    color: #9f87ff;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const Block = styled.div`
  margin-bottom: 16px;

  .label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.45);
    margin-bottom: 8px;
  }
`;

const PlatformList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ErrorText = styled.p`
  color: #ff7875;
  font-size: 12.5px;
  margin: 8px 0 0;
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 18px;
`;

export const BadgeManageDialog = ({ open, onClose, profileId }: Props) => {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState('');
  const [attestation, setAttestation] = useState<AttestationInfo | null>(null);
  const [current, setCurrent] = useState<BucketBadgeInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [spOpen, setSpOpen] = useState(false);

  // Re-runnable so closing the embedded Smart Profile dialog can refresh the
  // platform list after the user connects/attests in it.
  const load = useCallback(() => {
    if (!profileId) return;
    setError(null);
    setLoading(true);
    (async () => {
      try {
        if (typeof window.ethereum === 'undefined') {
          throw new Error('MetaMask is not available');
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts: string[] = await provider.send('eth_accounts', []);
        const addr = accounts[0];
        if (!addr) throw new Error('Connect MetaMask first');

        // The backend verifies the disclosure against the SESSION wallet, so
        // signing with a different active MetaMask account can only fail —
        // catch the mismatch here with a clear message instead.
        const session = await tryRecoverSession();
        if (session.authAddress && session.authAddress.toLowerCase() !== addr.toLowerCase()) {
          throw new Error(
            `MetaMask's active account (${addr.slice(0, 6)}…${addr.slice(-4)}) is not the wallet you signed in with ` +
              `(${session.authAddress.slice(0, 6)}…${session.authAddress.slice(-4)}). Switch accounts in MetaMask and reopen.`,
          );
        }
        setWallet(addr);

        const [info, badges] = await Promise.all([getAttestationInfo(addr), getBadges(profileId)]);
        setAttestation(info);
        setCurrent(badges);
        setSelected(badges.map((b) => b.platformType.toLowerCase()));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [profileId]);

  useEffect(() => {
    if (!open || !profileId) return;
    setAttestation(null);
    setCurrent([]);
    setSelected([]);
    load();
  }, [open, profileId, load]);

  const handleAttach = useCallback(async () => {
    if (!profileId || !wallet || selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const issuedAt = new Date().toISOString();
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(disclosureMessage(wallet, selected, issuedAt));
      const disclosure = await requestDisclosure(wallet, selected, signature, issuedAt);
      const saved = await setBadges(profileId, disclosure.privateAttestationUID, disclosure.proof);
      setCurrent(saved);
      message.success(`Attached ${saved.length} verified badge${saved.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [profileId, wallet, selected]);

  const handleClear = useCallback(async () => {
    if (!profileId) return;
    setBusy(true);
    setError(null);
    try {
      await clearBadges(profileId);
      setCurrent([]);
      setSelected([]);
      message.success('Badges removed.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [profileId]);

  const platforms = attestation?.connectedPlatforms ?? [];

  return (
    <Modal
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MdVerified />
          Verified badges
        </span>
      )}
      open={open}
      onCancel={onClose}
      footer={null}
      width={440}
      destroyOnClose
    >
      <Hint>
        Show buyers which social accounts you have verified in your{' '}
        <a onClick={() => setSpOpen(true)}>Smart Profile</a>. You choose which platforms to
        reveal; the proof is checked against your on-chain attestation, and the rest of your
        profile stays private.
      </Hint>

      {loading ? (
        <Spin />
      ) : (
        <>
          {current.length > 0 && (
            <Block>
              <div className="label">Currently attached</div>
              <BadgeChips badges={current} />
            </Block>
          )}

          {!attestation ? (
            <Hint>
              No attested Smart Profile found for {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'this wallet'}.{' '}
              <a onClick={() => setSpOpen(true)}>Set one up</a> and connect your social accounts
              first — then come back here to attach badges.
            </Hint>
          ) : platforms.length === 0 ? (
            <Hint>
              Your Smart Profile has no connected platforms yet —{' '}
              <a onClick={() => setSpOpen(true)}>connect one</a> first.
            </Hint>
          ) : (
            <Block>
              <div className="label">Platforms to reveal</div>
              <PlatformList>
                {platforms.map((p) => {
                  const key = p.toLowerCase();
                  return (
                    <Checkbox
                      key={key}
                      checked={selected.includes(key)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, key] : prev.filter((x) => x !== key),
                        )
                      }
                    >
                      <span style={{ textTransform: 'capitalize' }}>{p}</span>
                    </Checkbox>
                  );
                })}
              </PlatformList>
            </Block>
          )}

          {error && <ErrorText>{error}</ErrorText>}

          <Footer>
            <Button danger disabled={busy || current.length === 0} onClick={handleClear}>
              Remove all
            </Button>
            <Button
              type="primary"
              loading={busy}
              disabled={!attestation || selected.length === 0}
              onClick={handleAttach}
            >
              Sign &amp; attach
            </Button>
          </Footer>
        </>
      )}

      {/* Embedded Smart Profile widget dialog; on close, re-pull the
          attestation so freshly connected platforms appear immediately. */}
      <VerifyProfileDialog
        open={spOpen}
        onClose={() => {
          setSpOpen(false);
          load();
        }}
      />
    </Modal>
  );
};

export default BadgeManageDialog;
