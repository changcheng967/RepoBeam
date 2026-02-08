import { NextRequest, NextResponse } from 'next/server';
import { supabase, estimateTokens } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';
import { extractSymbolsWithLLM } from '@/lib/symbols';

export const dynamic = 'force-dynamic';

// POST /api/symbols/extract?repo=owner/name&path=...
// Extracts symbols for a file on-demand using LLM
export async function POST(request: NextRequest) {
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

  // Check if symbols already exist
  const { data: existingSymbols } = await supabase
    .from('symbols')
    .select('count')
    .eq('file_id', file.id);

  const hasSymbols = (existingSymbols as any)?.length || 0 > 0;

  if (hasSymbols) {
    return NextResponse.json({
      status: 'complete',
      symbols: existingSymbols,
    });
  }

  // Extract symbols using LLM
  console.log(`[extract] On-demand extraction for ${path}`);
  const symbols = await extractSymbolsWithLLM(file.content, file.language || '');

  if (symbols.length === 0) {
    return NextResponse.json({
      status: 'complete',
      symbols: [],
    });
  }

  // Insert symbols
  const symbolsToInsert = symbols.map(s => ({
    file_id: file.id,
    name: s.name,
    kind: s.kind,
    signature: s.signature || null,
    start_line: s.startLine,
    end_line: s.endLine,
    token_count: estimateTokens(
      file.content.split('\n').slice(s.startLine - 1, s.endLine).join('\n')
    ),
    parent_symbol: null,
  }));

  await supabase
    .from('symbols')
    .insert(symbolsToInsert);

  return NextResponse.json({
    status: 'complete',
    symbols: symbolsToInsert,
  });
}

// GET /api/symbols/extract?repo=owner/name&path=...
// Check if symbols exist for a file
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

  // Check if symbols exist
  const { data: symbols } = await supabase
    .from('symbols')
    .select('*')
    .eq('file_id', file.id);

  return NextResponse.json({
    status: symbols && symbols.length > 0 ? 'complete' : 'pending',
    symbols: symbols || [],
  });
}
