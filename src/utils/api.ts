/**
 * API utilities with HttpOnly cookie support
 *
 * All API calls should use this wrapper to ensure:
 * 1. credentials: 'include' is set (sends HttpOnly cookies)
 * 2. Consistent error handling
 */

import { API_BASE_URL } from './env';

type FetchOptions = Omit<RequestInit, 'credentials'>;

// Flag to suppress error notifications after 401 logout redirect
let isLoggingOut = false;
export const isAuthLoggingOut = () => isLoggingOut;

/**
 * Fetch wrapper that automatically includes credentials (cookies)
 */
export const apiFetch = async (
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Always include cookies
  });

  // Auto-logout on 401 Unauthorized (expired/invalid token)
  if (response.status === 401 && !isLoggingOut) {
    isLoggingOut = true;
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  return response;
};

/**
 * GET request with credentials
 */
export const apiGet = async (
  endpoint: string,
  headers?: HeadersInit
): Promise<Response> => {
  return apiFetch(endpoint, {
    method: 'GET',
    headers,
  });
};

/**
 * POST request with credentials and JSON body
 */
export const apiPost = async (
  endpoint: string,
  body?: unknown,
  headers?: HeadersInit
): Promise<Response> => {
  return apiFetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * PUT request with credentials and JSON body
 */
export const apiPut = async (
  endpoint: string,
  body?: unknown,
  headers?: HeadersInit
): Promise<Response> => {
  return apiFetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * DELETE request with credentials
 */
export const apiDelete = async (
  endpoint: string,
  headers?: HeadersInit
): Promise<Response> => {
  return apiFetch(endpoint, {
    method: 'DELETE',
    headers,
  });
};

/**
 * PATCH request with credentials and JSON body
 */
export const apiPatch = async (
  endpoint: string,
  body?: unknown,
  headers?: HeadersInit
): Promise<Response> => {
  return apiFetch(endpoint, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
};
