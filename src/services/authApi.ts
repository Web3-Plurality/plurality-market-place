import axios from 'axios';
import { API_BASE_URL } from '../utils/env';

// Configure axios instance with credentials for HttpOnly cookies
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Required for HttpOnly cookies
});

// SIWE (MetaMask) APIs — the only auth surface the marketplace uses.
export const getSiweNonce = async (address: string) => {
  const response = await api.post('/auth/siwe/login', { address });
  return response.data;
};

export const authenticateSiwe = async (
  address: string,
  message: string,
  signature: string
) => {
  const headersData = JSON.stringify({ siwe: signature, message: encodeURIComponent(message) });
  const response = await api.post(
    '/auth/siwe/authenticate',
    { address },
    { headers: { 'x-siwe': headersData } }
  );
  return response.data;
};
