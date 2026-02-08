import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';

export const dynamic = 'force-dynamic';

// GET /api/references?repo=owner/name&symbol=name
// Find where a symbol is used across the codebase
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const symbol = searchParams.get('symbol');
  const file = searchParams.get('file');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  if (!symbol) {
    return badRequest('symbol parameter is required');
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

  // Get all files in the repo
  const { data: files } = await supabase
    .from('files')
    .select('*')
    .eq('repo_id', repoData.id);

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files found' }, { status: 404 });
  }

  const references: Array<{
    path: string;
    line: number;
    context: string;
    isDefinition: boolean;
  }> = [];

  // Build regex for the symbol
  // Match word boundaries to avoid partial matches
  const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'g');

  // First, find the definition(s)
  const { data: definitions } = await supabase
    .from('symbols')
    .select('*')
    .eq('repo_id', repoData.id)
    .eq('name', symbol);

  const definitionPaths = new Set(definitions?.map(d => {
    const f = files.find(file => file.id === d.file_id);
    return f?.path;
  }) || []);

  // Search through all files for references
  for (const fileData of files) {
    // Skip if filtering by file
    if (file && fileData.path !== file) continue;

    const lines = fileData.content.split('\n');
    const fileMatches: Array<{ line: number; context: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.match(symbolRegex);

      if (matches) {
        fileMatches.push({
          line: i + 1,
          context: line.trim(),
        });
      }
    }

    // Add references from this file
    for (const match of fileMatches) {
      references.push({
        path: fileData.path,
        line: match.line,
        context: match.context,
        isDefinition: definitionPaths.has(fileData.path),
      });
    }
  }

  // Sort by path and line number
  references.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.line - b.line;
  });

  // Group by file for cleaner output
  const byFile: Record<string, Array<{ line: number; context: string; isDefinition: boolean }>> = {};
  for (const ref of references) {
    if (!byFile[ref.path]) {
      byFile[ref.path] = [];
    }
    byFile[ref.path].push({
      line: ref.line,
      context: ref.context,
      isDefinition: ref.isDefinition,
    });
  }

  const response = {
    symbol,
    repository: `${repo.owner}/${repo.name}`,
    summary: {
      totalReferences: references.length,
      filesAffected: Object.keys(byFile).length,
      definitionLocations: definitions?.length || 0,
    },
    byFile,
    allReferences: references.slice(0, 500), // Limit to 500 references
  };

  return NextResponse.json({
    _meta: {
      total_tokens: Math.ceil(JSON.stringify(response).length / 4),
      truncated: references.length > 500,
      hint: references.length > 500 ? `Total ${references.length} references found. Showing first 500.` : undefined,
    },
    data: response,
  });
}
