import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, File, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface RegexResult {
  path: string;
  line: number;
  snippet: string;
  matches: string[];
}

// GET /api/search/regex?repo=owner/name&q=...
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const query = searchParams.get('q');
  const maxResults = parseInt(searchParams.get('maxResults') || '50');

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

  // Get all files
  const { data: files } = await supabase
    .from('files')
    .select('*')
    .eq('repo_id', repoData.id)
    .limit(maxResults * 10); // Get more files to find matches

  const results: RegexResult[] = [];
  let fileCount = 0;

  try {
    const regex = new RegExp(query, 'i');

    for (const file of files || []) {
      if (fileCount >= maxResults) break;

      const lines = file.content.split('\n');
      const matches: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          matches.push(lines[i].trim());
        }
      }

      if (matches.length > 0) {
        results.push({
          path: file.path,
          line: 1, // First match line
          snippet: matches.slice(0, 5).join('\n'),
          matches: matches.slice(0, 10),
        });
        fileCount++;
      }
    }
  } catch (error) {
    return badRequest('Invalid regex pattern');
  }

  return NextResponse.json(createResponse(results, Math.ceil(JSON.stringify(results).length / 4)));
}
