/**
 * API utilities for the web console
 * Handles basePath-aware fetch calls and static assets
 */

// Get basePath from Next.js config (available at build time)
// In dev, this comes from next.config.ts
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/**
 * Construct a URL that respects the basePath
 * Use this for all internal API calls (Next.js API routes) and static assets
 */
export function apiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${normalizedPath}`;
}

/**
 * Construct a static asset URL that respects the basePath
 * Use this for images and other files in the public folder
 */
export function assetUrl(path: string): string {
  return apiUrl(path);
}

/**
 * Fetch from an internal API route with basePath handling
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), options);
}

export function isJsonContentType(contentType: string | null): boolean {
  return contentType?.toLowerCase().includes('application/json') ?? false;
}

export function toBodyPreview(body: string, maxLength = 160): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}
