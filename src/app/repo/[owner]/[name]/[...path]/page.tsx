"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft, Home, FileCode, Copy, Search, Check,
  Code, Braces, Type, Component, Layers, Sparkles
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
  javascript: "javascript",
  typescript: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  python: "python",
  cpp: "cpp",
  c: "c",
  "c++": "cpp",
  go: "go",
  rust: "rust",
  java: "java",
  ruby: "ruby",
  php: "php",
  swift: "swift",
  kotlin: "kotlin",
  scala: "scala",
  shell: "bash",
  sh: "bash",
  html: "html",
  css: "css",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  markdown: "markdown",
  md: "markdown",
};

const getKindIcon = (kind: string) => {
  const icons: Record<string, any> = {
    function: Code,
    class: Component,
    struct: Layers,
    interface: Type,
    type: Braces,
    enum: Sparkles,
  };
  return icons[kind] || FileCode;
};

const getKindColor = (kind: string) => {
  const colors: Record<string, string> = {
    function: "text-blue-500 bg-blue-500/10",
    class: "text-green-500 bg-green-500/10",
    struct: "text-yellow-500 bg-yellow-500/10",
    interface: "text-purple-500 bg-purple-500/10",
    type: "text-pink-500 bg-pink-500/10",
    enum: "text-orange-500 bg-orange-500/10",
  };
  return colors[kind] || "text-gray-500 bg-gray-500/10";
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
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<Symbol | null>(null);
  const [highlightedCode, setHighlightedCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
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
        themes: ["github-dark"],
        langs: [
          "javascript", "typescript", "tsx", "jsx", "python",
          "cpp", "c", "go", "rust", "java", "ruby", "php",
          "swift", "kotlin", "scala", "bash", "html", "css",
          "json", "yaml", "markdown"
        ],
      });
    }
  };

  const highlightCode = async (code: string, language: string) => {
    if (!highlighter) {
      setHighlightedCode(escapeHtml(code));
      return;
    }

    const lang = (LANGUAGE_MAP[language.toLowerCase()] || "text") as any;
    try {
      const html = highlighter.codeToHtml(code, {
        lang,
        theme: "github-dark"
      });
      setHighlightedCode(html);
    } catch {
      setHighlightedCode(escapeHtml(code));
    }
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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
        setSymbols(symbolsData.data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
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
    setCopiedSymbol(symbol.name);
    setTimeout(() => setCopiedSymbol(null), 2000);
  };

  const getFileLines = () => {
    if (!file) return [];
    return file.content.split("\n");
  };

  const displayFile = selectedSymbol ? file : file;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
            >
              <Home className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
              <span className="font-medium truncate">{owner}</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium truncate">{name}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground truncate max-w-[200px] sm:max-w-md">{path}</span>
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
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileCode className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <p className="text-muted-foreground">Loading file...</p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="file" className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="file" className="gap-2">
                  <Code className="h-4 w-4" />
                  File
                </TabsTrigger>
                <TabsTrigger value="symbols" className="gap-2">
                  <Braces className="h-4 w-4" />
                  Symbols ({symbols.length})
                </TabsTrigger>
              </TabsList>
              {selectedSymbol && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedSymbol(null);
                    if (file) highlightCode(file.content, file.language);
                  }}
                >
                  Show full file
                </Button>
              )}
            </div>

            <TabsContent value="file" className="mt-0 animate-fade-in">
              {displayFile && (
                <Card className="overflow-hidden border-2">
                  {/* File header */}
                  <div className="bg-muted/50 px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                        <FileCode className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{displayFile.path.split("/").pop()}</h3>
                        <p className="text-xs text-muted-foreground">
                          {displayFile.language} · Lines {displayFile.startLine}-{displayFile.endLine} ·
                          <span className="ml-1 text-primary">
                            {Math.ceil(displayFile.content.length / 4).toLocaleString()} tokens
                          </span>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyCode}
                      className="gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Code content */}
                  <div className="overflow-x-auto scrollbar-thin">
                    <div
                      className="p-6 text-sm bg-[#0d1117]"
                      dangerouslySetInnerHTML={{ __html: highlightedCode || `<pre class="shiki"><code>${escapeHtml(displayFile.content || "").split("\n").map((line, i) => `<div class="line"><span class="line-number">${displayFile.startLine + i}</span><span>${line || " "}</span></div>`).join("")}</code></pre>` }}
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                      }}
                    />
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="symbols" className="mt-0 animate-fade-in">
              <Card>
                <CardContent className="p-0">
                  {symbols.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <Braces className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">No symbols found</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        This file may not contain any parseable symbols
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {symbols.map((symbol, i) => {
                        const Icon = getKindIcon(symbol.kind);
                        const colorClass = getKindColor(symbol.kind);
                        return (
                          <div
                            key={i}
                            className="p-4 hover:bg-muted/50 cursor-pointer flex items-center justify-between group transition-colors"
                            onClick={() => selectSymbol(symbol)}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`h-10 w-10 rounded-lg ${colorClass.split(" ")[1]} flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`h-5 w-5 ${colorClass.split(" ")[0]}`} />
                              </div>
                              <div>
                                <div className="font-medium">{symbol.name}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                  <span className="capitalize">{symbol.kind}</span>
                                  <span>·</span>
                                  <span>Lines {symbol.startLine}-{symbol.endLine}</span>
                                  <span>·</span>
                                  <span>{symbol.tokenCount} tokens</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyApiUrl(symbol);
                              }}
                            >
                              {copiedSymbol === symbol.name ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
