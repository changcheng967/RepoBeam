"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft, Home, FileCode, Copy, Search, Check, ExternalLink,
  Code, ChevronRight, File, Loader2, Hash
} from "lucide-react";
import { internalFetch } from "@/lib/api";
import { createHighlighter } from "shiki";

interface FileData {
  content: string;
  language: string;
  lineCount: number;
  startLine: number;
  endLine: number;
  path: string;
  tokenCount: number;
}

const LANGUAGE_MAP: Record<string, string> = {
  javascript: "javascript", typescript: "typescript", tsx: "tsx", jsx: "jsx",
  python: "python", cpp: "cpp", c: "c", "c++": "cpp", cc: "cpp", h: "cpp", hpp: "cpp",
  go: "go", rust: "rust", java: "java", ruby: "ruby", php: "php",
  swift: "swift", kotlin: "kotlin", scala: "scala", shell: "bash",
  sh: "bash", html: "html", css: "css", json: "json",
  yaml: "yaml", yml: "yaml", markdown: "markdown", md: "markdown",
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

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;

export default function FilePage() {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const name = params.name as string;
  const path = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");
  const repoName = `${owner}/${name}`;

  // Get line number from hash (e.g., #150)
  const initialLine = useMemo(() => {
    if (typeof window === "undefined") return 1;
    const hash = window.location.hash.slice(1);
    const lineNum = parseInt(hash);
    return isNaN(lineNum) ? 1 : Math.max(1, lineNum);
  }, []);

  const [file, setFile] = useState<FileData | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedCode, setHighlightedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedApi, setCopiedApi] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
    fetchFileTree();
    initHighlighter();
  }, [owner, name, path]);

  useEffect(() => {
    if (file?.content) {
      highlightCode(file.content, file.language);
    }
  }, [file]);

  useEffect(() => {
    // Scroll to line from hash
    if (initialLine > 1) {
      setTimeout(() => {
        const element = document.querySelector(`[data-line="${initialLine}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("bg-primary/20");
          setTimeout(() => element.classList.remove("bg-primary/20"), 2000);
        }
      }, 100);
    }
  }, [initialLine]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await internalFetch(`/api/file?repo=${encodeURIComponent(repoName)}&path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const json = await res.json();
        setFile(json.data);
      } else {
        setFile(null);
      }
    } catch (error) {
      console.error("Failed to fetch file:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFileTree = async () => {
    try {
      const res = await internalFetch(`/api/tree?repo=${encodeURIComponent(repoName)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.data?.files || []);
      }
    } catch (error) {
      console.error("Failed to fetch tree:", error);
    }
  };

  const initHighlighter = async () => {
    if (!highlighter) {
      highlighter = await createHighlighter({
        themes: ["github-dark-dimmed"],
        langs: [Object.values(LANGUAGE_MAP)[0] as any],
      });
    }
  };

  const highlightCode = async (code: string, language: string) => {
    try {
      const lang = (language && LANGUAGE_MAP[language.toLowerCase()]) || "text";
      if (!highlighter) {
        setHighlightedCode(
          `<pre class="shiki" style="background:#0d1117;color:#c9d1d9"><code>${escapeHtml(code)}</code></pre>`
        );
        return;
      }
      const html = highlighter.codeToHtml(code, {
        lang: lang as any,
        theme: "github-dark-dimmed",
      });
      setHighlightedCode(html);
    } catch (error) {
      console.error("Highlight error:", error);
      setHighlightedCode(`<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`);
    }
  };

  const escapeHtml = (text: string) => {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  const copyCode = () => {
    if (file?.content) {
      navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyApiUrl = () => {
    const url = `${window.location.origin}/api/file?repo=${repoName}&path=${path}`;
    navigator.clipboard.writeText(url);
    setCopiedApi(true);
    setTimeout(() => setCopiedApi(false), 2000);
  };

  const copySelectedLines = () => {
    if (selectedLines.size === 0) return;
    const lines = file?.content.split("\n") || [];
    const selected = lines
      .filter((_, i) => selectedLines.has(i + 1))
      .join("\n");
    navigator.clipboard.writeText(selected);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLineClick = (lineNum: number) => {
    if (isDragging && dragStart) {
      // Range selection
      const start = Math.min(dragStart, lineNum);
      const end = Math.max(dragStart, lineNum);
      const newSelection = new Set<number>();
      for (let i = start; i <= end; i++) {
        newSelection.add(i);
      }
      setSelectedLines(newSelection);
    } else if (selectedLines.has(lineNum)) {
      // Deselect
      const newSelection = new Set(selectedLines);
      newSelection.delete(lineNum);
      setSelectedLines(newSelection);
    } else {
      // Select single line
      setSelectedLines(new Set([lineNum]));
    }
  };

  const handleLineMouseDown = (lineNum: number) => {
    setIsDragging(true);
    setDragStart(lineNum);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
    };
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // Build tree structure
  const tree = useMemo(() => {
    const root: any = { name: "", children: [], isFile: false, path: "" };
    for (const item of files) {
      const parts = item.path.split("/");
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const itemPath = parts.slice(0, i + 1).join("/");
        let existing = current.children?.find((c: any) => c.name === part);
        if (!existing) {
          existing = { name: part, path: itemPath, isFile, language: isFile ? item.language : null, children: [] };
          if (!current.children) current.children = [];
          current.children.push(existing);
        }
        current = existing;
      }
    }
    const sortNodes = (nodes: any[]) => nodes.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    const sortTree = (node: any) => {
      if (node.children) {
        node.children = sortNodes(node.children);
        node.children.forEach(sortTree);
      }
    };
    sortTree(root);
    return root.children || [];
  }, [files]);

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

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const renderNode = (node: any, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path) || node.autoExpand;
    const isActive = node.path === path;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1.5 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer text-sm ${
            isActive ? "bg-muted/70" : ""
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
          <span className="flex-1 truncate text-muted-foreground">{node.name}</span>
          {getIconForPath(node.path) && (
            <span className="text-[10px] text-muted-foreground/70 font-mono">{getIconForPath(node.path)}</span>
          )}
        </div>
        {isExpanded && node.children && (
          <div>{node.children.map((child: any) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const lines = file?.content.split("\n") || [];
  const startLine = file?.startLine || 1;

  const handleSearchInFile = () => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.toLowerCase();
    const matchingLines: number[] = [];
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(query)) {
        matchingLines.push(i + 1);
      }
    });
    if (matchingLines.length > 0) {
      setSelectedLines(new Set(matchingLines));
      // Scroll to first match
      const element = document.querySelector(`[data-line="${matchingLines[0]}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/")}>
              <Home className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1 text-sm">
              <span className="font-mono text-muted-foreground">Luminex</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-mono truncate max-w-[300px]">{path}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {file?.lineCount || 0} lines • {file?.tokenCount || 0} tokens
            </span>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyCode}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? "Copied" : "Copy Code"}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyApiUrl}>
              {copiedApi ? <Check className="h-3.5 w-3.5 mr-1" /> : <ExternalLink className="h-3.5 w-3.5 mr-1" />}
              {copiedApi ? "Copied" : "API URL"}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Tree */}
        <aside className="w-56 border-r border-border/50 flex-shrink-0 flex flex-col">
          <div className="p-3 border-b border-border/50">
            <input
              type="text"
              placeholder="Filter files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 px-2 text-sm bg-muted/30 border border-border/50 rounded"
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="py-1">{filteredTree.map((node: any) => renderNode(node))}</div>
          </ScrollArea>
        </aside>

        {/* Main Content - Code Viewer */}
        <main className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search in file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchInFile()}
                className="h-7 px-2 text-sm bg-background border border-border/50 rounded w-48"
              />
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSearchInFile}>
                <Search className="h-3 w-3 mr-1" />
                Find
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {selectedLines.size > 0 && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={copySelectedLines}>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy {selectedLines.size} lines
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedLines(new Set())}>
                Clear
              </Button>
            </div>
          </div>

          {/* Code */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !file ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>File not found</p>
              </div>
            ) : (
              <div className="relative">
                <div
                  className="text-sm font-mono"
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                  style={{
                    paddingLeft: "60px",
                  }}
                />
                {/* Line numbers overlay */}
                <div className="absolute top-0 left-0 w-14 text-right font-mono text-xs text-muted-foreground select-none bg-background">
                  {lines.map((_, i) => {
                    const lineNum = startLine + i;
                    const isSelected = selectedLines.has(lineNum);
                    return (
                      <div
                        key={i}
                        data-line={lineNum}
                        className={`pr-2 h-[20px] leading-[20px] cursor-pointer hover:bg-muted/50 transition-colors ${
                          isSelected ? "bg-primary/20" : ""
                        }`}
                        onMouseDown={() => handleLineMouseDown(lineNum)}
                        onClick={() => handleLineClick(lineNum)}
                      >
                        {lineNum}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ScrollArea>
        </main>

        {/* Right sidebar - Line Info */}
        <aside className="w-56 border-l border-border/50 flex-shrink-0 flex flex-col">
          <div className="p-3 border-b border-border/50">
            <h3 className="text-xs font-medium">Selection</h3>
          </div>
          <div className="p-3 flex-1">
            {selectedLines.size === 0 ? (
              <p className="text-xs text-muted-foreground">
                Click or drag to select lines. Selection shows token count.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="text-xs">
                  <span className="font-medium">{selectedLines.size} lines selected</span>
                </div>
                {selectedLines.size > 1 && (
                  <div className="text-xs text-muted-foreground">
                    Lines {Math.min(...selectedLines)} - {Math.max(...selectedLines)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  ~{Math.round(selectedLines.size * 4)} tokens
                </div>
                <Button variant="outline" size="sm" className="w-full text-xs mt-2" onClick={copySelectedLines}>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            )}
          </div>

          {/* File Stats */}
          <div className="p-3 border-t border-border/50">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total lines</span>
                <span>{file?.lineCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total tokens</span>
                <span>{file?.tokenCount || 0}</span>
              </div>
              <Separator className="my-2" />
              <div className="text-xs text-muted-foreground">
                Jump to line:{" "}
                <input
                  type="number"
                  min={1}
                  max={file?.lineCount}
                  className="w-16 px-1 py-0.5 bg-background border border-border/50 rounded text-center"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const target = parseInt((e.target as HTMLInputElement).value);
                      if (target >= 1 && target <= (file?.lineCount || 0)) {
                        const element = document.querySelector(`[data-line="${target}"]`);
                        if (element) {
                          element.scrollIntoView({ behavior: "smooth", block: "center" });
                          element.classList.add("bg-primary/20");
                          setTimeout(() => element.classList.remove("bg-primary/20"), 2000);
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
