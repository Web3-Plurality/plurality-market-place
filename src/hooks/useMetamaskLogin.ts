import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import { message } from 'antd';
import { getSiweNonce, authenticateSiwe } from '../services/authApi';

// Extend window type for Ethereum
declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider;
  }
}

const domain = window.location.host;
const origin = window.location.origin;
const statement = 'I am the owner of this address';

interface UseMetamaskLoginReturn {
  isLoading: boolean;
  error: boolean;
  authenticate: (walletAddress: string) => Promise<{ success: boolean; token?: string }>;
  setError: (error: boolean) => void;
}

export const useMetamaskLogin = (): UseMetamaskLoginReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const createSiweMessage = useCallback(async (address: string, nonce: string) => {
    const siweMessage = new SiweMessage({
      domain,
      address,
      statement,
      uri: origin,
      version: '1',
      chainId: 1,
      nonce,
    });
    return siweMessage.prepareMessage();
  }, []);

  const signMessage = useCallback(async (address: string, nonce: string) => {
    if (typeof window.ethereum === 'undefined') {
      message.error('MetaMask is not installed');
      return null;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      // Verify the address matches
      if (userAddress.toLowerCase() !== address.toLowerCase()) {
        message.error('Please connect with the correct wallet');
        return null;
      }

      const siweMessage = await createSiweMessage(userAddress, nonce);
      const signature = await signer.signMessage(siweMessage);

      return { message: siweMessage, signature };
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err) {
        const ethErr = err as { code: number };
        if (ethErr.code === 4001) {
          setError(true);
          message.warning('Signature request was rejected');
        }
      }
      return null;
    }
  }, [createSiweMessage]);

  const authenticate = useCallback(async (
    walletAddress: string
  ): Promise<{ success: boolean; token?: string }> => {
    setIsLoading(true);
    setError(false);

    try {
      // Step 1: Get nonce from backend
      const nonceData = await getSiweNonce(walletAddress);

      if (!nonceData.nonce) {
        console.error('[MetaMask] No nonce received');
        message.error('Failed to get authentication nonce');
        return { success: false };
      }

      // Step 2: Sign the SIWE message
      const signResult = await signMessage(walletAddress, nonceData.nonce);

      if (!signResult) {
        console.error('[MetaMask] Signing failed or rejected');
        return { success: false };
      }

      // Step 3: Authenticate with backend
      const authData = await authenticateSiwe(
        walletAddress,
        signResult.message,
        signResult.signature
      );
      if (authData.success) {
        // Auth data is now stored in Redux via Login.tsx dispatch
        return { success: true, token: authData.token };
      }

      console.error('[MetaMask] Backend authentication failed');
      message.error('Authentication failed');
      return { success: false };
    } catch (err) {
      console.error('[MetaMask] Authentication error:', err);
      message.error('Authentication failed. Please try again.');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [signMessage]);

  return {
    isLoading,
    error,
    authenticate,
    setError,
  };
};
