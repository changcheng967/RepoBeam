import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, File, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';
import redis, { CACHE_KEYS, CACHE_TTL } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// GET /api/tree?repo=owner/name
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter. Use owner/name format.');
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
  const cacheKey = CACHE_KEYS.repoTree(repoData.id);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(createResponse(JSON.parse(cached as string), 100));
  }

  // Get files
  const { data: files } = await supabase
    .from('files')
    .select('path, language, token_count, line_count')
    .eq('repo_id', repoData.id)
    .order('path');

  const tree = files?.map(f => ({
    path: f.path,
    language: f.language,
    tokenCount: f.token_count,
    lineCount: f.line_count,
  })) || [];

  // Cache for 15 minutes
  await redis.set(cacheKey, JSON.stringify(tree), { ex: CACHE_TTL });

  return NextResponse.json(createResponse(tree, Math.ceil(JSON.stringify(tree).length / 4)));
}
