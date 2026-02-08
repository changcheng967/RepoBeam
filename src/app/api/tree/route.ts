import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, File, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';
import redis, { CACHE_KEYS, CACHE_TTL } from '@/lib/redis';
import { syncRepo } from '@/lib/sync';

export const dynamic = 'force-dynamic';

// Auto-initialize Luminex if not found
async function ensureLuminexIndexed() {
  const { data: existing } = await supabase
    .from('repos')
    .select('*')
    .eq('full_name', 'changcheng967/Luminex')
    .single();

  if (!existing) {
    // Create repo entry
    const { data: newRepo } = await supabase
      .from('repos')
      .insert({
        owner: 'changcheng967',
        name: 'Luminex',
        full_name: 'changcheng967/Luminex',
        description: 'High-performance ML inference framework',
        language: 'C++',
        last_sha: null,
        last_synced_at: null,
      })
      .select()
      .single();

    // Trigger sync in background
    syncRepo('changcheng967', 'Luminex').catch(console.error);
    return newRepo;
  }

  // Also trigger sync if it's been a while
  const lastSync = existing.last_synced_at ? new Date(existing.last_synced_at) : null;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (!lastSync || lastSync < oneHourAgo) {
    syncRepo('changcheng967', 'Luminex').catch(console.error);
  }

  return existing;
}

// GET /api/tree?repo=owner/name
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter. Use owner/name format.');
  }

  // Special handling for Luminex - auto-index if not found
  if (repo.full_name === 'changcheng967/Luminex') {
    await ensureLuminexIndexed();
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

  // Try cache first (skip if Redis not configured)
  let cached = null;
  try {
    const cacheKey = CACHE_KEYS.repoTree(repoData.id);
    cached = await redis.get(cacheKey);
  } catch (e) {
    // Redis not configured, skip cache
  }

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

  // Cache for 15 minutes (skip if Redis not configured)
  try {
    const cacheKey = CACHE_KEYS.repoTree(repoData.id);
    await redis.set(cacheKey, JSON.stringify(tree), { ex: CACHE_TTL });
  } catch (e) {
    // Redis not configured, skip cache
  }

  return NextResponse.json(createResponse(tree, Math.ceil(JSON.stringify(tree).length / 4)));
}
