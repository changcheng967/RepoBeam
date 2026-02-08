import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, File, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';
import { getCommitsSince, getCommitFiles } from '@/lib/github';

export const dynamic = 'force-dynamic';

interface DiffResult {
  sha: string;
  changed_files: string[];
}

// GET /api/diff?repo=owner/name&since=sha
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const sinceSha = searchParams.get('since');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  if (!sinceSha) {
    return badRequest('since parameter is required');
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

  // Get commits since SHA
  const commits = await getCommitsSince(repoData.owner, repoData.name, sinceSha);

  if (commits.length === 0) {
    return NextResponse.json(createResponse([], 10));
  }

  // Collect all changed files
  const changedFilesSet = new Set<string>();
  for (const sha of commits) {
    try {
      const files = await getCommitFiles(repoData.owner, repoData.name, sha);
      files.forEach(f => changedFilesSet.add(f));
    } catch (error) {
      console.error(`Failed to get files for commit ${sha}:`, error);
    }
  }

  const result: DiffResult = {
    sha: commits[0],
    changed_files: Array.from(changedFilesSet),
  };

  return NextResponse.json(createResponse(result, Math.ceil(JSON.stringify(result).length / 4)));
}
