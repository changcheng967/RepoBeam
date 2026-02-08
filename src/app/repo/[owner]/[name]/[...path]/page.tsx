"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Home, FileCode, Copy, Search } from "lucide-react";

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

  useEffect(() => {
    fetchData();
  }, [owner, name, path]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fileRes, symbolsRes] = await Promise.all([
        fetch(`/api/file?repo=${encodeURIComponent(repoName)}&path=${encodeURIComponent(path)}`, {
          headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY || ""}` },
        }),
        fetch(`/api/symbols?repo=${encodeURIComponent(repoName)}&path=${encodeURIComponent(path)}`, {
          headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY || ""}` },
        }),
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
      const res = await fetch(
        `/api/function?repo=${encodeURIComponent(repoName)}&path=${encodeURIComponent(path)}&name=${symbol.name}`,
        {
          headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY || ""}` },
        }
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

  const copyApiUrl = (symbol: Symbol) => {
    const url = `${window.location.origin}/api/function?repo=${repoName}&path=${path}&name=${symbol.name}`;
    navigator.clipboard.writeText(url);
  };

  const getFileLines = () => {
    if (!file) return [];
    return file.content.split("\n");
  };

  const getKindColor = (kind: string) => {
    const colors: Record<string, string> = {
      function: "text-blue-500",
      class: "text-green-500",
      struct: "text-yellow-500",
      interface: "text-purple-500",
      type: "text-pink-500",
      enum: "text-orange-500",
    };
    return colors[kind] || "text-gray-500";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <Home className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{owner}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{name}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground truncate max-w-md">{path}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/search")}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <Tabs defaultValue="file" className="w-full">
            <TabsList>
              <TabsTrigger value="file">File</TabsTrigger>
              <TabsTrigger value="symbols">
                Symbols ({symbols.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-4">
              {file && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b flex items-center justify-between">
                    <span className="text-sm font-medium">{file.path}</span>
                    <span className="text-xs text-muted-foreground">
                      Lines {file.startLine}-{file.endLine} · {file.language}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <pre className="p-4 text-sm bg-card">
                      {getFileLines().map((line, i) => (
                        <div key={i} className="hover:bg-muted/50">
                          <span className="inline-block w-12 text-right text-muted-foreground select-none mr-4">
                            {file.startLine + i}
                          </span>
                          <span>{line || " "}</span>
                        </div>
                      ))}
                    </pre>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="symbols" className="mt-4">
              <div className="border rounded-lg divide-y">
                {symbols.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No symbols found
                  </div>
                ) : (
                  symbols.map((symbol, i) => (
                    <div
                      key={i}
                      className="p-4 hover:bg-muted/50 cursor-pointer flex items-center justify-between group"
                      onClick={() => selectSymbol(symbol)}
                    >
                      <div className="flex items-center gap-3">
                        <FileCode className={`h-4 w-4 ${getKindColor(symbol.kind)}`} />
                        <div>
                          <div className="font-medium">{symbol.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {symbol.kind} · Lines {symbol.startLine}-{symbol.endLine} · {symbol.tokenCount} tokens
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyApiUrl(symbol);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
