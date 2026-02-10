import { NextRequest, NextResponse } from 'next/server';
import { supabase, createResponse, estimateTokens } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface SearchResult {
  path: string;
  line: number;
  snippet: string;
  contextBefore: number;
  contextAfter: number;
  matchCount: number;
}

// GET /api/search?repo=owner/name&q=...&contextLines=5
// Enhanced v2 search with configurable context
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const query = searchParams.get('q');
  const filePattern = searchParams.get('filePattern');
  const maxResults = parseInt(searchParams.get('maxResults') || '50');
  const contextLines = parseInt(searchParams.get('contextLines') || '5');
  const highlight = searchParams.get('highlight') === 'true';

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

  // Search using ILIKE (case-insensitive pattern matching)
  let searchQuery = supabase
    .from('files')
    .select('id, path, content')
    .eq('repo_id', repoData.id)
    .ilike('content', `%${query}%`);

  if (filePattern) {
    searchQuery = searchQuery.like('path', `%${filePattern}%`);
  }

  searchQuery = searchQuery.limit(maxResults);

  const { data: files } = await searchQuery;

  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  for (const file of files || []) {
    const lines = file.content.split('\n');

    // Find all matches in this file
    const matches: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(queryLower)) {
        matches.push(i + 1);
      }
    }

    // Group nearby matches to avoid duplicates
    const groupedMatches: number[] = [];
    for (const match of matches) {
      const isNear = groupedMatches.some(m => Math.abs(m - match) <= contextLines * 2);
      if (!isNear) {
        groupedMatches.push(match);
      }
    }

    // Create result for each grouped match
    for (const matchLine of groupedMatches.slice(0, 3)) { // Max 3 matches per file
      const snippetStart = Math.max(0, matchLine - contextLines - 1);
      const snippetEnd = Math.min(lines.length, matchLine + contextLines);
      let snippet = lines.slice(snippetStart, snippetEnd).join('\n');

      // Highlight matches if requested
      if (highlight) {
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        snippet = snippet.replace(regex, '>>>$1<<<');
      }

      // Count occurrences in snippet
      const matchCount = (snippet.toLowerCase().match(queryLower.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) || []).length;

      results.push({
        path: file.path,
        line: matchLine,
        snippet: snippet.substring(0, 1000),
        contextBefore: contextLines,
        contextAfter: contextLines,
        matchCount,
      });
    }

    if (results.length >= maxResults) break;
  }

  return NextResponse.json(createResponse({
    query,
    filePattern,
    contextLines,
    resultCount: results.length,
    results,
  }, estimateTokens(JSON.stringify(results))));
}
