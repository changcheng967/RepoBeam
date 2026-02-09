import { NextResponse } from 'next/server';

// NO AUTH REQUIRED - This is the LLM landing page
export const dynamic = 'force-dynamic';

export async function GET() {
  const help = `
================================================================================
Luminex Code API - LLM-Friendly Code Access
================================================================================

This API provides line-based code access for the Luminex ML inference framework.
All responses include token counts and line numbers for efficient navigation.

Authentication: Add "Authorization: Bearer <API_KEY>" header

================================================================================
QUICK START FOR LLMS
================================================================================

1. GET FILE CONTENT:
   GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp
   Response: Full file content with line numbers and token count

2. SEARCH CODE:
   GET /api/search?repo=changcheng967/Luminex&q=evaluate
   Response: Matching files with line snippets and context

3. GET FILE TREE:
   GET /api/tree?repo=changcheng967/Luminex
   Response: Complete file tree with token counts

4. GET LINE RANGE:
   GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&startLine=100&endLine=150
   Response: Lines 100-150 only (token-efficient)

5. FULL-TEXT SEARCH:
   GET /api/search?repo=changcheng967/Luminex&q=king_danger_zone&filePattern=*.cpp
   Response: All matches with line context

================================================================================
CORE ENDPOINTS
================================================================================

FILE ACCESS
-----------

GET /api/file
  Description: Get file content with line-based navigation
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)
    - path: File path (required)
    - startLine: Start at line N (1-indexed)
    - endLine: End at line N
    - maxTokens: Override default token limit
    - raw: Return plain text instead of JSON
  Response:
    {
      "data": {
        "content": "full file content",
        "language": "cpp",
        "lineCount": 1699,
        "tokenCount": 67752,
        "path": "src/evaluation.cpp"
      }
    }

  Examples:
    - Get entire file: ?repo=changcheng967/Luminex&path=src/evaluation.cpp
    - Get lines 100-200: ?repo=...&path=...&startLine=100&endLine=200
    - Get as plain text: ?repo=...&path=...&raw=true


GET /api/tree
  Description: Get complete file tree
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)
  Response:
    {
      "data": {
        "files": [
          {"path": "src/evaluation.cpp", "sha": "abc123", "size": 12345},
          ...
        ]
      }
    }


SEARCH
------

GET /api/search
  Description: Full-text code search with line context
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)
    - q: Search query (required)
    - filePattern: Filter by file pattern (optional)
    - maxResults: Limit results (default 50)
  Response:
    {
      "data": [
        {"path": "src/evaluation.cpp", "line": 148, "snippet": "int evaluate() { ... }"},
        ...
      ]
    }

  Example: Search for "evaluate_pawn_shield"
    GET /api/search?repo=changcheng967/Luminex&q=evaluate_pawn_shield


GET /api/search/regex
  Description: Regex search
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)
    - q: Regex pattern (URL-encoded)
    - filePattern: Filter by file pattern (optional)
  Response: Matching lines with file paths


REPOSITORY
----------

GET /api/sync
  Description: Get repository sync status
  Query Parameters:
    - repo: "changcheng967/Luminex"
  Response:
    {
      "data": {
        "currentlySyncing": false,
        "filesIndexed": 16,
        "repo": {
          "last_synced_at": "2025-02-09T12:00:00Z",
          "last_sha": "abc123"
        }
      }
    }

POST /api/sync
  Description: Trigger repository sync
  Query Parameters:
    - repo: "changcheng967/Luminex"
    - force: true to re-index all files
  Method: POST


GET /api/stats
  Description: Get repository statistics
  Query Parameters:
    - repo: "changcheng967/Luminex"
  Response:
    {
      "data": {
        "repository": {...},
        "overview": {
          "totalFiles": 16,
          "totalLines": 12345,
          "totalTokens": 67890
        },
        "byLanguage": {...},
        "largestFiles": [...]
      }
    }


================================================================================
RESPONSE FORMAT
================================================================================

All JSON responses follow this envelope:

{
  "_meta": {
    "total_tokens": 1234,
    "truncated": false
  },
  "data": { ... }
}

Token estimation: Math.ceil(text.length / 4)

For large files (>8000 tokens), responses are truncated with:
  "_meta.truncated": true
  "_meta.hint": "Use ?startLine=X&endLine=Y to fetch more"

================================================================================
LLM INTEGRATION GUIDE
================================================================================

RECOMMENDED WORKFLOW:
----------------------

1. User asks about a file:
   GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp

   If truncated:
   GET /api/file?repo=...&path=...&startLine=801&endLine=1200

2. User asks about a function:
   GET /api/search?repo=changcheng967/Luminex&q=function_name

   Then get the file and jump to the line:
   GET /api/file?repo=...&path=...&startLine=X&endLine=Y

3. User asks about code patterns:
   GET /api/search/regex?repo=changcheng967/Luminex&q=class\\s+\\w+

TOKEN BUDGET MANAGEMENT:
------------------------

- Always check _meta.total_tokens before processing
- For large files, request specific line ranges
- Use search to find relevant files first
- Then fetch targeted line ranges


EXAMPLE CONVERSATION FLOW:
--------------------------

User: "Show me the evaluate_pawn_shield function"

LLM Steps:
1. GET /api/search?repo=changcheng967/Luminex&q=evaluate_pawn_shield
   -> Found in src/evaluation.cpp, line 823

2. GET /api/file?repo=...&path=src/evaluation.cpp&startLine=820&endLine=920
   -> Got function with context

3. Explain the function


User: "How does the king danger zone evaluation work?"

LLM Steps:
1. GET /api/search?repo=changcheng967/Luminex&q=king_danger_zone
   -> Found in src/evaluation.cpp, line 148

2. GET /api/file?repo=...&path=src/evaluation.cpp&startLine=145&endLine=180
   -> Got function implementation

3. Explain the logic


================================================================================
LINE-BASED NAVIGATION
================================================================================

The API is optimized for line-based code access. Instead of symbols,
use line numbers to navigate code:

1. Search finds the exact line number
2. Request line ranges around the target
3. Always include context lines (±5-10)

Example pattern:
- Search finds: line 823
- Request: startLine=815, endLine=835 (5 lines before, 12 after)
- This gives you the function plus surrounding context


JUMP TO LINE:
-----------

When linking to code, use URL fragments:
  /repo/changcheng967/Luminex/src/evaluation.cpp#150

This scrolls to and highlights line 150 in the web viewer.


================================================================================
ERROR HANDLING
================================================================================

All errors return JSON:
{"error": "Error message"}

Common errors:
- 401: Missing or invalid API key
- 404: File not found
- 400: Invalid parameters
- 500: Server error

Check the error message for specific guidance.


================================================================================
RATE LIMITS
================================================================================

- No rate limiting for personal use
- Line range requests are very fast
- File tree is cached
- Only changed files are re-synced (SHA-based)


================================================================================
VERSION
================================================================================

API Version: v1
Repository: Luminex - High-performance ML inference framework
Last Updated: 2025-02

================================================================================
`;

  return new NextResponse(help, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
