/**
 * Authentication utilities for Dashboard Remote Server
 */

import type { IncomingMessage } from 'http';
import type { ServerConfig } from '../types/index.js';

/**
 * Validate authentication token against server configuration
 *
 * @param config - Server configuration containing auth settings
 * @param token - Token to validate (optional)
 * @returns true if token is valid or if no token is configured
 */
export function validateToken(config: ServerConfig, token?: string): boolean {
  // If no token is configured, allow all connections (with warning)
  if (!config.auth?.token) {
    return true;
  }

  // If token is configured but not provided, reject
  if (!token) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  const expectedToken = config.auth.token;
  const providedToken = token;

  if (expectedToken.length !== providedToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expectedToken.length; i++) {
    result |= expectedToken.charCodeAt(i) ^ providedToken.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Extract authentication token from HTTP request
 *
 * Token can be provided via:
 * - Authorization header as Bearer token
 * - Query parameter 'token'
 *
 * @param request - HTTP incoming message
 * @returns Token string if found, undefined otherwise
 */
export function extractTokenFromRequest(request: IncomingMessage): string | undefined {
  // Try Authorization header first (Bearer token)
  const authHeader = request.headers.authorization;
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }

  // Try query parameter
  const url = request.url;
  if (url) {
    try {
      const searchParams = new URL(url, `http://${request.headers.host || 'localhost'}`).searchParams;
      const token = searchParams.get('token');
      if (token) {
        return token;
      }
    } catch {
      // Invalid URL, ignore
    }
  }

  return undefined;
}

/**
 * Extract token from WebSocket URL (for ws library)
 *
 * @param url - WebSocket connection URL
 * @returns Token string if found, undefined otherwise
 */
export function extractTokenFromUrl(url: string): string | undefined {
  try {
    const parsedUrl = new URL(url, 'http://localhost');
    return parsedUrl.searchParams.get('token') || undefined;
  } catch {
    return undefined;
  }
}
