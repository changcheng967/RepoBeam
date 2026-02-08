import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.API_KEY;

export function auth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false;

  return parts[1] === API_KEY;
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
