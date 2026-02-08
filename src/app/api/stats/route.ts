import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';

export const dynamic = 'force-dynamic';

// GET /api/stats?repo=owner/name
// Get comprehensive repository statistics
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
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

  // Get file stats
  const { data: files } = await supabase
    .from('files')
    .select('language, token_count, line_count')
    .eq('repo_id', repoData.id);

  // Get symbol stats
  const { data: symbols } = await supabase
    .from('symbols')
    .select('kind, token_count')
    .eq('repo_id', repoData.id);

  // Aggregate stats
  const totalFiles = files?.length || 0;
  const totalLines = files?.reduce((sum, f) => sum + (f.line_count || 0), 0) || 0;
  const totalTokens = files?.reduce((sum, f) => sum + (f.token_count || 0), 0) || 0;
  const totalSymbols = symbols?.length || 0;

  // Group by language
  const byLanguage: Record<string, { files: number; lines: number; tokens: number }> = {};
  for (const file of files || []) {
    const lang = file.language || 'unknown';
    if (!byLanguage[lang]) {
      byLanguage[lang] = { files: 0, lines: 0, tokens: 0 };
    }
    byLanguage[lang].files++;
    byLanguage[lang].lines += file.line_count || 0;
    byLanguage[lang].tokens += file.token_count || 0;
  }

  // Group by symbol kind
  const bySymbolKind: Record<string, number> = {};
  for (const symbol of symbols || []) {
    const kind = symbol.kind || 'unknown';
    bySymbolKind[kind] = (bySymbolKind[kind] || 0) + 1;
  }

  // Find largest files
  const largestFiles = (files || [])
    .sort((a, b) => (b.token_count || 0) - (a.token_count || 0))
    .slice(0, 10)
    .map(f => ({
      path: (f as any).path,
      tokens: f.token_count,
      lines: f.line_count,
    }));

  const response = {
    repository: {
      name: repoData.full_name,
      description: repoData.description,
      language: repoData.language,
      lastSyncedAt: repoData.last_synced_at,
    },
    overview: {
      totalFiles,
      totalLines,
      totalTokens,
      totalSymbols,
    },
    byLanguage,
    bySymbolKind,
    largestFiles,
  };

  return NextResponse.json({
    _meta: {
      total_tokens: Math.ceil(JSON.stringify(response).length / 4),
      truncated: false,
    },
    data: response,
  });
}
