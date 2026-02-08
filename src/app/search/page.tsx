"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Search, FileText, FileCode, Home } from "lucide-react";
import { internalFetch } from "@/lib/api";

interface SearchResult {
  path: string;
  line: number;
  snippet: string;
}

interface SymbolResult {
  name: string;
  kind: string;
  path: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
}

const LUMINEX_REPO = "changcheng967/Luminex";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [symbols, setSymbols] = useState<SymbolResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "symbols">("code");

  const search = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      if (activeTab === "code") {
        const res = await internalFetch(
          `/api/search?repo=${LUMINEX_REPO}&q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.data);
        }
      } else {
        const res = await internalFetch(
          `/api/symbols/search?repo=${LUMINEX_REPO}&q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSymbols(data.data);
        }
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
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
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <Home className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Search Luminex</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-4 mb-8">
          <div className="flex gap-2">
            <Input
              placeholder="Search query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="flex-1"
            />
            <Button onClick={search} disabled={loading || !query.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant={activeTab === "code" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("code")}
            >
              <FileText className="h-4 w-4 mr-2" />
              Code
            </Button>
            <Button
              variant={activeTab === "symbols" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("symbols")}
            >
              <FileCode className="h-4 w-4 mr-2" />
              Symbols
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Searching...</div>
        ) : (
          <div className="space-y-2">
            {activeTab === "code" ? (
              results.length === 0 ? (
                query ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No results found
                  </div>
                ) : null
              ) : (
                results.map((result, i) => (
                  <Card key={i} className="hover:bg-muted/50 cursor-pointer" onClick={() => {
                    const [owner, name] = LUMINEX_REPO.split("/");
                    router.push(`/repo/${owner}/${name}/${result.path}`);
                  }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{result.path}</span>
                        <span className="text-xs text-muted-foreground">Line {result.line}</span>
                      </div>
                      <pre className="text-sm bg-muted p-2 rounded overflow-x-auto">
                        {result.snippet}
                      </pre>
                    </CardContent>
                  </Card>
                ))
              )
            ) : symbols.length === 0 ? (
              query ? (
                <div className="text-center py-12 text-muted-foreground">
                  No symbols found
                </div>
              ) : null
            ) : (
              symbols.map((symbol, i) => (
                <Card key={i} className="hover:bg-muted/50 cursor-pointer" onClick={() => {
                  const [owner, name] = LUMINEX_REPO.split("/");
                  router.push(`/repo/${owner}/${name}/${symbol.path}`);
                }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <FileCode className={`h-4 w-4 ${getKindColor(symbol.kind)}`} />
                      <div className="flex-1">
                        <div className="font-medium">{symbol.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {symbol.kind} · {symbol.path}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {symbol.tokenCount}t
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
