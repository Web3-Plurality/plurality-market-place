import { useCallback, useState } from 'react';
import { Navigate, NavLink, Routes, Route } from 'react-router-dom';
import styled, { keyframes, css } from 'styled-components';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Dropdown, message } from 'antd';
import { MdAccountBalanceWallet, MdLogout, MdStorefront, MdSmartToy, MdKey, MdExpandMore } from 'react-icons/md';
import { useAppSelector } from '../hooks/useAppStore';
import { useLogout } from '../hooks/useLogout';
import MarketplaceDashboard from '../components/marketplace/MarketplaceDashboard';
import AgentPage from '../pages/AgentPage';
import TokensManagerDialog from '../components/settings/TokensManagerDialog';

// ─── Shared dark/glass aesthetic (mirrors Login.tsx) ─────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Page = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 0% 0%, rgba(20, 22, 38, 1) 0%, rgba(8, 10, 22, 1) 60%),
    #050715;
  color: #fff;
  isolation: isolate;
  animation: ${fadeIn} 0.3s ease;
`;

// ─── Header ──────────────────────────────────────────────────────────────────

const Header = styled.header`
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(8, 10, 22, 0.92) 0%, rgba(8, 10, 22, 0.78) 100%);
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const BrandLogo = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 8px;
`;

const BrandWord = styled.span`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.6px;
  background: linear-gradient(120deg, #ffffff 0%, #c7d2fe 50%, #f9a8d4 100%);
  background-size: 200% 200%;
  -webkit-background-clip: text;
          background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

// ─── Sub-product tabs (Studio / Marketplace / Talk to Memory) ─────────────
const NavTabs = styled.nav`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
`;

const tabActiveStyles = css`
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.45), rgba(236, 72, 153, 0.35));
  color: #fff;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.25);
`;

const NavTab = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  &.active {
    ${tabActiveStyles}
  }
`;

const WalletPill = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-family: 'Lexend', sans-serif;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.18);
  }
`;

const WalletDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.7);
`;

// ─── Content ─────────────────────────────────────────────────────────────────

const ContentArea = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px 64px;

  @media (max-width: 720px) {
    padding: 20px 16px 48px;
  }
`;

// ─── Connect-wallet gate ─────────────────────────────────────────────────────

const GateContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  gap: 24px;
  background:
    radial-gradient(ellipse at 0% 0%, rgba(20, 22, 38, 1) 0%, rgba(8, 10, 22, 1) 60%),
    #050715;
  color: #fff;
  overflow: hidden;
  isolation: isolate;
  animation: ${fadeIn} 0.3s ease;
`;

const GateCard = styled.div`
  position: relative;
  z-index: 3;
  text-align: center;
  padding: 48px 40px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(20, 22, 40, 0.78) 0%, rgba(12, 14, 28, 0.78) 100%);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
  max-width: 440px;
  width: 100%;

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
`;

const GateIconWrap = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(236, 72, 153, 0.25));
  margin-bottom: 16px;
  color: #c7d2fe;
`;

const GateTitle = styled.h2`
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px;
`;

const GateDesc = styled.p`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.65);
  margin: 0 0 24px;
  line-height: 1.55;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover { transform: translateY(-1px); }
  &:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
`;

const GateBackLink = styled.button`
  position: relative;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  cursor: pointer;

  &:hover { color: rgba(255, 255, 255, 0.85); }
`;

// ─── Component ───────────────────────────────────────────────────────────────

const MarketplaceLayoutInner = () => {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { logout: handleLogout } = useLogout();
  const [tokensOpen, setTokensOpen] = useState(false);

  const handleConnect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      message.error('MetaMask is not installed. Please install it to continue.');
      return;
    }
    try {
      if (isConnected) {
        try {
          await disconnectAsync();
          await new Promise((r) => setTimeout(r, 300));
        } catch { /* ignore */ }
      }
      const metamaskConnector = connectors[0];
      if (!metamaskConnector) {
        message.error('MetaMask connector not available');
        return;
      }
      await connectAsync({ connector: metamaskConnector });
    } catch (err: any) {
      const msg = err?.message?.includes('User rejected') || err?.code === 4001
        ? 'Connection rejected'
        : 'Failed to connect: ' + (err?.message || 'Unknown error');
      message.error(msg);
    }
  }, [connectAsync, connectors, disconnectAsync, isConnected]);

  if (!isConnected) {
    return (
      <GateContainer>
        <GateCard>
          <GateIconWrap>
            <MdAccountBalanceWallet size={32} />
          </GateIconWrap>
          <GateTitle>Connect Your Wallet</GateTitle>
          <GateDesc>Connect MetaMask to access the Memory Marketplace and trade your buckets on-chain.</GateDesc>
          <PrimaryButton onClick={handleConnect} disabled={isPending}>
            <MdAccountBalanceWallet size={18} />
            {isPending ? 'Connecting…' : 'Connect MetaMask'}
          </PrimaryButton>
        </GateCard>
        <GateBackLink onClick={handleLogout}>
          <MdLogout size={14} />
          Logout
        </GateBackLink>
      </GateContainer>
    );
  }

  return (
    <Page>
      <Header>
        <HeaderLeft>
          <BrandLogo src="/icon128.png" alt="Plurality" />
          <BrandWord>PLURALITY</BrandWord>
        </HeaderLeft>
        <NavTabs>
          <NavTab to="/marketplace/c2c">
            <MdStorefront size={15} />
            Marketplace
          </NavTab>
          <NavTab to="/marketplace/agent">
            <MdSmartToy size={15} />
            Talk to Memory
          </NavTab>
        </NavTabs>
        <HeaderRight>
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: 'wallet',
                  label: (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                      {address}
                    </div>
                  ),
                  disabled: true,
                },
                { type: 'divider' as const },
                {
                  key: 'tokens',
                  icon: <MdKey size={14} />,
                  label: 'API tokens',
                  onClick: () => setTokensOpen(true),
                },
                { type: 'divider' as const },
                {
                  key: 'logout',
                  icon: <MdLogout size={14} />,
                  label: 'Disconnect',
                  danger: true,
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <WalletPill>
              <WalletDot />
              {address?.slice(0, 6)}…{address?.slice(-4)}
              <MdExpandMore size={14} />
            </WalletPill>
          </Dropdown>
        </HeaderRight>
      </Header>

      <TokensManagerDialog open={tokensOpen} onClose={() => setTokensOpen(false)} />

      <ContentArea>
        <Routes>
          <Route index element={<Navigate to="c2c" replace />} />
          {/* /marketplace/studio collapsed into the Drafts tab inside c2c. */}
          <Route path="studio" element={<Navigate to="../c2c" replace />} />
          <Route path="c2c" element={<MarketplaceDashboard />} />
          <Route path="agent" element={<AgentPage />} />
          <Route path="*" element={<Navigate to="c2c" replace />} />
        </Routes>
      </ContentArea>
    </Page>
  );
};

const MarketplaceLayout = () => {
  // SIWE-only: the HttpOnly session cookie is the auth — there's no JWT to
  // check expiry on. Backend re-validates the cookie on every request, and
  // tryRecoverSession() drives isAuthenticated/chatEncKey on mount.
  const { isAuthenticated, chatEncKey } = useAppSelector((state) => state.auth);

  if (!isAuthenticated || !chatEncKey) {
    return <Navigate to="/login" replace />;
  }

  return <MarketplaceLayoutInner />;
};

export default MarketplaceLayout;
