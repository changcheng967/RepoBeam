"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, Home, FileCode, Copy, Search, Check,
  Code, Braces, Type, Component, Layers, Sparkles, ChevronRight, File, Link2, Loader2
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
}

interface Symbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
  signature: string | null;
}

const LANGUAGE_MAP: Record<string, string> = {
  javascript: "javascript", typescript: "typescript", tsx: "tsx", jsx: "jsx",
  python: "python", cpp: "cpp", c: "c", "c++": "cpp", go: "go", rust: "rust",
  java: "java", ruby: "ruby", php: "php", swift: "swift", kotlin: "kotlin",
  scala: "scala", shell: "bash", sh: "bash", html: "html", css: "css",
  json: "json", yaml: "yaml", yml: "yaml", markdown: "markdown", md: "markdown",
};

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

const getKindIcon = (kind: string) => {
  const icons: Record<string, any> = {
    function: Code, class: Component, struct: Layers,
    interface: Type, type: Braces, enum: Sparkles,
  };
  return icons[kind] || FileCode;
};

const getKindColor = (kind: string) => {
  const colors: Record<string, string> = {
    function: "text-blue-400", class: "text-green-400",
    struct: "text-yellow-400", interface: "text-purple-400",
    type: "text-pink-400", enum: "text-orange-400",
  };
  return colors[kind] || "text-muted-foreground";
};

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;

