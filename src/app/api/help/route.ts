import { NextResponse } from 'next/server';

// NO AUTH REQUIRED - This is the LLM landing page
export const dynamic = 'force-dynamic';

export async function GET() {
  const help = `
================================================================================
Repobeam API - LLM-Friendly Code Access Platform
================================================================================

REPOBEAM IS NOW OPEN FOR PUBLIC USE! Add any GitHub repository.

Authentication: Add "Authorization: Bearer <API_KEY>" header to all requests.
Get your API key by signing up at Repobeam or host your own instance.

================================================================================
QUICK START FOR LLMS
================================================================================

1. ADD A REPO:
   POST /api/repos
   Body: {"owner": "changcheng967", "name": "Luminex"}
   Response: Repo metadata with initial sync status

2. GET FILE CONTENT:
   GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp
   Response: File content with line numbers and metadata
   Auto-truncates at 8000 tokens - see "hints" for getting more

3. LIST SYMBOLS:
   GET /api/symbols?repo=changcheng967/Luminex&path=src/evaluation.cpp
   Response: All functions, classes, structs with line ranges and token counts

4. GET SINGLE FUNCTION:
   GET /api/function?repo=changcheng967/Luminex&path=src/evaluation.cpp&name=evaluate_pawn_shield
   Response: Just that function's code with metadata

5. SEARCH CODE:
   GET /api/search?repo=changcheng967/Luminex&q=evaluate
   Response: Matching files with line snippets (5 lines context)

================================================================================
CORE ENDPOINTS
================================================================================

REPOSITORY MANAGEMENT
---------------------

POST /api/repos
  Description: Add a GitHub repository to index
  Body: {"owner": string, "name": string}
  Response: {"data": {"id": number, "full_name": string, "status": "syncing"}}
  Note: Triggers background sync - use GET /api/sync to check progress

GET /api/repos
  Description: List all indexed repositories
  Response: Array of repo objects with stats (file count, last synced)

DELETE /api/repos/{id}
  Description: Remove a repository and all its data

POST /api/repos/{id}/sync
  Description: Trigger manual re-sync
  Query: ?force=true to re-index all files

GET /api/sync?repo=owner/name
  Description: Get sync status
  Response: Sync progress, file counts, errors


FILE BROWSING
-------------

GET /api/tree?repo=owner/name
  Description: Get complete file tree
  Response: {"data": {"files": [{"path": string, "sha": string, "size": number}]}}
  Includes: All files with SHAs for change detection

GET /api/file?repo=owner/name&path=...
  Description: Get file content
  Query Params:
    - path: File path (required)
    - startLine: Start at line N (1-indexed)
    - endLine: End at line N
    - maxTokens: Override default 8000 token limit
    - raw: Return plain text instead of JSON
  Response:
    {"data": {
      "content": string,
      "language": string,
      "lineCount": number,
      "startLine": number,
      "endLine": number,
      "path": string
    }}
  Truncation: If content exceeds maxTokens, response includes:
    {"_meta": {"truncated": true, "hint": "Add ?startLine=801&endLine=1600"}}


SYMBOL NAVIGATION (THE KILLER FEATURE)
----------------------------------------

GET /api/symbols?repo=owner/name&path=...
  Description: List all symbols in a file
  Response:
    {"data": [
      {"name": "function_name", "kind": "function", "startLine": 10, "endLine": 50,
       "tokenCount": 123, "signature": "void function_name(int x)"},
      ...
    ]}
  Kinds: function, class, struct, interface, type, enum, method

GET /api/function?repo=owner/name&path=...&name=...
  Description: Get a single symbol's code
  Query Params:
    - path: File path
    - name: Symbol name
    - context: Add 5 lines before/after (true/false)
  Response: Just that symbol's code with metadata

GET /api/symbols/search?repo=owner/name&q=...
  Description: Fuzzy search for symbols across all files
  Query Params:
    - q: Search query (symbol name)
    - kind: Filter by kind (optional)
  Response: Matching symbols with file paths and line ranges

GET /api/symbols/extract?repo=owner/name&path=...
  Description: Extract symbols for a file (runs LLM if not cached)
  Method: POST
  Response: Extracted symbols


SEARCH
------

GET /api/search?repo=owner/name&q=...
  Description: Full-text code search with snippets
  Query Params:
    - q: Search query
    - filePattern: Filter by file pattern (e.g., "*.cpp")
    - maxResults: Limit results (default 50)
  Response:
    {"data": [
      {"file": "src/file.cpp", "line": 42, "snippet": "..."},
      ...
    ]}

GET /api/search/regex?repo=owner/name&q=...
  Description: Regex search (pattern must be URL-encoded)
  Query Params:
    - q: Regex pattern
    - filePattern: Filter by file pattern (optional)


ADVANCED FEATURES
-----------------

GET /api/context?repo=owner/name&path=...&name=...
  Description: Smart context - function + called functions + referenced types
  Budget: 10,000 tokens, prioritizes by relevance
  Response: Multiple code blocks with context labels

GET /api/outline?repo=owner/name&path=...
  Description: Get file structure without content
  Response: Symbol hierarchy with nesting

GET /api/dependencies?repo=owner/name&path=...
  Description: Get file imports/dependencies
  Response: List of imported files/modules

GET /api/references?repo=owner/name&path=...&symbol=...
  Description: Find where a symbol is used (NEW!)
  Response: Files and line numbers where symbol is referenced


DIFF & CHANGE TRACKING
----------------------

GET /api/diff?repo=owner/name&since=sha
  Description: Get changed files since a commit
  Response: List of changed files with change type (added/modified/deleted)

GET /api/diff/function?repo=owner/name&path=...&name=...&since=sha
  Description: Before/after of a specific function
  Response: Old and new versions of the function


================================================================================
RESPONSE FORMAT
================================================================================

All JSON responses follow this envelope:

{
  "_meta": {
    "total_tokens": number,
    "truncated": boolean,
    "hint": string (only if truncated)
  },
  "data": actual_response_data
}

Token estimation: Math.ceil(text.length / 4)

Raw text responses: Add ?raw=true to any endpoint


================================================================================
INTEGRATION GUIDE FOR LLMS
================================================================================

RECOMMENDED WORKFLOW:
--------------------

1. User mentions a repository:
   -> POST /api/repos to add it
   -> Poll GET /api/sync?repo=owner/name until synced=true

2. User asks about a file:
   -> GET /api/symbols?repo=owner/name&path=...
   -> Show symbol list with line ranges and token counts
   -> User picks symbol -> GET /api/function with symbol name

3. User searches for code:
   -> GET /api/search?repo=owner/name&q=query
   -> Show results with snippets
   -> User picks result -> GET /api/file for full context

4. Symbol usage questions:
   -> GET /api/references?repo=...&symbol=name
   -> Show all usages across files

5. Understanding code structure:
   -> GET /api/outline?repo=...&path=...
   -> Show file structure without fetching full content

TOKEN BUDGET MANAGEMENT:
------------------------

- Always check _meta.total_tokens before processing
- If truncated=true, use the hint to fetch remaining content
- Use /api/function instead of /api/file for large files
- Use /api/context for smart multi-file context


EXAMPLE CONVERSATION FLOW:
--------------------------

User: "What does the evaluate_pawn_shield function do?"

LLM Steps:
1. GET /api/symbols/search?repo=changcheng967/Luminex&q=evaluate_pawn_shield
   -> Found in src/evaluation.cpp, lines 823-915, 148 tokens
2. GET /api/function?repo=...&path=src/evaluation.cpp&name=evaluate_pawn_shield
   -> Got function code
3. Explain the function


User: "Where is Evaluation class used?"

LLM Steps:
1. GET /api/references?repo=...&symbol=Evaluation
   -> Found in 12 files
2. GET /api/symbols for each file to get context
3. Explain usage patterns


================================================================================
ERROR HANDLING
================================================================================

All errors return JSON:
{"error": "Error message"}

Common errors:
- 401: Missing or invalid API key
- 404: Repository or file not found
- 400: Invalid parameters (check error message)
- 429: Rate limited (add delay between requests)
- 500: Server error (try again or contact support)

For truncation:
- Check _meta.truncated
- Use _meta.hint for next request


================================================================================
RATE LIMITS & BEST PRACTICES
================================================================================

- Symbol extraction is cached - subsequent requests are instant
- Use symbol endpoints before fetching full files
- Batch requests when possible
- Respect rate limits - add 100ms delay between requests
- Use ?raw=true for direct text when not parsing JSON


================================================================================
HOST YOUR OWN
================================================================================

Repobeam is open source! Host your own instance:

1. Clone: https://github.com/your-org/repobeam
2. Set env vars: SUPABASE_URL, SUPABASE_KEY, GITHUB_TOKEN, NIM_API_KEY
3. Deploy to Vercel/Railway/etc

Full setup guide: https://github.com/your-org/repobeam#setup


================================================================================
VERSION & SUPPORT
================================================================================

API Version: v1
Last Updated: 2025-02
Documentation: https://docs.repobeam.com
Support: support@repobeam.com
GitHub: https://github.com/your-org/repobeam

================================================================================
`;

  return new NextResponse(help, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
