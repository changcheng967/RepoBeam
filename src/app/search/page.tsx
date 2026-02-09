"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Home, Search, FileCode, FileText, X, Loader2
} from "lucide-react";
import { internalFetch } from "@/lib/api";

interface SearchResult {
  path: string;
  line: number;
  snippet: string;
}

const LUMINEX_REPO = "changcheng967/Luminex";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await internalFetch(
        `/api/search?repo=${LUMINEX_REPO}&q=${encodeURIComponent(query)}`
      );

      if (res.ok) {
        const data = await res.json();
        setResults(data.data || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(`/repo/${LUMINEX_REPO}/${result.path}#${result.line}`);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const hasSearched = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push("/")}
          >
            <Home className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1 text-sm">
            <span className="font-mono text-muted-foreground">Luminex</span>
            <span className="text-muted-foreground/50">/</span>
            <span>Search</span>
          </div>
        </div>
      </header>

      {/* Search Input */}
      <div className="border-b border-border/50 px-4 py-6">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search code, functions, variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 bg-muted/50 border-border/50 text-base"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setResults([]);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Search across {results.length > 0 ? results.length.toLocaleString() : ""} files with line context
          </p>
        </form>
      </div>

      {/* Results */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-medium mb-2">Search Luminex Code</h2>
            <p className="text-sm text-muted-foreground">
              Full-text search with line context and highlighted matches
            </p>
          </div>
        ) : searching && results.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground mb-2">
              Found {results.length} result{results.length !== 1 ? "s" : ""} for "{searchQuery}"
            </div>
            {results.map((result, i) => (
              <Card
                key={i}
                className="border-border/50 hover:border-border cursor-pointer transition-colors"
                onClick={() => handleResultClick(result)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono text-muted-foreground">{result.path}</span>
                    <span className="text-xs text-muted-foreground">Line {result.line}</span>
                  </div>
                  <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto font-mono">
                    <code>{highlightMatch(result.snippet, searchQuery)}</code>
                  </pre>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
