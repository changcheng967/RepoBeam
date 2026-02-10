import { NextRequest, NextResponse } from 'next/server';
import { supabase, createResponse, estimateTokens } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';

export const dynamic = 'force-dynamic';

// GET /api/stats?repo=owner/name
// Get comprehensive repository statistics (v2 enhanced)
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const verbose = searchParams.get('verbose') === 'true';

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
    .select('path, language, token_count, line_count')
    .eq('repo_id', repoData.id);

  // Aggregate stats
  const totalFiles = files?.length || 0;
  const totalLines = files?.reduce((sum, f) => sum + (f.line_count || 0), 0) || 0;
  const totalTokens = files?.reduce((sum, f) => sum + (f.token_count || 0), 0) || 0;

  // Calculate average file size
  const avgLines = totalFiles > 0 ? Math.round(totalLines / totalFiles) : 0;
  const avgTokens = totalFiles > 0 ? Math.round(totalTokens / totalFiles) : 0;

  // Group by language
  const byLanguage: Record<string, { files: number; lines: number; tokens: number; percentage: number }> = {};
  for (const file of files || []) {
    const lang = file.language || 'unknown';
    if (!byLanguage[lang]) {
      byLanguage[lang] = { files: 0, lines: 0, tokens: 0, percentage: 0 };
    }
    byLanguage[lang].files++;
    byLanguage[lang].lines += file.line_count || 0;
    byLanguage[lang].tokens += file.token_count || 0;
  }

  // Calculate percentages
  for (const lang of Object.keys(byLanguage)) {
    byLanguage[lang].percentage = totalFiles > 0
      ? Math.round((byLanguage[lang].files / totalFiles) * 100)
      : 0;
  }

  // Find largest files (by tokens)
  const largestFiles = (files || [])
    .sort((a, b) => (b.token_count || 0) - (a.token_count || 0))
    .slice(0, 20)
    .map(f => ({
      path: f.path,
      tokens: f.token_count,
      lines: f.line_count,
      language: f.language,
    }));

  // File size distribution
  const sizeDistribution = {
    tiny: 0,    // < 100 lines
    small: 0,   // 100-500 lines
    medium: 0,  // 500-1000 lines
    large: 0,   // 1000-5000 lines
    huge: 0,    // > 5000 lines
  };
  for (const file of files || []) {
    const lines = file.line_count || 0;
    if (lines < 100) sizeDistribution.tiny++;
    else if (lines < 500) sizeDistribution.small++;
    else if (lines < 1000) sizeDistribution.medium++;
    else if (lines < 5000) sizeDistribution.large++;
    else sizeDistribution.huge++;
  }

  // Directory structure (top level directories)
  const directories: Record<string, { files: number; tokens: number }> = {};
  for (const file of files || []) {
    const parts = file.path.split('/');
    const topLevel = parts[0] || 'root';
    if (!directories[topLevel]) {
      directories[topLevel] = { files: 0, tokens: 0 };
    }
    directories[topLevel].files++;
    directories[topLevel].tokens += file.token_count || 0;
  }

  const response: any = {
    repository: {
      name: repoData.full_name,
      description: repoData.description,
      language: repoData.language,
      lastSyncedAt: repoData.last_synced_at,
      lastSha: repoData.last_sha,
    },
    overview: {
      totalFiles,
      totalLines,
      totalTokens,
      avgLinesPerFile: avgLines,
      avgTokensPerFile: avgTokens,
    },
    byLanguage,
    largestFiles: largestFiles.slice(0, 10), // Top 10 by default
    sizeDistribution,
    directories,
  };

  // Add verbose details if requested
  if (verbose) {
    response.largestFiles = largestFiles; // All 20
    response.allFiles = (files || []).map(f => ({
      path: f.path,
      language: f.language,
      lines: f.line_count,
      tokens: f.token_count,
    }));
  }

  return NextResponse.json(createResponse(response, estimateTokens(JSON.stringify(response))));
}
