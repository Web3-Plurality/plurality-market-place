import { mainnet, sepolia, optimism } from 'wagmi/chains';
import { metaMask } from 'wagmi/connectors';
import { http, createConfig } from '@wagmi/core';
import { QueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { defineChain, type Chain } from 'viem';
import { MARKETPLACE_CHAIN } from '../utils/env';

// Oasis Sapphire Testnet chain definition
const oasisSapphireTestnet = defineChain({
  id: 23295,
  name: 'Oasis Sapphire Testnet',
  nativeCurrency: { name: 'TEST', symbol: 'TEST', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.sapphire.oasis.io'] },
  },
  blockExplorers: {
    default: { name: 'Oasis Explorer', url: 'https://explorer.oasis.io/testnet/sapphire' },
  },
  testnet: true,
});

// Oasis Sapphire Mainnet chain definition
const oasisSapphireMainnet = defineChain({
  id: 23294,
  name: 'Oasis Sapphire',
  nativeCurrency: { name: 'ROSE', symbol: 'ROSE', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sapphire.oasis.io'] },
  },
  blockExplorers: {
    default: { name: 'Oasis Explorer', url: 'https://explorer.oasis.io/mainnet/sapphire' },
  },
});

// The one chain every wallet write and the SIWE login are bound to, picked by
// VITE_APP_CHAIN: testnet in dev/pre-release builds, mainnet in production.
export const marketplaceChain: Chain = MARKETPLACE_CHAIN === 'mainnet' ? oasisSapphireMainnet : oasisSapphireTestnet;

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, optimism, marketplaceChain],
  connectors: [
    metaMask({
      preferDesktop: true,
      modals: {
        install: ({ terminate }: { terminate?: () => void }) => {
          message.error('MetaMask is not installed. Please install it to continue.');
          return {
            unmount: () => terminate?.(),
          };
        },
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [optimism.id]: http(),
    [oasisSapphireTestnet.id]: http(),
  },
});

export const queryClient = new QueryClient();
