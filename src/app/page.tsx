"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, FileCode, RefreshCw, Home, Code, FileText, Clock, Loader2, ChevronRight,
  Copy, Check, ExternalLink
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { internalFetch } from "@/lib/api";

// Hardcoded Luminex repository
const LUMINEX_REPO = {
  owner: "changcheng967",
  name: "Luminex",
  full_name: "changcheng967/Luminex",
  description: "High-performance ML inference framework",
  language: "C++"
};

interface RepoStats {
  syncing: boolean;
  filesIndexed: number;
  lastSynced: string | null;
  error?: string;
}

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return { copy, copied };
}

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<RepoStats>({ syncing: false, filesIndexed: 0, lastSynced: null });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { copy, copied } = useCopyToClipboard();

  const fetchStats = useCallback(async () => {
    try {
      const res = await internalFetch(`/api/sync?repo=${LUMINEX_REPO.full_name}`);
      if (res.ok) {
        const json = await res.json();
        setStats({
          syncing: json.data?.currentlySyncing || false,
          filesIndexed: json.data?.filesIndexed || 0,
          lastSynced: json.data?.repo?.last_synced_at || null,
          error: json.data?.syncError,
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Poll for sync status
    const interval = setInterval(() => {
      if (stats.syncing) {
        fetchStats();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchStats, stats.syncing]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await internalFetch(
        `/api/search?repo=${LUMINEX_REPO.full_name}&q=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSync = async () => {
    if (stats.syncing) return;
    setStats(prev => ({ ...prev, syncing: true }));
    try {
      const res = await internalFetch(`/api/sync?repo=${LUMINEX_REPO.full_name}&force=true`, { method: "POST" });
      if (res.ok) {
        setTimeout(() => fetchStats(), 2000);
      }
    } catch (error) {
      console.error("Failed to sync:", error);
      setStats(prev => ({ ...prev, syncing: false }));
    }
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return "never";
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold tracking-tight">Luminex</h1>
            <nav className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground"
                onClick={() => router.push("/")}
              >
                <Home className="h-4 w-4 mr-1.5" />
                Overview
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground/70 hover:text-foreground"
                onClick={() => router.push("/repo/changcheng967/Luminex")}
              >
                <FileCode className="h-4 w-4 mr-1.5" />
                Files
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground/70 hover:text-foreground"
                onClick={() => router.push("/search")}
              >
                <Search className="h-4 w-4 mr-1.5" />
                Search
              </Button>
            </nav>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code, functions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-muted/50 border-border/50 text-sm"
              />
            </div>
          </form>

          {/* Sync Status */}
          <div className="flex items-center gap-2">
            {stats.error && (
              <span className="text-xs text-destructive" title={stats.error}>Sync error</span>
            )}
            {stats.syncing && (
              <span className="text-xs text-warning flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Syncing...
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSync}
              disabled={stats.syncing}
              title="Force sync"
            >
              <RefreshCw className={`h-4 w-4 ${stats.syncing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : searchResults.length > 0 ? (
          // Search Results
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground mb-3">
              Found {searchResults.length} results for "{searchQuery}"
            </div>
            {searchResults.map((result, i) => (
              <Card
                key={i}
                className="border-border/50 hover:border-border cursor-pointer transition-colors"
                onClick={() => router.push(`/repo/changcheng967/Luminex/${result.path}#${result.line}`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono text-muted-foreground">{result.path}</span>
                    <span className="text-xs text-muted-foreground">Line {result.line}</span>
                  </div>
                  <pre className="text-xs bg-muted/30 rounded p-2 overflow-x-auto font-mono">
                    <code>{result.snippet}</code>
                  </pre>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchResults([]);
                setSearchQuery("");
              }}
            >
              Clear results
            </Button>
          </div>
        ) : (
          // Overview
          <div className="space-y-6">
            {/* Hero Section */}
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-2">Luminex Code Explorer</h2>
              <p className="text-muted-foreground">
                High-performance ML inference framework • {stats.filesIndexed.toLocaleString()} files indexed
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-4 text-center">
                  <FileCode className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-semibold">{stats.filesIndexed.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">Files Indexed</div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4 text-center">
                  <Code className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-semibold">C++</div>
                  <div className="text-xs text-muted-foreground mt-1">Primary Language</div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4 text-center">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-semibold">{formatTimeAgo(stats.lastSynced)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Last Synced</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <Card
                className="border-border/50 hover:border-border cursor-pointer transition-colors"
                onClick={() => router.push("/repo/changcheng967/Luminex")}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <FileCode className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-medium">Browse Files</h3>
                    <p className="text-sm text-muted-foreground">Explore the codebase with line navigation</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
                </CardContent>
              </Card>

              <Card
                className="border-border/50 hover:border-border cursor-pointer transition-colors"
                onClick={() => router.push("/search")}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <Search className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-medium">Search Code</h3>
                    <p className="text-sm text-muted-foreground">Full-text search with line context</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
                </CardContent>
              </Card>
            </div>

            {/* API Info for LLMs */}
            <Card className="border-border/50 bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Code className="h-4 w-4 text-primary" />
                  <h3 className="font-medium text-sm">LLM API Access</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">No Auth Required</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  All endpoints are publicly accessible. Share these URLs with any AI that has web access.
                </p>

                {/* Main API Help URL */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">API Documentation</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => copy(`${typeof window !== "undefined" ? window.location.origin : ""}/api/help`)}
                    >
                      {copied ? <><Check className="h-3 w-3 mr-1" />Copied</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
                    </Button>
                  </div>
                  <code className="text-xs bg-background px-2 py-1.5 rounded block font-mono break-all border border-border/50">
                    /api/help
                  </code>
                </div>

                {/* Example API URLs */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Example API Endpoints:</p>

                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Get file tree:</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <code className="text-xs bg-background px-2 py-1 rounded font-mono flex-1 truncate">/api/tree?repo=changcheng967/Luminex</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => copy(`${typeof window !== "undefined" ? window.location.origin : ""}/api/tree?repo=changcheng967/Luminex`)}
                        >
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground">Search code:</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <code className="text-xs bg-background px-2 py-1 rounded font-mono flex-1 truncate">/api/search?repo=changcheng967/Luminex&q=Bitboard</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => copy(`${typeof window !== "undefined" ? window.location.origin : ""}/api/search?repo=changcheng967/Luminex&q=Bitboard`)}
                        >
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground">Get file content:</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <code className="text-xs bg-background px-2 py-1 rounded font-mono flex-1 truncate">/api/file?repo=changcheng967/Luminex&path=src/file.cpp</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => copy(`${typeof window !== "undefined" ? window.location.origin : ""}/api/file?repo=changcheng967/Luminex&path=src/file.cpp`)}
                        >
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground">Get line range:</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <code className="text-xs bg-background px-2 py-1 rounded font-mono flex-1 truncate">/api/file?repo=...&path=...&startLine=1&endLine=100</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => copy(`${typeof window !== "undefined" ? window.location.origin : ""}/api/file?repo=changcheng967/Luminex&path=src/file.cpp&startLine=1&endLine=100`)}
                        >
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50">
                  <a
                    href="/api/help"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View full API documentation <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
