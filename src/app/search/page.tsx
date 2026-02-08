"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Home, Search, FileCode, Code, FileText, X, ChevronRight,
  Loader2, ChevronDown, Check
} from "lucide-react";
import { internalFetch } from "@/lib/api";

interface Repo {
  id: number;
  full_name: string;
  owner: string;
  name: string;
}

interface SearchResult {
  path: string;
  line: number;
  snippet: string;
  symbol?: string;
}

interface SymbolResult {
  name: string;
  kind: string;
  path: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [symbolResults, setSymbolResults] = useState<SymbolResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "symbols">("code");
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    try {
      const res = await internalFetch("/api/repos");
      if (res.ok) {
        const data = await res.json();
        const repoList = data.data || [];
        setRepos(repoList);
        if (repoList.length > 0) {
          setSelectedRepo(repoList[0].full_name);
        }
      }
    } catch (error) {
      console.error("Failed to fetch repos:", error);
    }
  };

  useEffect(() => {
    if (initialQuery && selectedRepo) {
      performSearch(initialQuery);
    }
  }, [initialQuery, selectedRepo]);

  const performSearch = async (query: string) => {
    if (!selectedRepo) return;

    setSearching(true);
    try {
      const [codeRes, symbolsRes] = await Promise.all([
        internalFetch(`/api/search?repo=${encodeURIComponent(selectedRepo)}&q=${encodeURIComponent(query)}`),
        internalFetch(`/api/symbols/search?repo=${encodeURIComponent(selectedRepo)}&q=${encodeURIComponent(query)}`),
      ]);

      if (codeRes.ok) {
        const data = await codeRes.json();
        setResults(data.data || []);
      }

      if (symbolsRes.ok) {
        const data = await symbolsRes.json();
        setSymbolResults(data.data || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    const [owner, name, ...pathParts] = selectedRepo.split("/");
    router.push(`/repo/${owner}/${name}/${result.path}`);
  };

  const handleSymbolClick = (result: SymbolResult) => {
    const [owner, name, ...pathParts] = selectedRepo.split("/");
    router.push(`/repo/${owner}/${name}/${result.path}`);
  };

  const getKindColor = (kind: string) => {
    const colors: Record<string, string> = {
      function: "text-blue-400",
      class: "text-green-400",
      struct: "text-yellow-400",
      interface: "text-purple-400",
      type: "text-pink-400",
    };
    return colors[kind] || "text-muted-foreground";
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

  const hasResults = results.length > 0 || symbolResults.length > 0;
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
          <div className="flex-1 flex items-center gap-3">
            {/* Repo Selector */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 justify-between min-w-[200px]"
                onClick={() => setShowRepoDropdown(!showRepoDropdown)}
                disabled={repos.length === 0}
              >
                <span className="truncate">
                  {repos.length === 0 ? "No repos" : selectedRepo || "Select repo..."}
                </span>
                <ChevronDown className="h-3.5 w-3.5 ml-2 flex-shrink-0" />
              </Button>

              {showRepoDropdown && repos.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-popover border border-border rounded-md shadow-lg z-50 max-h-[300px] overflow-y-auto">
                  {repos.map((repo) => (
                    <button
                      key={repo.id}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2"
                      onClick={() => {
                        setSelectedRepo(repo.full_name);
                        setShowRepoDropdown(false);
                        if (searchQuery) performSearch(searchQuery);
                      }}
                    >
                      {selectedRepo === repo.full_name && (
                        <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      )}
                      <span className="font-mono truncate">{repo.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <form onSubmit={handleSubmit} className="flex-1 max-w-xl relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code, symbols, functions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 bg-muted/50 border-border/50 text-sm"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setResults([]);
                    setSymbolResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>
          </div>
        </div>
      </header>

      {/* Tabs */}
      {hasSearched && (
        <div className="border-b border-border/50 px-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("code")}
              className={`text-sm py-2 px-1 border-b-2 transition-colors ${
                activeTab === "code"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5 inline mr-1.5" />
              Code ({results.length})
            </button>
            <button
              onClick={() => setActiveTab("symbols")}
              className={`text-sm py-2 px-1 border-b-2 transition-colors ${
                activeTab === "symbols"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code className="h-3.5 w-3.5 inline mr-1.5" />
              Symbols ({symbolResults.length})
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <main className="max-w-4xl mx-auto">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-medium mb-2">Search Code</h2>
            <p className="text-sm text-muted-foreground">
              {repos.length === 0 ? "Add a repository to start searching" : "Search code and symbols across your repositories"}
            </p>
          </div>
        ) : searching && !hasResults ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          </div>
        ) : activeTab === "code" ? (
          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="px-4 py-3">
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No code results found for "{searchQuery}"</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((result, i) => (
                    <Card
                      key={i}
                      className="border-border/50 hover:border-border/80 cursor-pointer transition-colors"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-mono text-muted-foreground">{result.path}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">Line {result.line}</span>
                        </div>
                        <pre className="text-xs bg-muted/30 rounded p-2 overflow-x-auto font-mono">
                          <code>{highlightMatch(result.snippet, searchQuery)}</code>
                        </pre>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="px-4 py-3">
              {symbolResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Code className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No symbols found for "{searchQuery}"</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {symbolResults.map((result, i) => (
                    <Card
                      key={i}
                      className="border-border/50 hover:border-border/80 cursor-pointer transition-colors"
                      onClick={() => handleSymbolClick(result)}
                    >
                      <div className="p-3 flex items-center gap-3">
                        <Code className={`h-4 w-4 flex-shrink-0 ${getKindColor(result.kind)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{highlightMatch(result.name, searchQuery)}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{result.kind}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <span className="font-mono truncate">{result.path}</span>
                            <Separator orientation="vertical" className="h-3" />
                            <span>Lines {result.startLine}-{result.endLine}</span>
                            <Separator orientation="vertical" className="h-3" />
                            <span>{result.tokenCount}t</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
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
