import { NextRequest, NextResponse } from 'next/server';
import { supabase, estimateTokens } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';

export const dynamic = 'force-dynamic';

// GET /api/outline?repo=owner/name&path=...
// Get file structure without content - returns symbol hierarchy
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const path = searchParams.get('path');

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

  // Get symbols
  const { data: symbols } = await supabase
    .from('symbols')
    .select('*')
    .eq('file_id', file.id)
    .order('start_line', { ascending: true });

  // Build outline with hierarchy
  const outline: any[] = [];
  const stack: any[] = [];

  for (const symbol of symbols || []) {
    const item = {
      name: symbol.name,
      kind: symbol.kind,
      startLine: symbol.start_line,
      endLine: symbol.end_line,
      tokenCount: symbol.token_count,
      signature: symbol.signature,
      children: [] as any[],
    };

    // Pop stack until we find a parent that contains this symbol
    while (stack.length > 0 && stack[stack.length - 1].endLine < symbol.start_line) {
      stack.pop();
    }

    if (stack.length === 0) {
      outline.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }

    // Push if it could be a parent (class, struct, namespace)
    if (['class', 'struct', 'namespace', 'interface'].includes(symbol.kind)) {
      stack.push(item);
    }
  }

  // Calculate stats
  const stats = {
    totalSymbols: symbols?.length || 0,
    functions: symbols?.filter(s => s.kind === 'function' || s.kind === 'method').length || 0,
    classes: symbols?.filter(s => s.kind === 'class').length || 0,
    structs: symbols?.filter(s => s.kind === 'struct').length || 0,
    types: symbols?.filter(s => s.kind === 'type' || s.kind === 'interface' || s.kind === 'enum').length || 0,
    totalTokens: symbols?.reduce((sum, s) => sum + (s.token_count || 0), 0) || 0,
  };

  const response = {
    file: {
      path: file.path,
      language: file.language,
      lineCount: file.line_count,
      totalTokens: file.token_count,
    },
    stats,
    outline,
  };

  return NextResponse.json({
    _meta: {
      total_tokens: estimateTokens(JSON.stringify(response)),
      truncated: false,
    },
    data: response,
  });
}
