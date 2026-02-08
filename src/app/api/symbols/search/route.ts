import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, Symbol, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface SymbolSearchResult {
  name: string;
  kind: string;
  path: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
  signature: string | null;
}

// GET /api/symbols/search?repo=owner/name&q=...
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const query = searchParams.get('q');
  const kind = searchParams.get('kind');
  const limit = parseInt(searchParams.get('limit') || '50');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  if (!query) {
    return badRequest('q parameter is required');
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

  // Fuzzy search using pg_trgm
  let searchQuery = supabase
    .from('symbols')
    .select(`
      name,
      kind,
      start_line,
      end_line,
      token_count,
      signature,
      files!inner(
        path
      )
    `)
    .filter('files.repo_id', 'eq', repoData.id)
    .ilike('name', `%${query}%`)
    .limit(limit);

  if (kind) {
    searchQuery = searchQuery.eq('kind', kind);
  }

  const { data: symbols } = await searchQuery;

  const results: SymbolSearchResult[] = (symbols || []).map((s: any) => ({
    name: s.name,
    kind: s.kind,
    path: s.files.path,
    startLine: s.start_line,
    endLine: s.end_line,
    tokenCount: s.token_count,
    signature: s.signature,
  }));

  return NextResponse.json(createResponse(results, Math.ceil(JSON.stringify(results).length / 4)));
}