export default function FilePage() {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const name = params.name as string;
  const path = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");
  const repoName = `${owner}/${name}`;

  const [file, setFile] = useState<FileData | null>(null);
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<Symbol | null>(null);
  const [highlightedCode, setHighlightedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

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

  const initHighlighter = async () => {
    if (!highlighter) {
      highlighter = await createHighlighter({
        themes: ["github-dark-dimmed"],
        langs: [
          "javascript", "typescript", "tsx", "jsx", "python",
          "cpp", "c", "go", "rust", "java", "ruby", "php",
          "swift", "kotlin", "scala", "bash", "html", "css",
          "json", "yaml", "markdown"
        ],
      });
    }
  };

  const highlightCode = async (code: string, language: string | undefined) => {
    if (!highlighter) {
      setHighlightedCode(escapeHtml(code));
      return;
    }
    const lang = (language && LANGUAGE_MAP[language.toLowerCase()]) || "text";
    try {
      const html = highlighter.codeToHtml(code, {
        lang,
        theme: "github-dark-dimmed"
      });
      setHighlightedCode(html);
    } catch {
      setHighlightedCode(escapeHtml(code));
    }
  };

  const escapeHtml = (text: string) => {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fileRes, symbolsRes] = await Promise.all([
        internalFetch(`/api/file?repo=${encodeURIComponent(repoName)}&path=${encodeURIComponent(path)}`),
        internalFetch(`/api/symbols?repo=${encodeURIComponent(repoName)}&path=${encodeURIComponent(path)}`),
      ]);

      if (fileRes.ok) {
        const fileData = await fileRes.json();
        setFile(fileData.data);
      }

      if (symbolsRes.ok) {
        const symbolsData = await symbolsRes.json();
        setSymbols(symbolsData.data || []);

        // If no symbols exist, trigger extraction
        if (!symbolsData.data || symbolsData.data.length === 0) {
          extractSymbols();
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const extractSymbols = async () => {
    setExtracting(true);
    try {
      const res = await internalFetch(
        `/api/symbols/extract?repo=${encodeURIComponent(repoName)}&path=${encodeURIComponent(path)}`,
        { method: 'POST' }
      );
      if (res.ok) {
        const data = await res.json();
        setSymbols(data.symbols || []);
      }
    } catch (error) {
      console.error("Failed to extract symbols:", error);
    } finally {
      setExtracting(false);
    }
  };

  const fetchFileTree = async () => {
    try {
      const res = await internalFetch(`/api/tree?repo=${encodeURIComponent(repoName)}`);
      if (res.ok) {
        const data = await res.json();
        const fileList = data.data?.files || data.data || [];
        setFiles(fileList);
        // Auto-expand root folders
        const rootFolders = fileList
          .map((f: any) => f.path.split("/")[0])
          .filter((p: string, i: number, arr: string[]) => arr.indexOf(p) === i && p.includes("/"));
        setExpandedFolders(new Set(rootFolders));
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  };

  const selectSymbol = async (symbol: Symbol) => {
    try {
      const res = await internalFetch(
        `/api/function?repo=${encodeURIComponent(repoName)}&path=${encodeURIComponent(path)}&name=${symbol.name}`
      );
      if (res.ok) {
        const data = await res.json();
        setFile(data.data);
        setSelectedSymbol(symbol);
      }
    } catch (error) {
      console.error("Failed to fetch function:", error);
    }
  };

  const copyCode = () => {
    if (file?.content) {
      navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyApiUrl = (symbol: Symbol) => {
    const url = `${window.location.origin}/api/function?repo=${repoName}&path=${path}&name=${symbol.name}`;
    navigator.clipboard.writeText(url);
  };

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

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const renderNode = (node: any, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
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

  // Group symbols by kind
  const symbolsByKind = useMemo(() => {
    const groups: Record<string, Symbol[]> = {};
    for (const sym of symbols) {
      if (!groups[sym.kind]) groups[sym.kind] = [];
      groups[sym.kind].push(sym);
    }
    return groups;
  }, [symbols]);

  const displayContent = selectedSymbol ? file : file;
  const displayLines = displayContent?.content.split("\n") || [];
  const startLine = selectedSymbol ? file?.startLine || 1 : 1;

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
              <span className="font-mono text-muted-foreground">{owner}</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-mono text-muted-foreground">{name}</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-mono truncate max-w-[200px]">{path}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{file?.language || "Unknown"}</Badge>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyCode}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </header>

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - File tree */}
        <aside className="w-60 border-r border-border/50 flex-shrink-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="py-1">{tree.map((node: any) => renderNode(node))}</div>
          </ScrollArea>
        </aside>

        {/* Center - Code viewer */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* File info bar */}
          <div className="border-b border-border/50 px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
            <span>Lines {displayContent?.startLine || 1}-{displayContent?.endLine || displayLines.length}</span>
            <Separator orientation="vertical" className="h-3" />
            <span>{Math.ceil((displayContent?.content?.length || 0) / 4).toLocaleString()} tokens</span>
            {selectedSymbol && (
              <>
                <Separator orientation="vertical" className="h-3" />
                <span className="text-warning">Viewing: {selectedSymbol.name}</span>
                <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => setSelectedSymbol(null)}>
                  Show full file
                </Button>
              </>
            )}
          </div>

          {/* Code */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <div className="px-4 py-3">
                <div
                  className="text-sm font-mono leading-6"
                  style={{ color: "#e4e4e7" }}
                  dangerouslySetInnerHTML={{
                    __html: highlightedCode || displayLines
                      .map((line, i) => `<div class="flex hover:bg-muted/30"><span class="w-12 text-right pr-4 text-muted-foreground select-none">${startLine + i}</span><span class="flex-1">${escapeHtml(line) || " "}</span></div>`)
                      .join("")
                  }}
                />
              </div>
            )}
          </ScrollArea>
        </main>

        {/* Right sidebar - Symbols */}
        <aside className="w-56 border-l border-border/50 flex-shrink-0 flex flex-col">
          <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
            <span className="text-xs font-medium">Symbols ({symbols.length})</span>
            {extracting && <Loader2 className="h-3 w-3 text-primary animate-spin" />}
          </div>
          <ScrollArea className="flex-1">
            {extracting ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
                <p className="text-xs text-muted-foreground">Extracting with AI...</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">This may take a moment</p>
              </div>
            ) : symbols.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Sparkles className="h-7 w-7 text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">No symbols found</p>
                <button
                  onClick={extractSymbols}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Extract with AI
                </button>
              </div>
            ) : (
              <div className="py-1">
                {Object.entries(symbolsByKind).map(([kind, syms]) => (
                  <div key={kind}>
                    <div className="px-3 py-1 text-xs text-muted-foreground/70 uppercase tracking-wide">
                      {kind}s ({syms.length})
                    </div>
                    {syms.map((sym, i) => {
                      const Icon = getKindIcon(sym.kind);
                      return (
                        <div
                          key={i}
                          className={`px-3 py-1.5 hover:bg-muted/50 cursor-pointer text-sm flex items-center gap-2 ${
                            selectedSymbol?.name === sym.name ? "bg-muted/70" : ""
                          }`}
                          onClick={() => selectSymbol(sym)}
                        >
                          <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${getKindColor(sym.kind)}`} />
                          <span className="flex-1 truncate text-muted-foreground">{sym.name}</span>
                          <span className="text-[10px] text-muted-foreground/70">{sym.tokenCount}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
