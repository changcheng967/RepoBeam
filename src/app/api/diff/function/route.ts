import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, File, Symbol, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';
import { getFileContent as getGitHubFileContent } from '@/lib/github';

export const dynamic = 'force-dynamic';

interface FunctionDiffResult {
  before: {
    content: string;
    startLine: number;
    endLine: number;
  } | null;
  after: {
    content: string;
    startLine: number;
    endLine: number;
  } | null;
  name: string;
  kind: string;
}

// GET /api/diff/function?repo=owner/name&path=...&name=...&since=sha
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const path = searchParams.get('path');
  const name = searchParams.get('name');
  const sinceSha = searchParams.get('since');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  if (!path || !name || !sinceSha) {
    return badRequest('path, name, and since parameters are required');
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

  // Get current function from DB
  const { data: currentFile } = await supabase
    .from('files')
    .select('*')
    .eq('repo_id', repoData.id)
    .eq('path', path)
    .single();

  let afterFunc = null;
  let symbolInfo: { kind: string } | null = null;

  if (currentFile) {
    const { data: symbol } = await supabase
      .from('symbols')
      .select('*')
      .eq('file_id', currentFile.id)
      .eq('name', name)
      .single();

    if (symbol) {
      symbolInfo = { kind: symbol.kind };
      const lines = currentFile.content.split('\n');
      afterFunc = {
        content: lines.slice(symbol.start_line - 1, symbol.end_line).join('\n'),
        startLine: symbol.start_line,
        endLine: symbol.end_line,
      };
    }
  }

  // Get old version from GitHub
  let beforeFunc = null;
  try {
    const oldContent = await getGitHubFileContent(repoData.owner, repoData.name, path);

    // Try to find the function using regex
    const { extractSymbolsRegex } = await import('@/lib/parser');
    const symbols = extractSymbolsRegex(oldContent.content, currentFile?.language || 'text');
    const symbol = symbols.find(s => s.name === name);

    if (symbol) {
      const lines = oldContent.content.split('\n');
      beforeFunc = {
        content: lines.slice(symbol.startLine - 1, symbol.endLine).join('\n'),
        startLine: symbol.startLine,
        endLine: symbol.endLine,
      };
      if (!symbolInfo) symbolInfo = { kind: symbol.kind };
    }
  } catch (error) {
    // File might not exist in old version
  }

  const result: FunctionDiffResult = {
    before: beforeFunc,
    after: afterFunc,
    name,
    kind: symbolInfo?.kind || 'function',
  };

  return NextResponse.json(createResponse(result, Math.ceil(JSON.stringify(result).length / 4)));
}
