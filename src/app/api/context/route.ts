import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, File, Symbol, createResponse, estimateTokens } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';
import { extractLineRange } from '@/lib/parser';

export const dynamic = 'force-dynamic';

const CONTEXT_BUDGET = 10000;

interface ContextResult {
  target: {
    name: string;
    kind: string;
    content: string;
    startLine: number;
    endLine: number;
  };
  referenced_types: Array<{
    name: string;
    content: string;
  }>;
  called_functions: Array<{
    name: string;
    path: string;
    signature: string;
  }>;
}

// GET /api/context?repo=owner/name&path=...&name=...
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const path = searchParams.get('path');
  const name = searchParams.get('name');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  if (!path || !name) {
    return badRequest('path and name parameters are required');
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

  // Get target symbol
  const { data: symbol } = await supabase
    .from('symbols')
    .select('*')
    .eq('file_id', file.id)
    .eq('name', name)
    .single();

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
  }

  const targetContent = extractLineRange(file.content, symbol.start_line, symbol.end_line);
  let budget = CONTEXT_BUDGET - estimateTokens(targetContent);

  const result: ContextResult = {
    target: {
      name: symbol.name,
      kind: symbol.kind,
      content: targetContent,
      startLine: symbol.start_line,
      endLine: symbol.end_line,
    },
    referenced_types: [],
    called_functions: [],
  };

  // Find referenced types in the same file
  const typeMatches = targetContent.match(/\b([A-Z][a-zA-Z0-9_]*)\b/g);
  if (typeMatches && budget > 0) {
    const uniqueTypes = [...new Set(typeMatches)].filter(t => t !== symbol.name);

    for (const typeName of uniqueTypes.slice(0, 10)) {
      if (budget < 500) break;

      const { data: typeSymbol } = await supabase
        .from('symbols')
        .select('name, kind, start_line, end_line')
        .eq('file_id', file.id)
        .eq('name', typeName)
        .in('kind', ['class', 'struct', 'interface', 'type', 'enum'])
        .single();

      if (typeSymbol) {
        const typeContent = extractLineRange(file.content, typeSymbol.start_line, typeSymbol.end_line);
        const tokens = estimateTokens(typeContent);
        if (tokens < budget) {
          result.referenced_types.push({
            name: typeSymbol.name,
            content: typeContent,
          });
          budget -= tokens;
        }
      }
    }
  }

  // Find called functions in the same file
  const functionMatches = targetContent.match(/\b([a-z][a-zA-Z0-9_]*)\s*\(/gi);
  if (functionMatches && budget > 0) {
    const uniqueFuncs = [...new Set(functionMatches.map(f => f.replace('(', '')))].filter(f => f !== symbol.name);

    for (const funcName of uniqueFuncs.slice(0, 20)) {
      if (budget < 100) break;

      const { data: funcSymbol } = await supabase
        .from('symbols')
        .select('name, signature, files!inner(path)')
        .eq('file_id', file.id)
        .eq('name', funcName)
        .eq('kind', 'function')
        .single();

      if (funcSymbol) {
        const sig = (funcSymbol as any).files?.path;
        result.called_functions.push({
          name: funcSymbol.name,
          path: sig || path,
          signature: funcSymbol.signature || '',
        });
        budget -= 100;
      }
    }
  }

  return NextResponse.json(createResponse(result, CONTEXT_BUDGET - budget));
}
