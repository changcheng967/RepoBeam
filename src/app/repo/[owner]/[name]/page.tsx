"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, File, Folder, Home, Search } from "lucide-react";
import { internalFetch } from "@/lib/api";

interface FileNode {
  path: string;
  language: string;
  tokenCount: number;
  lineCount: number;
}

export default function RepoPage() {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const name = params.name as string;
  const repoName = `${owner}/${name}`;

  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchFiles();
  }, [owner, name]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await internalFetch(`/api/tree?repo=${encodeURIComponent(repoName)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    } finally {
      setLoading(false);
    }
  };

  // Build tree structure
  const buildTree = (flatFiles: FileNode[]) => {
    const root: any = { name: "", children: [], isFile: false };

    for (const file of flatFiles) {
      const parts = file.path.split("/");
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        let existing = current.children.find((c: any) => c.name === part);
        if (!existing) {
          existing = {
            name: part,
            path: isFile ? file.path : parts.slice(0, i + 1).join("/"),
            isFile,
            language: isFile ? file.language : null,
            tokenCount: isFile ? file.tokenCount : 0,
            children: [],
          };
          current.children.push(existing);
        }
        current = existing;
      }
    }

    return root.children;
  };

  const tree = buildTree(files);
  const filteredTree = searchQuery
    ? filterTree(tree, searchQuery.toLowerCase())
    : tree;

  function filterTree(nodes: any[], query: string): any[] {
    return nodes.reduce((acc: any[], node: any) => {
      const nameMatch = node.name.toLowerCase().includes(query);
      const filteredChildren = node.children ? filterTree(node.children, query) : [];

      if (nameMatch || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        });
      }
      return acc;
    }, []);
  }

  function renderNode(node: any, depth: number = 0): React.ReactNode {
    const isExpanded = true; // Always expanded for simplicity

    return (
      <div key={node.path || node.name}>
        <div
          className="flex items-center gap-2 py-1 px-2 hover:bg-muted rounded cursor-pointer"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.isFile) {
              router.push(`/repo/${owner}/${name}/${node.path}`);
            }
          }}
        >
          {node.isFile ? (
            <File className="h-4 w-4 text-blue-500" />
          ) : (
            <Folder className="h-4 w-4 text-yellow-500" />
          )}
          <span className="text-sm truncate">{node.name}</span>
          {node.isFile && (
            <span className="text-xs text-muted-foreground ml-auto">
              {node.tokenCount}t
            </span>
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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <Home className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{owner}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{name}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/search")}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <div className="border rounded-lg p-4 bg-card">
            {filteredTree.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No files found
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTree.map((node: any) => renderNode(node))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
