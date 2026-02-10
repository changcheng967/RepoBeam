import { NextResponse } from 'next/server';

// NO AUTH REQUIRED - This is the LLM landing page
export const dynamic = 'force-dynamic';

export async function GET() {
  const help = `
================================================================================
Luminex Code API v2 - LLM-Friendly Code Access
================================================================================

This API provides line-based code access for the Luminex ML inference framework.
All endpoints are PUBLIC - no authentication required.
Designed for LLMs that can only access content via URL/fetch.

API Version: v2.0
All responses include token counts, line numbers, and enhanced metadata.

================================================================================
QUICK START FOR LLMS
================================================================================

IMPORTANT: No API key needed! All endpoints are publicly accessible.

1. GET FILE CONTENT:
   GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp
   Response: Full file content with line numbers and token count

2. SEARCH CODE (ENHANCED):
   GET /api/search?repo=changcheng967/Luminex&q=evaluate&contextLines=10
   Response: Matching files with configurable context and match count

3. GET FILE TREE:
   GET /api/tree?repo=changcheng967/Luminex
   Response: Complete file tree with token counts per file

4. GET LINE RANGE (Token Efficient):
   GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&startLine=100&endLine=150
   Response: Lines 100-150 only (saves tokens!)

5. BATCH REQUESTS (NEW):
   GET /api/v2/batch?repo=changcheng967/Luminex&paths=file1.cpp,file2.h,file3.cpp
   Response: Multiple files in one request

6. GET STATS (ENHANCED):
   GET /api/stats?repo=changcheng967/Luminex
   Response: Repository overview with file distribution and directories

7. GET RAW CODE (Plain Text):
   GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&raw=true
   Response: Plain text code (no JSON wrapper)

================================================================================
V2 NEW FEATURES
================================================================================

BATCH ENDPOINT
--------------
GET/POST /api/v2/batch
  Description: Get multiple files in a single request
  Use case: When you need content from multiple files efficiently
  Max files: 20 per batch
  Token budget: Respects maxTokens parameter (default 8000)

  GET Example:
    /api/v2/batch?repo=changcheng967/Luminex&paths=src/eval.cpp,src/search.cpp

  POST Example (for line ranges):
    Body: {
      "repo": "changcheng967/Luminex",
      "requests": [
        {"path": "src/eval.cpp", "startLine": 1, "endLine": 100},
        {"path": "src/search.cpp", "startLine": 50, "endLine": 150}
      ],
      "maxTokens": 10000
    }

ENHANCED SEARCH
---------------
GET /api/search (v2 enhancements)
  New Parameters:
    - contextLines: Number of context lines (default: 5)
    - highlight: "true" wraps matches in >>>match<<<
    - maxResults: Maximum results (default: 50)

  Examples:
    - Search with more context:
      /api/search?repo=...&q=Bitboard&contextLines=10

    - Search with highlighted matches:
      /api/search?repo=...&q=evaluate&highlight=true

    - Search in C++ files only:
      /api/search?repo=...&q=class&filePattern=*.cpp

ENHANCED STATS
--------------
GET /api/stats (v2 enhancements)
  New Fields:
    - avgLinesPerFile: Average lines per file
    - avgTokensPerFile: Average tokens per file
    - sizeDistribution: File count by size (tiny, small, medium, large, huge)
    - directories: Top-level directory breakdown
    - byLanguage[].percentage: Percentage of files per language

  New Parameter:
    - verbose: "true" returns all 20 largest files and full file list

  Example:
    /api/stats?repo=changcheng967/Luminex&verbose=true

IMPROVED SYNC
-------------
GET /api/sync (v2 enhancements)
  - Always returns fresh data from database
  - Accurate lastSyncedAt timestamp
  - Real-time file count
  - Proper sync status tracking

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
          "lastSyncedAt": "2025-02-10T12:00:00Z",
          "fileCount": 42
        }
      }
    }


SEARCH (V2 ENHANCED)
--------------------

GET /api/search
  Description: Full-text code search with line context
  Auth: NONE - Public endpoint
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)
    - q: Search query (required) - case-insensitive substring match
    - filePattern: Filter by file pattern, e.g., "*.cpp" (optional)
    - contextLines: Lines of context around match (default: 5)
    - highlight: "true" wraps matches in >>>match<<< (optional)
    - maxResults: Limit results (default: 50)

  Response:
    {
      "_meta": { "total_tokens": 234 },
      "data": {
        "query": "evaluate",
        "contextLines": 5,
        "resultCount": 3,
        "results": [
          {
            "path": "src/evaluation.cpp",
            "line": 148,
            "snippet": "...",
            "contextBefore": 5,
            "contextAfter": 5,
            "matchCount": 2
          }
        ]
      }
    }

  Examples:
    - Search for function name:
      /api/search?repo=changcheng967/Luminex&q=evaluate_pawn_shield

    - Search with more context:
      /api/search?repo=changcheng967/Luminex&q=Bitboard&contextLines=10

    - Search with highlighted matches:
      /api/search?repo=changcheng967/Luminex&q=evaluate&highlight=true

    - Search in C++ files only:
      /api/search?repo=changcheng967/Luminex&q=class&filePattern=*.cpp


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


STATISTICS (V2 ENHANCED)
------------------------

GET /api/stats
  Description: Repository statistics and overview
  Auth: NONE - Public endpoint
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)
    - verbose: "true" for full file list (optional)

  Response:
    {
      "_meta": { "total_tokens": 567 },
      "data": {
        "repository": {
          "name": "changcheng967/Luminex",
          "description": "High-performance ML inference framework",
          "language": "C++",
          "lastSyncedAt": "2025-02-10T12:00:00Z",
          "lastSha": "abc123"
        },
        "overview": {
          "totalFiles": 42,
          "totalLines": 15678,
          "totalTokens": 62712,
          "avgLinesPerFile": 373,
          "avgTokensPerFile": 1493
        },
        "byLanguage": {
          "cpp": { "files": 28, "lines": 12345, "tokens": 49380, "percentage": 67 },
          "h": { "files": 10, "lines": 2345, "tokens": 9380, "percentage": 24 }
        },
        "sizeDistribution": {
          "tiny": 5,    // < 100 lines
          "small": 20,  // 100-500 lines
          "medium": 10, // 500-1000 lines
          "large": 5,   // 1000-5000 lines
          "huge": 2     // > 5000 lines
        },
        "directories": {
          "src": { "files": 30, "tokens": 50000 },
          "include": { "files": 10, "tokens": 5000 },
          "tests": { "files": 2, "tokens": 1000 }
        },
        "largestFiles": [
          { "path": "src/evaluation.cpp", "lines": 1699, "tokens": 67752, "language": "cpp" }
        ]
      }
    }


SYNC STATUS
-----------

GET /api/sync
  Description: Repository sync status (v2: always fresh data)
  Auth: NONE - Public endpoint
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)

  Response:
    {
      "_meta": { "total_tokens": 123 },
      "data": {
        "repo": "changcheng967/Luminex",
        "lastSyncedAt": "2025-02-10T12:00:00Z",
        "lastSha": "abc123def456",
        "filesIndexed": 42,
        "currentlySyncing": false,
        "syncStartedAt": null,
        "syncError": null
      }
    }


================================================================================
BATCH API (NEW)
================================================================================

POST /api/v2/batch
  Description: Get multiple files/snippets in one request
  Auth: NONE - Public endpoint

  Request Body:
    {
      "repo": "changcheng967/Luminex",
      "requests": [
        {"path": "src/file1.cpp", "startLine": 1, "endLine": 50},
        {"path": "src/file2.cpp", "startLine": 100, "endLine": 200},
        {"path": "include/header.h"}
      ],
      "maxTokens": 10000
    }

  Response:
    {
      "_meta": {"total_tokens": 3456},
      "data": {
        "results": [
          {
            "path": "src/file1.cpp",
            "content": "// file content...",
            "language": "cpp",
            "lineCount": 50,
            "startLine": 1,
            "endLine": 50
          },
          ...
        ],
        "totalTokens": 3200,
        "skipped": 0
      }
    }

  Use Cases:
    - Fetch multiple related files in one request
    - Compare implementations across files
    - Get context from multiple modules
    - Reduce round-trips for multi-file analysis

GET /api/v2/batch
  Description: Simplified batch for full files
  Query Parameters:
    - repo: "changcheng967/Luminex" (required)
    - paths: Comma-separated file paths (required)
    - maxTokens: Token budget (default: 8000)

  Example:
    /api/v2/batch?repo=changcheng967/Luminex&paths=src/eval.cpp,src/search.cpp,include/eval.h


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
   GET /api/search?repo=changcheng967/Luminex&q=search_term&contextLines=10
   -> Returns matching files with line numbers and rich context

2. TARGETED FETCH - Get specific code:
   GET /api/file?repo=...&path=...&startLine=X&endLine=Y
   -> Returns only the requested lines (token efficient)

3. BATCH REQUEST - Get multiple related files:
   POST /api/v2/batch
   Body: {"repo": "...", "requests": [...]}
   -> Multiple files in one request

4. FULL CONTEXT (if needed):
   GET /api/file?repo=...&path=...&startLine=1&endLine=100
   -> Get beginning of file for includes/imports

5. BROWSE STRUCTURE:
   GET /api/tree?repo=changcheng967/Luminex
   -> See all files with sizes


TOKEN BUDGET MANAGEMENT:
------------------------

- Always check _meta.total_tokens before processing
- For large files, request specific line ranges
- Use search to find relevant files first
- Then fetch targeted line ranges (±10 lines for context)
- Use ?raw=true to save JSON wrapper tokens
- Use /api/v2/batch for multiple files to save round-trips


EXAMPLE CONVERSATION FLOWS:
---------------------------

User: "Show me the evaluate_pawn_shield function"

LLM Steps:
1. GET /api/search?repo=changcheng967/Luminex&q=evaluate_pawn_shield&contextLines=10
   Response: Found in src/evaluation.cpp, line 823

2. GET /api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&startLine=815&endLine=875
   Response: Got function with surrounding context

3. Analyze and explain the function

---

User: "Compare the Bitboard implementations in different files"

LLM Steps:
1. GET /api/search?repo=changcheng967/Luminex&q=Bitboard&filePattern=*.cpp
   Response: Found in multiple files

2. POST /api/v2/batch
   Body: {
     "repo": "changcheng967/Luminex",
     "requests": [
       {"path": "src/bitboard.cpp", "startLine": 1, "endLine": 100},
       {"path": "src/evaluation.cpp", "startLine": 1, "endLine": 100}
     ]
   }

3. Compare implementations side by side

---

User: "What's the overall structure of the codebase?"

LLM Steps:
1. GET /api/stats?repo=changcheng967/Luminex
   Response: Overview with directories and language breakdown

2. GET /api/tree?repo=changcheng967/Luminex
   Response: Complete file list

3. Summarize the structure


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

Batch endpoint specific errors:
- Files skipped due to token budget are included with error message
- Invalid file paths return error in that result entry


================================================================================
PERFORMANCE NOTES
================================================================================

- No authentication overhead - instant access
- Line range requests are very fast (<100ms)
- Batch requests reduce round-trips
- File tree is cached
- SHA-based incremental sync (only changed files)
- Database optimized for full-text search
- Auto-indexing happens on first request
- Webhook sync updates files within seconds of push


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


EXAMPLE: Batch request (Python)
    import requests
    import json

    url = "https://your-domain.com/api/v2/batch"
    body = {
        "repo": "changcheng967/Luminex",
        "requests": [
            {"path": "src/file1.cpp"},
            {"path": "src/file2.cpp", "startLine": 1, "endLine": 50}
        ]
    }
    response = requests.post(url, json=body)
    print(response.json())


EXAMPLE: Simple curl request
    curl "https://your-domain.com/api/file?repo=changcheng967/Luminex&path=src/evaluation.cpp&startLine=100&endLine=200"


================================================================================
VERSION & CHANGELOG
================================================================================

API Version: v2.0
Repository: Luminex - High-performance ML inference framework
Owner: changcheng967
Last Updated: 2025-02

V2 CHANGES:
- Added /api/v2/batch endpoint for multi-file requests
- Enhanced /api/search with configurable context and highlighting
- Enhanced /api/stats with file distribution and directories
- Improved /api/sync with always-fresh data
- Removed authentication (all endpoints public)
- Better error handling in batch requests

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
