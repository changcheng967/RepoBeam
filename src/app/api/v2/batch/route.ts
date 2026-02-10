import { NextRequest, NextResponse } from 'next/server';
import { supabase, createResponse, estimateTokens } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam, DEFAULT_MAX_TOKENS } from '@/lib/api';
import { extractLineRange } from '@/lib/parser';

export const dynamic = 'force-dynamic';

// Batch request interface
interface BatchRequest {
  repo: string;
  requests: Array<{
    path: string;
    startLine?: number;
    endLine?: number;
  }>;
  maxTokens?: number;
}

// Batch response interface
interface BatchResponse {
  results: Array<{
    path: string;
    content: string;
    language: string;
    lineCount: number;
    startLine: number;
    endLine: number;
    error?: string;
  }>;
  totalTokens: number;
}

// POST /api/v2/batch - Get multiple file snippets in one request
export async function POST(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  try {
    const body: BatchRequest = await request.json();
    const { repo: repoParam, requests, maxTokens = DEFAULT_MAX_TOKENS } = body;

    // Validate repo
    const repo = parseRepoParam(repoParam);
    if (!repo) {
      return badRequest('Invalid repo parameter');
    }

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return badRequest('requests must be a non-empty array');
    }

    if (requests.length > 20) {
      return badRequest('Maximum 20 requests per batch');
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

    const results: BatchResponse['results'] = [];
    let totalUsedTokens = 0;

    for (const req of requests) {
      if (!req.path) {
        results.push({
          path: req.path || '(unknown)',
          content: '',
          language: 'unknown',
          lineCount: 0,
          startLine: 0,
          endLine: 0,
          error: 'path is required',
        });
        continue;
      }

      try {
        // Get file
        const { data: file } = await supabase
          .from('files')
          .select('*')
          .eq('repo_id', repoData.id)
          .eq('path', req.path)
          .single();

        if (!file) {
          results.push({
            path: req.path,
            content: '',
            language: 'unknown',
            lineCount: 0,
            startLine: 0,
            endLine: 0,
            error: 'File not found',
          });
          continue;
        }

        let content = file.content;
        let startLine = 1;
        let endLine = file.line_count;

        // Handle line range
        if (req.startLine && req.endLine) {
          content = extractLineRange(file.content, req.startLine, req.endLine);
          startLine = req.startLine;
          endLine = req.endLine;
        } else if (req.startLine) {
          const lineEnd = Math.min(req.startLine + 100, file.line_count);
          content = extractLineRange(file.content, req.startLine, lineEnd);
          startLine = req.startLine;
          endLine = lineEnd;
        }

        const contentTokens = estimateTokens(content);

        // Check token budget
        if (totalUsedTokens + contentTokens > maxTokens) {
          results.push({
            path: req.path,
            content: '',
            language: file.language,
            lineCount: 0,
            startLine: 0,
            endLine: 0,
            error: `Skipped: token budget exceeded (${totalUsedTokens + contentTokens} > ${maxTokens})`,
          });
          continue;
        }

        totalUsedTokens += contentTokens;

        results.push({
          path: req.path,
          content,
          language: file.language,
          lineCount: content.split('\n').length,
          startLine,
          endLine,
        });
      } catch (error) {
        results.push({
          path: req.path,
          content: '',
          language: 'unknown',
          lineCount: 0,
          startLine: 0,
          endLine: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const response: BatchResponse = {
      results,
      totalTokens: totalUsedTokens,
    };

    return NextResponse.json(createResponse(response, estimateTokens(JSON.stringify(response))));
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

// GET /api/v2/batch?repo=owner/name&paths=path1,path2,path3
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const pathsParam = searchParams.get('paths');
  const maxTokens = parseInt(searchParams.get('maxTokens') || '') || DEFAULT_MAX_TOKENS;

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  if (!pathsParam) {
    return badRequest('paths parameter is required (comma-separated)');
  }

  const paths = pathsParam.split(',').map(p => p.trim());

  // Convert to POST-style body and process
  const mockRequest = {
    json: async () => ({
      repo: repoParam,
      requests: paths.map(path => ({ path })),
      maxTokens,
    }),
  } as unknown as NextRequest;

  return POST(mockRequest);
}
