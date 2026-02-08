"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChevronRight, File, Home, Search, RefreshCw, GitBranch, Clock, FileCode } from "lucide-react";
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

const getIconForPath = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase();
  const icons: Record<string, string> = {
    cpp: "C++", cc: "C++", h: "C++", hpp: "C++",
    py: "Py", js: "JS", jsx: "JS", ts: "TS", tsx: "TS",
    rs: "Rs", go: "Go", java: "Jv",
    css: "CSS", html: "HTML", json: "JSON", md: "MD",
  };
  return icons[ext || ""] || "";
};

export default function RepoPage() {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const name = params.name as string;
  const repoName = `${owner}/${name}`;

  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, [owner, name]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await internalFetch(`/api/tree?repo=${encodeURIComponent(repoName)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.data?.files || data.data || []);
        const repoInfo = data.data?.repo;
        setSyncing(repoInfo?.syncing || false);
        // Auto-expand root level folders
        const rootFolders = (data.data?.files || data.data || [])
          .map((f: FileNode) => f.path.split("/")[0])
          .filter((p: string, i: number, arr: string[]) => arr.indexOf(p) === i && p.includes("/"));
        setExpandedFolders(new Set(rootFolders));
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    } finally {
      setLoading(false);
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

  function renderNode(node: any, depth: number = 0): React.ReactNode {
    const isExpanded = expandedFolders.has(node.path) || node.autoExpand;
    const iconLabel = getIconForPath(node.path);

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1.5 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer text-sm group`}
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
          <span className="flex-1 truncate text-muted-foreground">{node.name}</span>
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
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono">{owner}</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-sm font-mono">{name}</span>
            </div>
            <Badge variant="secondary" className="text-xs">C++</Badge>
          </div>
          <div className="flex items-center gap-2">
            {syncing && <RefreshCw className="h-4 w-4 text-warning animate-spin" />}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => router.push("/search")}
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Search
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex">
        {/* Sidebar - File Tree */}
        <aside className="w-64 border-r border-border/50 flex-shrink-0 flex flex-col">
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
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{filteredFiles} files</span>
            </div>
          </div>

          {/* Tree */}
          <ScrollArea className="flex-1">
            <div className="py-1">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <FileCode className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No files found</p>
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
            <p className="text-sm">Select a file to view</p>
          </div>
        </main>
      </div>
    </div>
  );
}
