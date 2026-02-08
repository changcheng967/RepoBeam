import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const HELP_TEXT = `
# RepoBeam API

RepoBeam is an LLM-friendly code browsing platform. This API serves GitHub code
in smart, LLM-sized chunks with token metadata.

## Authentication

All endpoints (except /api/help) require:
  Authorization: Bearer <API_KEY>

## Response Format

Every JSON response wraps in:
{
  "_meta": { "total_tokens": <number>, "truncated": <boolean>, "hint": <string|undefined> },
  "data": <actual response data>
}

Add ?raw=true to any endpoint to return plain text instead of JSON.

## Endpoints

### /api/help
GET /api/help
  NO AUTH REQUIRED
  Returns this help text as plain/text.

### /api/repos
GET /api/repos
  List all indexed repositories with stats.

POST /api/repos
  Add a new repository and trigger initial index.
  Body: { "owner": string, "name": string }

DELETE /api/repos/[id]
  Remove a repository and all its files.

POST /api/repos/[id]/sync
  Manually trigger a re-sync of a repository.

### /api/tree
GET /api/tree?repo=owner/name
  Get file tree for a repository.
  Returns: Array of { path, language, tokenCount, lineCount }

### /api/file
GET /api/file?repo=owner/name&path=path/to/file
  Get file content. Auto-truncates at 8000 tokens.

  Query params:
    - repo: Repository (owner/name)
    - path: File path
    - startLine: Start line number (1-indexed)
    - endLine: End line number
    - function: Extract function by name
    - maxTokens: Maximum tokens (default: 8000)
    - raw: Return plain text instead of JSON
    - fresh: Bypass cache

  Returns: { content: string, language: string, lineCount, startLine, endLine }

### /api/symbols
GET /api/symbols?repo=owner/name&path=path/to/file
  List all symbols in a file.
  Returns: Array of { name, kind, startLine, endLine, tokenCount, signature }

### /api/function
GET /api/function?repo=owner/name&path=path/to/file&name=functionName
  Get a single function by name.

  Query params:
    - repo: Repository (owner/name)
    - path: File path
    - name: Function/symbol name
    - context: Add 5 lines before/after (default: false)

  Returns: { name, kind, content, startLine, endLine }

### /api/symbols/search
GET /api/symbols/search?repo=owner/name&q=searchTerm
  Fuzzy search for symbols across all files.

  Query params:
    - repo: Repository (owner/name)
    - q: Search query
    - kind: Filter by symbol kind (optional)
    - limit: Max results (default: 50)

### /api/search
GET /api/search?repo=owner/name&q=searchTerm
  Full-text search with snippets.

  Query params:
    - repo: Repository (owner/name)
    - q: Search query
    - filePattern: Filter by file pattern (optional)
    - maxResults: Max results (default: 20)

  Returns: Array of { path, line, snippet, symbol }

### /api/search/regex
GET /api/search/regex?repo=owner/name&q=regex_pattern
  Regex search in code.

### /api/diff
GET /api/diff?repo=owner/name&since=sha
  Get changed files since a commit.

### /api/diff/function
GET /api/diff/function?repo=owner/name&path=...&name=...&since=sha
  Get before/after of a function.

### /api/context
GET /api/context?repo=owner/name&path=...&name=...
  Smart context: function + referenced types + called function signatures.
  Budget: 10K tokens.

## Tips for LLMs

1. Always check total_tokens in _meta. If truncated=true, follow the hint.
2. Use /api/symbols first to discover structure, then fetch specific functions.
3. For large files, use startLine/endLine or function parameter.
4. Search across files with /api/search or /api/symbols/search.
5. Use ?raw=true for direct text inclusion in responses.

## Token Estimation

Tokens are estimated as: Math.ceil(text.length / 4)

## Made with Claude Code
https://claude.com/claude-code
`;

export async function GET() {
  return new NextResponse(HELP_TEXT.trim(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
