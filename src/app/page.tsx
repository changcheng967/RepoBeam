"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, FileCode, RefreshCw, Home, Code, FileText, Clock, Loader2, ChevronRight,
  Copy, Check, ExternalLink, Zap, Database, ArrowRight, Activity, AlertCircle
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { internalFetch } from "@/lib/api";

// Hardcoded Luminex repository
const LUMINEX_REPO = {
  owner: "changcheng967",
  name: "Luminex",
  full_name: "changcheng967/Luminex",
  description: "High-performance ML inference framework",
  language: "C++",
  githubUrl: "https://github.com/changcheng967/Luminex"
};

interface RepoStats {
  syncing: boolean;
  filesIndexed: number;
  lastSynced: string | null;
  lastSha: string | null;
  totalLines: number;
  totalTokens: number;
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
  const [stats, setStats] = useState<RepoStats>({
    syncing: false,
    filesIndexed: 0,
    lastSynced: null,
    lastSha: null,
    totalLines: 0,
    totalTokens: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const { copy, copied } = useCopyToClipboard();

  const fetchStats = useCallback(async (showLoading = false) => {
    try {
      const res = await internalFetch(`/api/sync?repo=${LUMINEX_REPO.full_name}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || {};
        setStats({
          syncing: data.currentlySyncing || false,
          filesIndexed: data.filesIndexed || 0,
          lastSynced: data.lastSyncedAt || null,
          lastSha: data.lastSha || null,
          totalLines: 0,
          totalTokens: 0,
          error: data.syncError,
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const fetchFullStats = useCallback(async () => {
    try {
      const res = await internalFetch(`/api/stats?repo=${LUMINEX_REPO.full_name}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || {};
        setStats(prev => ({
          ...prev,
          filesIndexed: data.overview?.totalFiles || prev.filesIndexed,
          totalLines: data.overview?.totalLines || 0,
          totalTokens: data.overview?.totalTokens || 0,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch full stats:", error);
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchStats(true), fetchFullStats()]);
    };
    loadAll();
  }, [fetchStats, fetchFullStats]);

  // Poll when syncing or after sync attempt
  useEffect(() => {
    const interval = setInterval(() => {
      if (stats.syncing || syncAttempt > 0) {
        fetchStats(false);
        if (!stats.syncing && syncAttempt > 0) {
          // Sync completed, fetch full stats
          fetchFullStats();
          setSyncAttempt(0);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchFullStats, stats.syncing, syncAttempt]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);
    try {
      const res = await internalFetch(
        `/api/search?repo=${LUMINEX_REPO.full_name}&q=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data?.results || data.data || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSync = async () => {
    if (stats.syncing) return;
    setStats(prev => ({ ...prev, syncing: true, error: undefined }));
    setSyncAttempt(prev => prev + 1);
    try {
      const res = await internalFetch(`/api/sync?repo=${LUMINEX_REPO.full_name}&force=true`, { method: "POST" });
      if (!res.ok) {
        setStats(prev => ({ ...prev, syncing: false, error: "Failed to start sync" }));
      }
    } catch (error) {
      console.error("Failed to sync:", error);
      setStats(prev => ({ ...prev, syncing: false, error: "Network error" }));
    }
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return "Never";
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Luminex Explorer
            </h1>
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
                placeholder="Search code... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-muted/50 border-border/50 text-sm"
              />
            </div>
          </form>

          {/* Sync Status */}
          <div className="flex items-center gap-3">
            {stats.error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{stats.error}</span>
              </div>
            )}
            {stats.syncing ? (
              <span className="text-xs text-blue-500 flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">Syncing...</span>
              </span>
            ) : stats.lastSynced && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Updated {formatTimeAgo(stats.lastSynced)}
              </span>
            )}
            <Button
              variant={stats.syncing ? "outline" : "default"}
              size="sm"
              className="h-8"
              onClick={handleSync}
              disabled={stats.syncing}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${stats.syncing ? "animate-spin" : ""}`} />
              {stats.syncing ? "Syncing" : "Sync Now"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading repository...</p>
            </div>
          </div>
        ) : searchResults.length > 0 ? (
          // Search Results
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
              </h2>
              <Button variant="ghost" size="sm" onClick={() => { setSearchResults([]); setSearchQuery(""); }}>
                Clear
              </Button>
            </div>
            {searchResults.map((result, i) => (
              <Card
                key={i}
                className="border-border/50 hover:border-border cursor-pointer transition-all hover:shadow-md"
                onClick={() => router.push(`/repo/changcheng967/Luminex/${result.path}#${result.line}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono text-foreground">{result.path}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">Line {result.line}</Badge>
                  </div>
                  <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto font-mono border border-border/50">
                    <code>{result.snippet}</code>
                  </pre>
                  {result.matchCount !== undefined && result.matchCount > 1 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {result.matchCount} match{result.matchCount !== 1 ? "es" : ""} in snippet
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Overview Dashboard
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center py-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Zap className="h-10 w-10 text-primary" />
                <h2 className="text-3xl font-bold">Luminex Code Explorer</h2>
              </div>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                High-performance ML inference framework • {stats.filesIndexed.toLocaleString()} files • {formatTokens(stats.totalTokens)} tokens
              </p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <a
                  href={LUMINEX_REPO.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on GitHub
                </a>
                {stats.lastSha && (
                  <span className="text-xs text-muted-foreground font-mono">
                    SHA: {stats.lastSha.slice(0, 8)}
                  </span>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-5 text-center">
                  <FileCode className="h-7 w-7 mx-auto mb-3 text-blue-500" />
                  <div className="text-3xl font-bold">{stats.filesIndexed.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground mt-1">Files Indexed</div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5 text-center">
                  <Code className="h-7 w-7 mx-auto mb-3 text-purple-500" />
                  <div className="text-3xl font-bold">{stats.totalLines.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total Lines</div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5 text-center">
                  <Database className="h-7 w-7 mx-auto mb-3 text-green-500" />
                  <div className="text-3xl font-bold">{formatTokens(stats.totalTokens)}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total Tokens</div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5 text-center">
                  <Clock className="h-7 w-7 mx-auto mb-3 text-orange-500" />
                  <div className="text-3xl font-bold">{formatTimeAgo(stats.lastSynced)}</div>
                  <div className="text-sm text-muted-foreground mt-1">Last Synced</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className="border-border/50 hover:border-primary cursor-pointer transition-all hover:shadow-lg group"
                onClick={() => router.push("/repo/changcheng967/Luminex")}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <FileCode className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Browse Files</h3>
                    <p className="text-sm text-muted-foreground">
                      Explore {stats.filesIndexed} source files with line navigation
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>

              <Card
                className="border-border/50 hover:border-primary cursor-pointer transition-all hover:shadow-lg group"
                onClick={() => router.push("/search")}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                    <Search className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Search Code</h3>
                    <p className="text-sm text-muted-foreground">
                      Full-text search with context and line numbers
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </div>

            {/* API Access for LLMs */}
            <Card className="border-border/50 bg-gradient-to-br from-muted/50 to-background">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">LLM API Access</h3>
                    <p className="text-xs text-muted-foreground">Public endpoints for AI code exploration</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">No Auth Required</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Main API URL */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      API Documentation
                    </h4>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-background px-3 py-2 rounded font-mono border border-border/50">
                        /api/help
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => copy(`${typeof window !== "undefined" ? window.location.origin : ""}/api/help`)}
                      >
                        {copied ? <><Check className="h-3.5 w-3.5 mr-1" />Copied</> : <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>}
                      </Button>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Quick Examples</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 bg-background rounded border border-border/50">
                        <code className="font-mono truncate flex-1">/api/tree?repo=...&q=search</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(`tree?repo=${LUMINEX_REPO.full_name}`)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-background rounded border border-border/50">
                        <code className="font-mono truncate flex-1">/api/file?repo=...&path=...</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(`file?repo=${LUMINEX_REPO.full_name}&path=src/file.cpp`)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    All endpoints are publicly accessible. Perfect for LLMs with web fetch.
                  </p>
                  <a
                    href="/api/help"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Full docs <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Activity Indicator */}
            {stats.syncing && (
              <Card className="border-blue-500/50 bg-blue-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Sync in progress...</p>
                    <p className="text-xs text-muted-foreground">This may take a moment for large repositories</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
