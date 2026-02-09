import { NextResponse } from 'next/server';

// NO AUTH REQUIRED - This is the LLM landing page
export const dynamic = 'force-dynamic';

export async function GET() {
  const help = `
================================================================================
Luminex Code API - LLM-Friendly Code Access
================================================================================

This API provides line-based code access for the Luminex ML inference framework.
All endpoints are PUBLIC - no authentication required.
Designed for LLMs that can only access content via URL/fetch.

All responses include token counts and line numbers for efficient navigation.

================================================================================
QUICK START FOR LLMS
================================================================================

IMPORTANT: No API key needed! All endpoints are publicly accessible.

1. GET FILE CONTENT:
   GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp
   Response: Full file content with line numbers and token count

2. SEARCH CODE:
   GET /api/search?repo=changcheng967/Luminex&q=evaluate
   Response: Matching files with line snippets and context

3. GET FILE TREE:
   GET /api/tree?repo=changcheng967/Luminex
   Response: Complete file tree with token counts per file

4. GET LINE RANGE (Token Efficient):
   GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&startLine=100&endLine=150
   Response: Lines 100-150 only (saves tokens!)

5. GET RAW CODE (Plain Text):
   GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&raw=true
   Response: Plain text code (no JSON wrapper)

6. GET STATS:
   GET /api/stats?repo=changcheng967/Luminex
   Response: Repository overview with file counts, sizes

================================================================================
CORE ENDPOINTS
================================================================================

FILE ACCESS
-----------

GET /api/file
  Description: Get file content with line-based navigation
  Auth: NONE - Public endpoint
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)
    - path: File path (required)
    - startLine: Start at line N (1-indexed)
    - endLine: End at line N
    - maxTokens: Override default token limit (default: 8000)
    - raw: "true" returns plain text instead of JSON

  JSON Response:
    {
      "_meta": {
        "total_tokens": 1234,
        "truncated": false
      },
      "data": {
        "content": "full file content",
        "language": "cpp",
        "lineCount": 1699,
        "startLine": 1,
        "endLine": 1699,
        "path": "src/evaluation.cpp"
      }
    }

  Examples:
    - Get entire file:
      /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp

    - Get lines 100-200 (token efficient):
      /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&startLine=100&endLine=200

    - Get as plain text (no JSON wrapper):
      /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&raw=true

    - Get specific function (lines 815-835):
      /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&startLine=815&endLine=835


GET /api/tree
  Description: Get complete file tree with metadata
  Auth: NONE - Public endpoint
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)

  Response:
    {
      "_meta": { "total_tokens": 456 },
      "data": {
        "files": [
          {
            "path": "src/evaluation.cpp",
            "language": "cpp",
            "tokenCount": 67752,
            "lineCount": 1699
          },
          ...
        ],
        "repo": {
          "name": "changcheng967/Luminex",
          "lastSyncedAt": "2025-02-09T12:00:00Z",
          "fileCount": 42
        }
      }
    }


SEARCH
------

GET /api/search
  Description: Full-text code search with line context
  Auth: NONE - Public endpoint
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)
    - q: Search query (required) - case-insensitive substring match
    - filePattern: Filter by file pattern, e.g., "*.cpp" (optional)
    - maxResults: Limit results (default: 20)

  Response:
    {
      "_meta": { "total_tokens": 234 },
      "data": [
        {
          "path": "src/evaluation.cpp",
          "line": 148,
          "snippet": "int king_danger_zone(Square s, const Bitboard& occupied) {..."
        },
        ...
      ]
    }

  Examples:
    - Search for function name:
      /api/search?repo=changcheng967/Luminex&q=evaluate_pawn_shield

    - Search in C++ files only:
      /api/search?repo=changcheng967/Luminex&q=Bitboard&filePattern=*.cpp

    - Search for variable:
      /api/search?repo=changcheng967/Luminex&q=PST[PIECE_TYPE]


GET /api/search/regex
  Description: Regex-powered code search
  Auth: NONE - Public endpoint
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)
    - q: Regex pattern (URL-encoded)
    - filePattern: Filter by file pattern (optional)

  Examples:
    - Find all class definitions:
      /api/search/regex?repo=changcheng967/Luminex&q=class\\s+\\w+

    - Find function declarations:
      /api/search/regex?repo=changcheng967/Luminex&q=^\\s*\\w+\\s+\\w+\\s*\\([^)]*\\)\\s*\\{


STATISTICS
----------

GET /api/stats
  Description: Repository statistics and overview
  Auth: NONE - Public endpoint
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)

  Response:
    {
      "_meta": { "total_tokens": 567 },
      "data": {
        "repository": {
          "name": "changcheng967/Luminex",
          "description": "High-performance ML inference framework",
          "language": "C++",
          "lastSyncedAt": "2025-02-09T12:00:00Z"
        },
        "overview": {
          "totalFiles": 42,
          "totalLines": 15678,
          "totalTokens": 62712
        },
        "byLanguage": {
          "cpp": { "files": 28, "lines": 12345, "tokens": 49380 },
          "h": { "files": 10, "lines": 2345, "tokens": 9380 },
          "py": { "files": 4, "lines": 988, "tokens": 3952 }
        },
        "largestFiles": [
          { "path": "src/evaluation.cpp", "lines": 1699, "tokens": 67752 },
          ...
        ]
      }
    }


GET /api/sync
  Description: Repository sync status
  Auth: NONE - Public endpoint
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)

  Response:
    {
      "_meta": { "total_tokens": 123 },
      "data": {
        "currentlySyncing": false,
        "filesIndexed": 42,
        "repo": {
          "last_synced_at": "2025-02-09T12:00:00Z",
          "last_sha": "abc123def456"
        }
      }
    }


================================================================================
RESPONSE FORMAT
================================================================================

All JSON responses follow this envelope:

{
  "_meta": {
    "total_tokens": 1234,
    "truncated": false,
    "hint": "Optional message if truncated"
  },
  "data": { ... }
}

Token estimation: Math.ceil(text.length / 4)

For large files (>8000 tokens), responses are truncated with:
  "_meta.truncated": true
  "_meta.hint": "Use ?startLine=X&endLine=Y to fetch more"

Use ?raw=true to get plain text without JSON wrapper.


================================================================================
LLM INTEGRATION GUIDE
================================================================================

RECOMMENDED WORKFLOW:
----------------------

1. EXPLORATION - User asks about a topic:
   GET /api/search?repo=changcheng967/Luminex&q=search_term
   -> Returns matching files with line numbers

2. TARGETED FETCH - Get specific code:
   GET /api/file?repo=...&path=...&startLine=X&endLine=Y
   -> Returns only the requested lines (token efficient)

3. FULL CONTEXT (if needed):
   GET /api/file?repo=...&path=...&startLine=1&endLine=100
   -> Get beginning of file for includes/imports

4. BROWSE STRUCTURE:
   GET /api/tree?repo=changcheng967/Luminex
   -> See all files with sizes


TOKEN BUDGET MANAGEMENT:
------------------------

- Always check _meta.total_tokens before processing
- For large files, request specific line ranges
- Use search to find relevant files first
- Then fetch targeted line ranges (±10 lines for context)
- Use ?raw=true to save JSON wrapper tokens


EXAMPLE CONVERSATION FLOWS:
---------------------------

User: "Show me the evaluate_pawn_shield function"

LLM Steps:
1. GET /api/search?repo=changcheng967/Luminex&q=evaluate_pawn_shield
   Response: Found in src/evaluation.cpp, line 823

2. GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&startLine=815&endLine=875
   Response: Got function with surrounding context

3. Analyze and explain the function

---

User: "How does the king danger zone evaluation work?"

LLM Steps:
1. GET /api/search?repo=changcheng967/Luminex&q=king_danger_zone
   Response: Found in src/evaluation.cpp, line 148

2. GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&startLine=140&endLine=200
   Response: Got full implementation with context

3. Explain the logic and algorithm

---

User: "What files are in the src directory?"

LLM Steps:
1. GET /api/tree?repo=changcheng967/Luminex
   Response: Full file list

2. Filter and present src/ files

---

User: "Find all Bitboard-related functions"

LLM Steps:
1. GET /api/search/regex?repo=changcheng967/Luminex&q=Bitboard.*\\(
   Response: All function declarations with Bitboard

2. Present categorized results


================================================================================
LINE-BASED NAVIGATION
================================================================================

The API is optimized for line-based code access. Use line numbers to navigate:

1. Search finds the exact line number
2. Request line ranges around the target
3. Include context lines (±5-10) for understanding

Example pattern:
- Search finds: line 823
- Request: startLine=815, endLine=835 (5 lines before, 12 after)
- Result: Function plus surrounding context


CONTEXT WINDOWS:
---------------

For different purposes:
- Function signature: ±5 lines
- Full function: ±20-50 lines
- Class definition: ±30 lines
- Understanding algorithm: ±50-100 lines


WEB VIEWER URL FRAGMENTS:
-------------------------

When linking to code in the web viewer, use hash fragments:
  /repo/changcheng967/Luminex/src/evaluation.cpp#150
  /repo/changcheng967/Luminex/src/evaluation.cpp#150-200

This scrolls to and highlights the specified lines.


================================================================================
ERROR HANDLING
================================================================================

All errors return JSON:
{"error": "Error message"}

Common errors:
- 400: Invalid parameters (missing required fields)
- 404: File or repository not found
- 500: Server error

Check the error message for specific guidance.


================================================================================
PERFORMANCE NOTES
================================================================================

- No authentication overhead - instant access
- Line range requests are very fast (<100ms)
- File tree is cached
- Only changed files are re-synced (SHA-based incremental sync)
- Database optimized for full-text search
- Auto-indexing happens on first request


================================================================================
FOR LLMS WITHOUT HEADERS
================================================================================

Some LLMs can only do GET requests without custom headers.
This API is designed for that use case:

- NO Authorization header needed
- NO custom headers required
- Everything works via URL parameters only
- Perfect for web crawlers and simple fetch() calls


EXAMPLE: Simple Python request
    import requests
    url = "https://your-domain.com/api/file"
    params = {
        "repo": "changcheng967/Luminex",
        "path": "src/evaluation.cpp",
        "startLine": "100",
        "endLine": "200"
    }
    response = requests.get(url, params=params)
    print(response.json())


EXAMPLE: Simple curl request
    curl "https://your-domain.com/api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&startLine=100&endLine=200"


================================================================================
VERSION
================================================================================

API Version: v2 (Public Access)
Repository: Luminex - High-performance ML inference framework
Owner: changcheng967
Last Updated: 2025-02

All endpoints are PUBLIC - no authentication required.

================================================================================
`;

  return new NextResponse(help, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
