import { Modal } from 'antd';
import styled from 'styled-components';
import { MdVerifiedUser, MdLock } from 'react-icons/md';
import { SP_WIDGET_URL, SP_CLIENT_ID } from '../../utils/env';

/**
 * Smart Profile dialog: embeds the Plurality smart-profile widget (sp-ui) so
 * the user can attest their profile on Sapphire and connect social accounts
 * to their wallet identity.
 *
 * The widget runs its own MetaMask SIWE INSIDE the iframe: the user signs with
 * the SAME wallet they use here, or the attestation lands on a different
 * recipient — hence the warning line in the hint.
 */

interface Props {
  open: boolean;
  onClose: () => void;
}

const Hint = styled.div`
  font-size: 12.5px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.65);
  background: rgba(124, 92, 255, 0.08);
  border: 1px solid rgba(124, 92, 255, 0.25);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;

  b { color: rgba(255, 255, 255, 0.9); }
`;

const TrustLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 10px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.45);

  code {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }
`;

const FrameWrap = styled.div`
  /* sp-ui renders a fixed 430x550 rounded card centered on a transparent page
     when iframed (appLayout.tsx), so the frame adds no background/border of its
     own and must be exactly 550 tall for the card to sit flush. */
  overflow: hidden;
`;

export const VerifyProfileDialog = ({ open, onClose }: Props) => {
  const widgetSrc = SP_WIDGET_URL && SP_CLIENT_ID
    ? `${SP_WIDGET_URL.replace(/\/$/, '')}/?client_id=${SP_CLIENT_ID}`
    : '';

  let widgetHost = '';
  try {
    widgetHost = widgetSrc ? new URL(widgetSrc).host : '';
  } catch {
    widgetHost = '';
  }

  return (
    <Modal
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MdVerifiedUser />
          Your Smart Profile
        </span>
      )}
      open={open}
      onCancel={onClose}
      footer={null}
      width={496}
      destroyOnClose
    >
      <Hint>
        Connect your social accounts and attest your Smart Profile on-chain —
        a portable, verified identity owned by your wallet.{' '}
        Sign inside the widget with the <b>same wallet</b> you are logged in with here —
        the attestation is bound to the signing wallet.
      </Hint>

      {widgetSrc ? (
        <>
          <FrameWrap>
            <iframe
              src={widgetSrc}
              title="Plurality Smart Profile"
              style={{ width: '100%', height: 550, border: 'none', display: 'block', background: 'transparent' }}
              allow="clipboard-write"
            />
          </FrameWrap>
          <TrustLine>
            <MdLock size={12} />
            Official Plurality Smart Profile widget, served from <code>{widgetHost}</code>
          </TrustLine>
        </>
      ) : (
        <Hint>Smart-profile widget is not configured for this environment.</Hint>
      )}
    </Modal>
  );
};

export default VerifyProfileDialog;
