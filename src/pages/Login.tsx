import { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { message } from 'antd';
import { SiEthereum } from 'react-icons/si';
import { MdToken, MdShield, MdLock } from 'react-icons/md';
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore';
import { setUser, setAuthMethod } from '../store/slices/authSlice';
import { useMetamaskLogin } from '../hooks/useMetamaskLogin';

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
  50% { transform: translateY(-12px) rotate(var(--r, 0deg)); }
`;

const shimmer = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.45), 0 12px 32px rgba(99, 102, 241, 0.35); }
  50%     { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0), 0 14px 36px rgba(99, 102, 241, 0.5); }
`;

// ─── Layout ──────────────────────────────────────────────────────────────────

const Page = styled.div`
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 0% 0%, rgba(20, 22, 38, 1) 0%, rgba(8, 10, 22, 1) 60%),
    #050715;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  isolation: isolate;
`;

const Top = styled.div`
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  align-items: center;
  z-index: 5;
`;

const BrandRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const BrandLogo = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 8px;
`;

const BrandText = styled.span`
  font-size: 14px;
  letter-spacing: 0.6px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
`;

// Stage holds the card + decorative floating tiles around it
const Stage = styled.div`
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 100%;
  max-width: 1100px;
`;

// Floating decorative "Skill" tiles
const FloatTile = styled.div<{ $top?: string; $left?: string; $right?: string; $bottom?: string; $rot?: number; $delay?: number }>`
  position: absolute;
  ${({ $top }) => $top && css`top: ${$top};`}
  ${({ $left }) => $left && css`left: ${$left};`}
  ${({ $right }) => $right && css`right: ${$right};`}
  ${({ $bottom }) => $bottom && css`bottom: ${$bottom};`}
  --r: ${({ $rot = 0 }) => `${$rot}deg`};
  width: 180px;
  padding: 14px;
  border-radius: 14px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  animation: ${float} 6s ease-in-out infinite;
  animation-delay: ${({ $delay = 0 }) => `${$delay}s`};
  pointer-events: none;
  z-index: 1;

  @media (max-width: 1080px) {
    display: none;
  }
`;

const TileLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 6px;
`;

const TileTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 10px;
`;

const TileChips = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const TileChip = styled.span`
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.75);
`;

// Glass card
const Card = styled.div`
  position: relative;
  z-index: 3;
  width: 100%;
  max-width: 460px;
  padding: 40px 36px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(20, 22, 40, 0.78) 0%, rgba(12, 14, 28, 0.78) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  animation: ${fadeIn} 0.6s ease-out 0.1s both;

  /* Subtle gradient border halo */
  &::before {
    content: '';
    position: absolute;
    inset: -1px;
    padding: 1px;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.5), rgba(236, 72, 153, 0.4) 50%, rgba(34, 211, 238, 0.4));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
            mask-composite: exclude;
    opacity: 0.6;
    pointer-events: none;
  }

  @media (max-width: 480px) {
    padding: 32px 24px;
    border-radius: 20px;
  }
`;

const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.35);
  color: #c7d2fe;
  font-size: 11px;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  margin-bottom: 18px;
`;

const Title = styled.h1`
  font-size: 36px;
  line-height: 1.1;
  font-weight: 700;
  margin: 0 0 12px;
  letter-spacing: -0.5px;

  background: linear-gradient(120deg, #ffffff 0%, #c7d2fe 35%, #f9a8d4 65%, #ffffff 100%);
  background-size: 200% 200%;
  -webkit-background-clip: text;
          background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${shimmer} 8s ease-in-out infinite;

  @media (max-width: 480px) {
    font-size: 30px;
  }
`;

const Subtitle = styled.p`
  font-size: 15px;
  color: rgba(255, 255, 255, 0.65);
  margin: 0 0 32px;
  line-height: 1.55;
`;

const ConnectButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 16px 20px;
  border-radius: 14px;
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  background-size: 180% 180%;
  transition: transform 0.2s ease, background-position 0.4s ease;
  animation: ${pulseGlow} 3.6s ease-in-out infinite;

  &:hover {
    transform: translateY(-2px);
    background-position: 100% 100%;
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
    animation: none;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 22px 0 14px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.12), transparent);
  }
`;

const TrustRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
`;

const TrustItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  text-align: center;

  svg { color: #a5b4fc; }
`;

const Footnote = styled.div`
  margin-top: 28px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
`;

const LoadingScreen = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background:
    radial-gradient(ellipse at 0% 0%, rgba(20, 22, 38, 1) 0%, rgba(8, 10, 22, 1) 60%),
    #050715;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Lexend', sans-serif;
  letter-spacing: 0.5px;
`;

// ─── Component ───────────────────────────────────────────────────────────────

const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { isLoading: isMetamaskLoading, authenticate: authenticateSiwe } = useMetamaskLogin();

  const { isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const auth = useAppSelector((state) => state.auth);
  const isAuthenticated = auth?.isAuthenticated ?? false;

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/marketplace', { replace: true });
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const metaMaskConnectingRef = useRef(false);

  const handleMetaMaskLogin = async () => {
    if (metaMaskConnectingRef.current) {
      message.info('MetaMask connection in progress. Please check the MetaMask popup.');
      return;
    }
    metaMaskConnectingRef.current = true;

    try {
      if (isConnected) {
        try {
          await disconnectAsync();
          await new Promise((r) => setTimeout(r, 500));
        } catch {
          // Ignore disconnect errors
        }
      }

      const metamaskConnector = connectors[0];
      if (!metamaskConnector) {
        message.error('MetaMask connector not found');
        return;
      }

      const connection = await connectAsync({ connector: metamaskConnector });

      if (connection && connection.accounts.length > 0) {
        const walletAddress = connection.accounts[0];

        const authResult = await authenticateSiwe(walletAddress);

        if (authResult.success) {
          dispatch(setUser({ id: walletAddress, walletAddress }));
          dispatch(setAuthMethod('metamask'));
          // No token in the response body anymore: the HttpOnly cookie IS
          // the auth, and page JS has no business holding a copy.

          navigate('/marketplace');
        } else {
          try {
            await disconnectAsync();
          } catch {
            // Ignore
          }
        }
      }
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      console.error('[MetaMask] Connection error:', err);
      if (err.code === 4001) {
        message.warning('Connection rejected by user');
      } else if (err.code === -32002 || err.message?.includes('already pending')) {
        message.info('A MetaMask request is already pending. Please open the MetaMask extension to approve it.');
      } else if (!window.ethereum) {
        message.error('MetaMask is not installed. Please install it to continue.');
      } else {
        message.error('MetaMask connection failed. Please try again.');
      }
    } finally {
      metaMaskConnectingRef.current = false;
    }
  };

  if (isCheckingAuth) {
    return <LoadingScreen>Loading…</LoadingScreen>;
  }

  return (
    <Page>

      <Top>
        <BrandRow>
          <BrandLogo src="/icon128.png" alt="Plurality" />
          <BrandText>MEMORY MARKETPLACE</BrandText>
        </BrandRow>
      </Top>

      <Stage>
        <FloatTile $top="6%" $left="6%" $rot={-6} $delay={0}>
          <TileLabel>Memory</TileLabel>
          <TileTitle>Crypto Research</TileTitle>
          <TileChips>
            <TileChip>32 contexts</TileChip>
            <TileChip>#1422</TileChip>
          </TileChips>
        </FloatTile>

        <FloatTile $top="14%" $right="8%" $rot={5} $delay={1.2}>
          <TileLabel>Memory</TileLabel>
          <TileTitle>Travel Memories</TileTitle>
          <TileChips>
            <TileChip>14 contexts</TileChip>
            <TileChip>#894</TileChip>
          </TileChips>
        </FloatTile>

        <FloatTile $bottom="10%" $left="9%" $rot={4} $delay={2.4}>
          <TileLabel>Memory</TileLabel>
          <TileTitle>Coding Snippets</TileTitle>
          <TileChips>
            <TileChip>67 contexts</TileChip>
            <TileChip>#3091</TileChip>
          </TileChips>
        </FloatTile>

        <FloatTile $bottom="14%" $right="6%" $rot={-4} $delay={0.6}>
          <TileLabel>Memory</TileLabel>
          <TileTitle>Recipes</TileTitle>
          <TileChips>
            <TileChip>21 contexts</TileChip>
            <TileChip>#705</TileChip>
          </TileChips>
        </FloatTile>

        <Card>
          <Eyebrow>
            <MdToken size={12} /> NFT-backed memory buckets
          </Eyebrow>
          <Title>Own your knowledge.<br />Trade it as NFTs.</Title>
          <Subtitle>
            Mint your AI memory buckets as NFTs on Oasis Sapphire. Browse, buy, and use them directly in Claude, Cursor or any AI agent.
          </Subtitle>

          <ConnectButton onClick={handleMetaMaskLogin} disabled={isMetamaskLoading}>
            <SiEthereum size={20} />
            {isMetamaskLoading ? 'Connecting…' : 'Connect with MetaMask'}
          </ConnectButton>

          <Divider>SECURED BY</Divider>

          <TrustRow>
            <TrustItem>
              <MdShield size={18} />
              SIWE
            </TrustItem>
            <TrustItem>
              <MdLock size={18} />
              HttpOnly
            </TrustItem>
            <TrustItem>
              <SiEthereum size={18} />
              Oasis L2
            </TrustItem>
          </TrustRow>

          <Footnote>
            By connecting, you agree to sign a one-time message to verify wallet ownership. No transaction, no gas.
          </Footnote>
        </Card>
      </Stage>
    </Page>
  );
};

export default LoginPage;
