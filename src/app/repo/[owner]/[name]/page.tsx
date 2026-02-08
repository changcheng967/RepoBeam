"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChevronRight, File, Home, Search, RefreshCw, GitBranch, Clock, FileCode, Loader2, AlertCircle, X } from "lucide-react";
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

interface RepoInfo {
  id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  last_synced_at: string | null;
  last_sha: string | null;
}

const getIconForPath = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase();
  const icons: Record<string, string> = {
    cpp: "C++", cc: "C++", h: "C++", hpp: "C++", cxx: "C++",
    py: "Py", js: "JS", jsx: "JS", ts: "TS", tsx: "TS",
    rs: "Rs", go: "Go", java: "Jv", kt: "Kt", swift: "Sw",
    css: "CSS", html: "HTML", json: "JSON", md: "MD", yaml: "YML",
    sh: "SH", bash: "SH", sql: "SQL", xml: "XML",
  };
  return icons[ext || ""] || "";
};

const getKindColor = (lang: string | null) => {
  if (!lang) return "bg-muted";
  const colors: Record<string, string> = {
    "C++": "bg-blue-500/20 text-blue-400",
    Py: "bg-yellow-500/20 text-yellow-400",
    JS: "bg-yellow-400/20 text-yellow-300",
    TS: "bg-blue-400/20 text-blue-300",
    Rs: "bg-orange-500/20 text-orange-400",
    Go: "bg-cyan-500/20 text-cyan-400",
    Java: "bg-red-500/20 text-red-400",
    HTML: "bg-orange-400/20 text-orange-300",
    CSS: "bg-blue-500/20 text-blue-400",
    JSON: "bg-green-500/20 text-green-400",
    MD: "bg-slate-500/20 text-slate-400",
  };
  return colors[getIconForPath("file." + lang)] || "bg-muted";
};

export default function RepoPage() {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const name = params.name as string;
  const repoName = `${owner}/${name}`;

  const [files, setFiles] = useState<FileNode[]>([]);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
    // Poll for sync status if syncing
    const interval = setInterval(() => {
      if (syncing) {
        fetchSyncStatus();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [owner, name, syncing]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [treeRes, syncRes] = await Promise.all([
        internalFetch(`/api/tree?repo=${encodeURIComponent(repoName)}`),
        internalFetch(`/api/sync?repo=${encodeURIComponent(repoName)}`),
      ]);

      if (!treeRes.ok && treeRes.status === 404) {
        setError("Repository not found. Add it first from the home page.");
        setFiles([]);
        setLoading(false);
        return;
      }

      if (treeRes.ok) {
        const data = await treeRes.json();
        setFiles(data.data?.files || data.data || []);
      }

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        setRepoInfo(syncData.data?.repo || null);
        setSyncing(syncData.data?.currentlySyncing || false);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setError("Failed to load repository");
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await internalFetch(`/api/sync?repo=${encodeURIComponent(repoName)}`);
      if (res.ok) {
        const data = await res.json();
        setSyncing(data.data?.currentlySyncing || false);
        if (!data.data?.currentlySyncing) {
          // Sync completed, refresh files
          fetchData();
        }
      }
    } catch (error) {
      console.error("Failed to fetch sync status:", error);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await internalFetch(`/api/sync?repo=${encodeURIComponent(repoName)}&force=true`, { method: "POST" });
      if (res.ok) {
        // Sync started
      }
    } catch (error) {
      console.error("Failed to sync:", error);
      setSyncing(false);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Build tree structure
  const tree = useMemo(() => {
    const root: any = { name: "", children: [], isFile: false, path: "" };

    for (const file of files) {
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
  }, [files]);

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

  const totalFiles = files.length;
  const filteredFiles = searchQuery ? countFiles(filteredTree) : totalFiles;
  const totalTokens = files.reduce((sum, f) => sum + (f.tokenCount || 0), 0);

  function renderNode(node: any, depth: number = 0): React.ReactNode {
    const isExpanded = expandedFolders.has(node.path) || node.autoExpand;
    const iconLabel = getIconForPath(node.path);

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1.5 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer text-sm group ${
            node.isFile ? "hover:text-foreground" : ""
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          onClick={() => {
            if (!node.isFile) {
              toggleFolder(node.path);
            } else {
              router.push(`/repo/${owner}/${name}/${node.path}`);
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

  const formatTimeAgo = (date: string | null) => {
    if (!date) return "never";
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.push("/")}
            >
              <Home className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">{owner}</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-sm font-mono">{name}</span>
            </div>
            {repoInfo?.language && (
              <Badge variant="secondary" className="text-xs">{repoInfo.language}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{error}</span>
              </div>
            )}
            {syncing && (
              <div className="flex items-center gap-1.5 text-xs text-warning">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Syncing...</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => router.push("/search")}
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Search</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSync}
              disabled={syncing}
              title="Force sync"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Tree */}
        <aside className="w-64 border-r border-border/50 flex-shrink-0 flex flex-col">
          {/* Repo Stats */}
          <div className="p-3 border-b border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileCode className="h-3.5 w-3.5" />
              <span>{totalFiles.toLocaleString()} files</span>
              <Separator orientation="vertical" className="h-3" />
              <span>{(totalTokens / 1000).toFixed(0)}k tokens</span>
            </div>
            {repoInfo?.last_synced_at && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                <span>Synced {formatTimeAgo(repoInfo.last_synced_at)}</span>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm bg-muted/30 border-border/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{filteredFiles.toLocaleString()} {searchQuery ? "matching" : ""} files</span>
            </div>
          </div>

          {/* Tree */}
          <ScrollArea className="flex-1">
            <div className="py-1">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading files...
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <FileCode className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No matching files" : "No files found"}
                  </p>
                  {!searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={handleSync}
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
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <FileCode className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm mb-1">Select a file to view its contents</p>
            <p className="text-xs text-muted-foreground/70">
              {totalFiles.toLocaleString()} files indexed • {(totalTokens / 1000).toFixed(0)}k total tokens
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
