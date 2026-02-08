import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, File, Symbol, createResponse, estimateTokens } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';
import { extractLineRange, extractSymbolsRegex } from '@/lib/parser';

export const dynamic = 'force-dynamic';

interface FunctionResponse {
  name: string;
  kind: string;
  content: string;
  startLine: number;
  endLine: number;
  signature: string | null;
  path: string;
}

// GET /api/function?repo=owner/name&path=...&name=...
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const path = searchParams.get('path');
  const name = searchParams.get('name');
  const contextParam = searchParams.get('context');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  if (!path || !name) {
    return badRequest('path and name parameters are required');
  }

  const addContext = contextParam === 'true';

  // Get repo
  const { data: repoData } = await supabase
    .from('repos')
    .select('*')
    .eq('full_name', `${repo.owner}/${repo.name}`)
    .single();

  if (!repoData) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  // Get file
  const { data: file } = await supabase
    .from('files')
    .select('*')
    .eq('repo_id', repoData.id)
    .eq('path', path)
    .single();

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Try to find symbol in database
  const { data: symbolData } = await supabase
    .from('symbols')
    .select('*')
    .eq('file_id', file.id)
    .eq('name', name)
    .limit(1);

  let symbol = symbolData && symbolData.length > 0 ? symbolData[0] : null;

  // Fallback to regex parsing
  if (!symbol) {
    const symbols = extractSymbolsRegex(file.content, file.language);
    const found = symbols.find(s => s.name === name);
    if (found) {
      symbol = {
        start_line: found.startLine,
        end_line: found.endLine,
        kind: found.kind,
        signature: found.signature,
      } as Symbol;
    }
  }

  if (!symbol) {
    return NextResponse.json({ error: 'Function not found' }, { status: 404 });
  }

  // Extract content with optional context
  let startLine = symbol.start_line;
  let endLine = symbol.end_line;

  if (addContext) {
    startLine = Math.max(1, startLine - 5);
    endLine = Math.min(file.line_count, endLine + 5);
  }

  const content = extractLineRange(file.content, startLine, endLine);

  const response: FunctionResponse = {
    name,
    kind: symbol.kind,
    content,
    startLine,
    endLine,
    signature: symbol.signature,
    path: file.path,
  };

  const responseTokens = estimateTokens(JSON.stringify(response));

  return NextResponse.json(createResponse(response, responseTokens));
}
