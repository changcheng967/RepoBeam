import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, File, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface SearchResult {
  path: string;
  line: number;
  snippet: string;
  symbol?: string;
}

// GET /api/search?repo=owner/name&q=...
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const query = searchParams.get('q');
  const filePattern = searchParams.get('filePattern');
  const maxResults = parseInt(searchParams.get('maxResults') || '20');

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

  // Full-text search using tsvector
  let searchQuery = supabase
    .from('files')
    .select('id, path, content')
    .eq('repo_id', repoData.id)
    .textSearch('content', query.replace(/["']/g, ''), {
      type: 'plain',
      config: 'english',
    });

  if (filePattern) {
    searchQuery = searchQuery.like('path', `%${filePattern}%`);
  }

  searchQuery = searchQuery.limit(maxResults);

  const { data: files, error } = await searchQuery;

  if (error) {
    // Fallback to ILIKE if tsvector search fails
    const { data: fallbackFiles } = await supabase
      .from('files')
      .select('id, path, content')
      .eq('repo_id', repoData.id)
      .ilike('content', `%${query}%`)
      .limit(maxResults);

    const results: SearchResult[] = (fallbackFiles || []).map(file => {
      const lines = file.content.split('\n');
      const matchLine = lines.findIndex((l: string) => l.toLowerCase().includes(query.toLowerCase()));
      const line = matchLine >= 0 ? matchLine + 1 : 1;

      // Get snippet (5 lines context)
      const snippetStart = Math.max(0, line - 6);
      const snippetEnd = Math.min(lines.length, line + 4);
      const snippet = lines.slice(snippetStart, snippetEnd).join('\n');

      return {
        path: file.path,
        line,
        snippet: snippet.substring(0, 500),
      };
    });

    return NextResponse.json(createResponse(results, Math.ceil(JSON.stringify(results).length / 4)));
  }

  const results: SearchResult[] = (files || []).map(file => {
    const lines = file.content.split('\n');
    const matchLine = lines.findIndex((l: string) => l.toLowerCase().includes(query.toLowerCase()));
    const line = matchLine >= 0 ? matchLine + 1 : 1;

    // Get snippet (5 lines context)
    const snippetStart = Math.max(0, line - 6);
    const snippetEnd = Math.min(lines.length, line + 4);
    const snippet = lines.slice(snippetStart, snippetEnd).join('\n');

    return {
      path: file.path,
      line,
      snippet: snippet.substring(0, 500),
    };
  });

  return NextResponse.json(createResponse(results, Math.ceil(JSON.stringify(results).length / 4)));
}
