import { mainnet, sepolia, optimism } from 'wagmi/chains';
import { metaMask } from 'wagmi/connectors';
import { http, createConfig } from '@wagmi/core';
import { QueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { defineChain } from 'viem';

// Oasis Sapphire Testnet chain definition
export const oasisSapphireTestnet = defineChain({
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

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, optimism, oasisSapphireTestnet],
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
