import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Import patterns for different languages
const IMPORT_PATTERNS: Record<string, RegExp[]> = {
  cpp: [
    /^#include\s*[<"]([^>"]+)[>"]/,
    /^import\s+([^;]+);/,
    /^using\s+namespace\s+(\w+);/,
  ],
  c: [
    /^#include\s*[<"]([^>"]+)[>"]/,
  ],
  python: [
    /^import\s+(\w+)/,
    /^from\s+(\w+)\s+import/,
  ],
  javascript: [
    /^import\s+.*?from\s+['"]([^'"]+)['"]/,
    /^require\(['"]([^'"]+)['"]\)/,
  ],
  typescript: [
    /^import\s+.*?from\s+['"]([^'"]+)['"]/,
    /^import\s+{.*?}\s+from\s+['"]([^'"]+)['"]/,
  ],
  tsx: [
    /^import\s+.*?from\s+['"]([^'"]+)['"]/,
    /^import\s+{.*?}\s+from\s+['"]([^'"]+)['"]/,
  ],
  jsx: [
    /^import\s+.*?from\s+['"]([^'"]+)['"]/,
  ],
  go: [
    /^import\s+['"]([^'"]+)['"]/,
  ],
  rust: [
    /^use\s+([^;]+);/,
    /^mod\s+(\w+);/,
  ],
  java: [
    /^import\s+([^;]+);/,
    /^package\s+([^;]+);/,
  ],
};

function extractImports(content: string, language: string): string[] {
  const patterns = IMPORT_PATTERNS[language.toLowerCase()] || IMPORT_PATTERNS.cpp;
  const imports = new Set<string>();
  const lines = content.split('\n');

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.trim().match(pattern);
      if (match) {
        imports.add(match[1]);
      }
    }
  }

  return Array.from(imports);
}

// GET /api/dependencies?repo=owner/name&path=...
// Get file imports/dependencies
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

  // Extract imports
  const imports = extractImports(file.content, file.language || '');

  // Find which imports are local (in this repo) vs external
  const localImports: string[] = [];
  const externalImports: string[] = [];

  for (const imp of imports) {
    // Check if it's a relative path or looks like a local import
    if (imp.startsWith('.') || imp.startsWith('..') || imp.startsWith('/')) {
      localImports.push(imp);
    } else if (!imp.includes('.') && !imp.includes('/')) {
      // Might be local - check if a file exists
      localImports.push(imp);
    } else {
      externalImports.push(imp);
    }
  }

  // Find files in repo that match local imports
  const localFiles: string[] = [];
  if (localImports.length > 0) {
    const { data: files } = await supabase
      .from('files')
      .select('path')
      .eq('repo_id', repoData.id);

    if (files) {
      const filePaths = new Set(files.map(f => f.path));
      for (const imp of localImports) {
        // Try to match the import to actual files
        for (const filePath of filePaths) {
          const fileName = filePath.split('/').pop();
          if (fileName === imp || filePath.endsWith(`/${imp}`) || filePath.endsWith(`/${imp}.h`) || filePath.endsWith(`/${imp}.cpp`)) {
            localFiles.push(filePath);
            break;
          }
        }
      }
    }
  }

  const response = {
    file: {
      path: file.path,
      language: file.language,
    },
    dependencies: {
      local: localImports,
      external: externalImports,
      resolvedLocalFiles: localFiles,
    },
    summary: {
      totalImports: imports.length,
      localImportCount: localImports.length,
      externalImportCount: externalImports.length,
    },
  };

  return NextResponse.json({
    _meta: {
      total_tokens: Math.ceil(JSON.stringify(response).length / 4),
      truncated: false,
    },
    data: response,
  });
}
