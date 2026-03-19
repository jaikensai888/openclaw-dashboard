/**
 * API configuration
 * Uses environment variable for API URL or falls back to relative path
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

/**
 * Helper function to build API URLs
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
