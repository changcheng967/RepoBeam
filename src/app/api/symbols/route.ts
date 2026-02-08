import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, File, Symbol, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';
import { extractSymbolsRegex } from '@/lib/parser';
import redis, { CACHE_KEYS, CACHE_TTL } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// GET /api/symbols?repo=owner/name&path=...
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const path = searchParams.get('path');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  if (!path) {
    return badRequest('path parameter is required');
  }

  // Get repo
  const { data: repoData } = await supabase
    .from('repos')
    .select('*')
    .eq('full_name', `${repo.owner}/${repo.name}`)
    .single();

  if (!repoData) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  // Try cache first
  const cacheKey = CACHE_KEYS.symbolList(repoData.id, path);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(createResponse(JSON.parse(cached as string), 100));
  }

  // Get file
  const { data: file } = await supabase
    .from('files')
    .select('id, content, language')
    .eq('repo_id', repoData.id)
    .eq('path', path)
    .single();

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Get symbols from database
  const { data: symbols } = await supabase
    .from('symbols')
    .select('*')
    .eq('file_id', file.id)
    .order('start_line');

  const symbolsList = symbols?.map(s => ({
    name: s.name,
    kind: s.kind,
    startLine: s.start_line,
    endLine: s.end_line,
    tokenCount: s.token_count,
    signature: s.signature,
  })) || [];

  // If no symbols in DB, try parsing
  if (symbolsList.length === 0) {
    const parsed = extractSymbolsRegex(file.content, file.language);
    const parsedList = parsed.map(s => ({
      name: s.name,
      kind: s.kind,
      startLine: s.startLine,
      endLine: s.endLine,
      tokenCount: Math.ceil(
        file.content.split('\n').slice(s.startLine - 1, s.endLine).join('\n').length / 4
      ),
      signature: s.signature,
    }));
    symbolsList.push(...parsedList);
  }

  // Cache for 15 minutes
  await redis.set(cacheKey, JSON.stringify(symbolsList), { ex: CACHE_TTL });

  return NextResponse.json(createResponse(symbolsList, Math.ceil(JSON.stringify(symbolsList).length / 4)));
}
