import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, File, Symbol, createResponse, estimateTokens } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam, DEFAULT_MAX_TOKENS } from '@/lib/api';
import { extractLineRange, extractSymbolsRegex } from '@/lib/parser';

export const dynamic = 'force-dynamic';

interface FileResponse {
  content: string;
  language: string;
  lineCount: number;
  startLine: number;
  endLine: number;
  path: string;
}

// GET /api/file?repo=owner/name&path=...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const path = searchParams.get('path');
  const startLine = parseInt(searchParams.get('startLine') || '');
  const endLine = parseInt(searchParams.get('endLine') || '');
  const functionName = searchParams.get('function');
  const maxTokens = parseInt(searchParams.get('maxTokens') || '') || DEFAULT_MAX_TOKENS;
  const raw = searchParams.get('raw') === 'true';
  const fresh = searchParams.get('fresh') === 'true';

  // Auth check
  if (!auth(request)) return unauthorized();

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  if (!path) {
    return badRequest('path parameter is required');
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

  let content = file.content;
  let responseStartLine = 1;
  let responseEndLine = file.line_count;
  let truncated = false;
  let hint: string | undefined;

  // Handle function extraction
  if (functionName) {
    const { data: symbols } = await supabase
      .from('symbols')
      .select('*')
      .eq('file_id', file.id)
      .eq('name', functionName)
      .limit(1);

    if (symbols && symbols.length > 0) {
      const symbol = symbols[0];
      content = extractLineRange(file.content, symbol.start_line, symbol.end_line);
      responseStartLine = symbol.start_line;
      responseEndLine = symbol.end_line;
    } else {
      // Try to find function with regex
      const symbols = extractSymbolsRegex(file.content, file.language);
      const symbol = symbols.find(s => s.name === functionName);
      if (symbol) {
        content = extractLineRange(file.content, symbol.startLine, symbol.endLine);
        responseStartLine = symbol.startLine;
        responseEndLine = symbol.endLine;
      } else {
        return NextResponse.json({ error: 'Function not found' }, { status: 404 });
      }
    }
  }
  // Handle line range
  else if (!isNaN(startLine) && !isNaN(endLine) && startLine > 0 && endLine >= startLine) {
    content = extractLineRange(file.content, startLine, endLine);
    responseStartLine = startLine;
    responseEndLine = endLine;
  }
  // Handle truncation
  else if (estimateTokens(content) > maxTokens) {
    const targetLength = maxTokens * 4;
    content = content.substring(0, targetLength);
    truncated = true;
    hint = `Response truncated at ${maxTokens} tokens. Use startLine/endLine or function parameter to get specific sections.`;
    responseEndLine = content.split('\n').length;
  }

  const response: FileResponse = {
    content,
    language: file.language,
    lineCount: content.split('\n').length,
    startLine: responseStartLine,
    endLine: responseEndLine,
    path: file.path,
  };

  const responseTokens = estimateTokens(JSON.stringify(response));

  // Return raw if requested
  if (raw) {
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Token-Count': responseTokens.toString(),
        'X-Truncated': truncated.toString(),
      },
    });
  }

  return NextResponse.json(createResponse(response, responseTokens, truncated, hint));
}
