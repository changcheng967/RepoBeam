"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, File, Folder, Home, Search, FileCode, Clock, RefreshCw } from "lucide-react";
import { internalFetch } from "@/lib/api";

interface FileNode {
  path: string;
  language: string;
  tokenCount: number;
  lineCount: number;
}

const LANGUAGE_COLORS: Record<string, string> = {
  "C++": "bg-blue-500",
  "Python": "bg-yellow-500",
  "JavaScript": "bg-yellow-400",
  "TypeScript": "bg-blue-600",
  "Rust": "bg-orange-600",
  "Go": "bg-cyan-500",
  "Java": "bg-red-500",
  "C": "bg-blue-400",
  "HTML": "bg-orange-500",
  "CSS": "bg-purple-500",
  "Shell": "bg-green-500",
  "default": "bg-gray-500"
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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["src", "lib", "app", "components"]));

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

    // Sort: folders first, then files, both alphabetically
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
  const totalTokens = files.reduce((sum, f) => sum + (f.tokenCount || 0), 0);
  const filteredFiles = searchQuery ? countFiles(filteredTree) : totalFiles;

  const formatTokens = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  function renderNode(node: any, depth: number = 0): React.ReactNode {
    const isExpanded = expandedFolders.has(node.path) || node.autoExpand;

    return (
      <div key={node.path} className="animate-fade-in">
        <div
          className={`flex items-center gap-2 py-2 px-3 hover:bg-primary/10 rounded-lg cursor-pointer transition-colors group`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => {
            if (!node.isFile) {
              toggleFolder(node.path);
            } else {
              router.push(`/repo/${owner}/${name}/${node.path}`);
            }
          }}
        >
          {node.isFile ? (
            <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
          ) : (
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          )}
          <span className="text-sm truncate flex-1">{node.name}</span>
          {node.isFile && (
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-muted-foreground font-mono">
                {formatTokens(node.tokenCount)}t
              </span>
            </div>
          )}
        </div>
        {isExpanded && node.children && node.children.length > 0 && (
          <div className="animate-slide-up">
            {node.children.map((child: any) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="flex-shrink-0"
            >
              <Home className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
              <span className="font-medium truncate">{owner}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium truncate">{name}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/search")}
              className="gap-2 flex-shrink-0"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-card to-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileCode className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? "..." : totalFiles}</p>
                  <p className="text-xs text-muted-foreground">Files</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card to-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? "..." : formatTokens(totalTokens)}</p>
                  <p className="text-xs text-muted-foreground">Tokens</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-base"
            />
            {searchQuery && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {filteredFiles} results
              </div>
            )}
          </div>
        </div>

        {/* File Tree */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Loading files...</span>
              </div>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileCode className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No files found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {searchQuery ? "Try a different search term" : "Repository appears to be empty"}
              </p>
            </div>
          ) : (
            <div className="p-4 max-h-[600px] overflow-y-auto scrollbar-thin">
              <div className="space-y-0.5">
                {filteredTree.map((node: any) => renderNode(node))}
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
