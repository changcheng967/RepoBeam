"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, File, Home, RefreshCw, Clock, FileCode, Loader2, AlertCircle, Search, Zap } from "lucide-react";
import { internalFetch } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface FileNode {
  path: string;
  language: string;
  tokenCount: number;
  lineCount: number;
}

interface RepoData {
  files: FileNode[];
  lastSyncedAt: string | null;
  lastSha: string | null;
  currentlySyncing: boolean;
  totalTokens: number;
}

const LUMINEX_REPO = {
  owner: "changcheng967",
  name: "Luminex",
  full_name: "changcheng967/Luminex",
  githubUrl: "https://github.com/changcheng967/Luminex",
};

const getIconForPath = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase();
  const icons: Record<string, string> = {
    cpp: "C++", cc: "C++", h: "C++", hpp: "C++", cxx: "C++",
    py: "Py", js: "JS", jsx: "JS", ts: "TS", tsx: "TS",
    rs: "Rs", go: "Go", java: "Jv", kt: "Kt", swift: "Sw",
    css: "CSS", html: "HTML", json: "JSON", md: "MD", yaml: "YML",
    sh: "SH", bash: "SH", sql: "SQL",
  };
  return icons[ext || ""] || "";
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

export default function RepoPage() {
  const params = useParams();
  const router = useRouter();

  const [repoData, setRepoData] = useState<RepoData>({
    files: [],
    lastSyncedAt: null,
    lastSha: null,
    currentlySyncing: false,
    totalTokens: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [treeRes, syncRes] = await Promise.all([
        internalFetch(`/api/tree?repo=${encodeURIComponent(LUMINEX_REPO.full_name)}`),
        internalFetch(`/api/sync?repo=${encodeURIComponent(LUMINEX_REPO.full_name)}`),
      ]);

      if (treeRes.ok) {
        const data = await treeRes.json();
        const files = data.data?.files || [];
        setRepoData(prev => ({
          ...prev,
          files,
          totalTokens: files.reduce((sum: number, f: FileNode) => sum + (f.tokenCount || 0), 0),
        }));
      }

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        const data = syncData.data || {};
        setRepoData(prev => ({
          ...prev,
          lastSyncedAt: data.lastSyncedAt || null,
          lastSha: data.lastSha || null,
          currentlySyncing: data.currentlySyncing || false,
        }));
        setSyncing(data.currentlySyncing || false);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load repository");
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await internalFetch(`/api/sync?repo=${encodeURIComponent(LUMINEX_REPO.full_name)}`);
      if (res.ok) {
        const data = await res.json();
        const syncData = data.data || {};
        const isSyncing = syncData.currentlySyncing || false;
        setSyncing(isSyncing);
        setRepoData(prev => ({
          ...prev,
          lastSyncedAt: syncData.lastSyncedAt || prev.lastSyncedAt,
          lastSha: syncData.lastSha || prev.lastSha,
          currentlySyncing: isSyncing,
        }));
        if (!isSyncing && syncing) {
          // Sync just completed, refresh data
          fetchData();
        }
      }
    } catch (err) {
      console.error("Failed to fetch sync status:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (syncing) {
        fetchSyncStatus();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [syncing]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    try {
      await internalFetch(`/api/sync?repo=${encodeURIComponent(LUMINEX_REPO.full_name)}&force=true`, { method: "POST" });
    } catch (err) {
      console.error("Failed to sync:", err);
      setError("Failed to start sync");
      setSyncing(false);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Build tree structure
  const tree = useMemo(() => {
    const root: any = { name: "", children: [], isFile: false, path: "" };
    for (const file of repoData.files) {
      const parts = file.path.split("/");
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const path = parts.slice(0, i + 1).join("/");
        let existing = current.children?.find((c: any) => c.name === part);
        if (!existing) {
          existing = {
            name: part,
            path,
            isFile,
            language: isFile ? file.language : null,
            tokenCount: isFile ? file.tokenCount : 0,
            lineCount: isFile ? file.lineCount : 0,
            children: [],
          };
          if (!current.children) current.children = [];
          current.children.push(existing);
        }
        current = existing;
      }
    }
    const sortNodes = (nodes: any[]) => {
      return nodes.sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
    };
    const sortTree = (node: any) => {
      if (node.children) {
        node.children = sortNodes(node.children);
        node.children.forEach(sortTree);
      }
    };
    sortTree(root);
    return root.children || [];
  }, [repoData.files]);

  const countFiles = (nodes: any[]): number => {
    let count = 0;
    for (const node of nodes) {
      if (node.isFile) count++;
      if (node.children) count += countFiles(node.children);
    }
    return count;
  };

  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;
    const filterTree = (nodes: any[], query: string): any[] => {
      const results: any[] = [];
      const q = query.toLowerCase();
      for (const node of nodes) {
        const nameMatch = node.name.toLowerCase().includes(q);
        const filteredChildren = node.children ? filterTree(node.children, query) : [];
        if (nameMatch || filteredChildren.length > 0) {
          results.push({
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.children,
            autoExpand: filteredChildren.length > 0,
          });
        }
      }
      return results;
    };
    return filterTree(tree, searchQuery);
  }, [tree, searchQuery]);

  const totalFiles = repoData.files.length;
  const filteredFiles = searchQuery ? countFiles(filteredTree) : totalFiles;

  function renderNode(node: any, depth: number = 0): React.ReactNode {
    const isExpanded = expandedFolders.has(node.path) || node.autoExpand;
    const iconLabel = getIconForPath(node.path);

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1.5 py-1.5 px-2 hover:bg-muted/50 rounded cursor-pointer text-sm group ${
            node.isFile ? "hover:text-foreground" : ""
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          onClick={() => {
            if (!node.isFile) {
              toggleFolder(node.path);
            } else {
              router.push(`/repo/${LUMINEX_REPO.owner}/${LUMINEX_REPO.name}/${node.path}`);
            }
          }}
        >
          {node.isFile ? (
            <File className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 opacity-50" />
          ) : (
            <ChevronRight
              className={`h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          )}
          <span className="flex-1 truncate text-muted-foreground group-hover:text-foreground">{node.name}</span>
          {iconLabel && (
            <span className="text-[10px] text-muted-foreground/70 font-mono">{iconLabel}</span>
          )}
        </div>
        {isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child: any) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.push("/")}
            >
              <Zap className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Luminex</span>
              <a
                href={LUMINEX_REPO.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                View on GitHub
              </a>
              {repoData.lastSha && (
                <Badge variant="outline" className="text-xs font-mono">
                  {repoData.lastSha.slice(0, 8)}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{error}</span>
              </div>
            )}
            {syncing ? (
              <div className="flex items-center gap-1.5 text-xs text-blue-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Syncing...</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Updated {formatTimeAgo(repoData.lastSyncedAt)}
              </span>
            )}
            <Button
              variant={syncing ? "outline" : "default"}
              size="sm"
              className="h-8"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Tree */}
        <aside className="w-80 border-r border-border/50 flex-shrink-0 flex flex-col">
          {/* Repo Stats */}
          <div className="p-4 border-b border-border/50 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileCode className="h-4 w-4" />
                <span>{totalFiles.toLocaleString()} files</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {formatTokens(repoData.totalTokens)} tokens
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Synced {formatTimeAgo(repoData.lastSyncedAt)}</span>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 text-sm bg-muted/50 border-border/50 rounded"
              />
            </div>
            {searchQuery && (
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{filteredFiles.toLocaleString()} matching files</span>
                {filteredFiles !== totalFiles && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-primary hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tree */}
          <ScrollArea className="flex-1">
            <div className="py-2">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading files...
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <FileCode className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    {searchQuery ? "No matching files" : "No files found"}
                  </p>
                  {!searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={handleSync}
                      disabled={syncing}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Sync Repository
                    </Button>
                  )}
                </div>
              ) : (
                filteredTree.map((node: any) => renderNode(node))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Main Area - Empty State */}
        <main className="flex-1 flex items-center justify-center bg-muted/20">
          <div className="text-center text-muted-foreground p-8">
            <FileCode className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Select a file to view</h3>
            <p className="text-sm mb-4">
              Browse {totalFiles.toLocaleString()} files • {formatTokens(repoData.totalTokens)} total tokens
            </p>
            <div className="flex items-center justify-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <FileCode className="h-3 w-3" />
                Line-based navigation
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1">
                <Search className="h-3 w-3" />
                In-file search
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
