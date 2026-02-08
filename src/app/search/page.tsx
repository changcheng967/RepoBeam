"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Home, Search, FileCode, Code, ArrowRight,
  Sparkles, FileText, X
} from "lucide-react";
import { internalFetch } from "@/lib/api";

const LUMINEX_REPO = "changcheng967/Luminex";

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

export default function SearchPage() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [symbolResults, setSymbolResults] = useState<SymbolResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "symbols">("code");

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery);
      } else {
        setResults([]);
        setSymbolResults([]);
        setSearched(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const [codeRes, symbolsRes] = await Promise.all([
        internalFetch(`/api/search?repo=${LUMINEX_REPO}&q=${encodeURIComponent(query)}`),
        internalFetch(`/api/symbols/search?repo=${LUMINEX_REPO}&q=${encodeURIComponent(query)}`),
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
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(`/repo/changcheng967/Luminex/${result.path}`);
  };

  const handleSymbolClick = (result: SymbolResult) => {
    router.push(`/repo/changcheng967/Luminex/${result.path}`);
  };

  const getKindColor = (kind: string) => {
    const colors: Record<string, string> = {
      function: "text-blue-500 bg-blue-500/10",
      class: "text-green-500 bg-green-500/10",
      struct: "text-yellow-500 bg-yellow-500/10",
      interface: "text-purple-500 bg-purple-500/10",
      type: "text-pink-500 bg-pink-500/10",
    };
    return colors[kind] || "text-gray-500 bg-gray-500/10";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
            >
              <Home className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search code, symbols, functions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base pr-10"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setResults([]);
                      setSymbolResults([]);
                      setSearched(false);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {!searched && !loading && (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mb-6 shadow-xl shadow-primary/20">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-3">Search Luminex</h2>
            <p className="text-muted-foreground max-w-md">
              Search through code, symbols, functions, and classes across the entire repository.
            </p>
          </div>
        )}

        {searched && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="code" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Code ({results.length})
                </TabsTrigger>
                <TabsTrigger value="symbols" className="gap-2">
                  <Code className="h-4 w-4" />
                  Symbols ({symbolResults.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="code" className="mt-0">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Searching...</span>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No results found</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Try different keywords or check your spelling
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {results.map((result, i) => (
                    <Card
                      key={i}
                      className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 animate-slide-up"
                      style={{ animationDelay: `${i * 30}ms` }}
                      onClick={() => handleResultClick(result)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileCode className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="font-medium truncate">{result.path}</span>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Line {result.line}
                          </span>
                        </div>
                        <pre className="text-sm bg-muted/50 rounded-lg p-3 overflow-x-auto">
                          <code>{highlightMatch(result.snippet, searchQuery)}</code>
                        </pre>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="symbols" className="mt-0">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Searching...</span>
                  </div>
                </div>
              ) : symbolResults.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                    <Code className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No symbols found</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Try searching for function names, classes, or types
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {symbolResults.map((result, i) => (
                    <Card
                      key={i}
                      className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 animate-slide-up"
                      style={{ animationDelay: `${i * 30}ms` }}
                      onClick={() => handleSymbolClick(result)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`h-10 w-10 rounded-lg ${getKindColor(result.kind).split(" ").slice(1).join(" ")} flex items-center justify-center flex-shrink-0`}>
                            <Code className={`h-5 w-5 ${getKindColor(result.kind).split(" ")[0]}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{highlightMatch(result.name, searchQuery)}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                              <span className="capitalize">{result.kind}</span>
                              <span>·</span>
                              <span className="truncate">{result.path}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Lines {result.startLine}-{result.endLine} · {result.tokenCount} tokens
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
