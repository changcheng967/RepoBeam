import { NextRequest, NextResponse } from 'next/server';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'internal-web-ui';

// Authentication is DISABLED - all API endpoints are publicly accessible
// This makes the API fully LLM-friendly via URL-only access
export function auth(request: NextRequest): boolean {
  return true;
}

// Check if request is from internal web UI (for caching purposes)
export function isInternalRequest(request: NextRequest): boolean {
  return request.headers.get('x-internal-request') === INTERNAL_SECRET;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message: string = 'Not found'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message: string = 'Internal server error'): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}

// Parse repo parameter from query
export function parseRepoParam(repo: string | null): { owner: string; name: string } | null {
  if (!repo) return null;

  const parts = repo.split('/');
  if (parts.length !== 2) return null;

  return { owner: parts[0], name: parts[1] };
}

// Default max tokens
export const DEFAULT_MAX_TOKENS = 8000;

// Fetch wrapper for internal API calls
export async function internalFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'x-internal-request': INTERNAL_SECRET,
    },
  });
}
