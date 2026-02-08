"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, FileCode, GitBranch, Code, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { internalFetch } from "@/lib/api";

interface RepoStats {
  file_count: number;
  symbol_count: number;
  language: string | null;
  description: string | null;
}

const LUMINEX_REPO = {
  owner: "changcheng967",
  name: "Luminex",
  full_name: "changcheng967/Luminex"
};

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchStats();
    // Poll every 3 seconds if syncing
    const interval = setInterval(() => {
      if (syncing) fetchStats();
    }, 3000);
    return () => clearInterval(interval);
  }, [syncing]);

  const fetchStats = async () => {
    try {
      const res = await internalFetch(`/api/tree?repo=${LUMINEX_REPO.full_name}`);
      if (res.ok) {
        const json = await res.json();
        const repoInfo = json.data?.repo;
        const files = json.data?.files || [];
        const isSyncing = repoInfo?.syncing || false;
        setSyncing(isSyncing);
        setStats({
          file_count: repoInfo?.fileCount || files.length || 0,
          symbol_count: 0,
          language: "C++",
          description: "High-performance ML inference framework",
          syncing: isSyncing,
        } as RepoStats & { syncing?: boolean });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-6 w-6" />
            <h1 className="text-2xl font-bold">RepoBeam</h1>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/search")}
          >
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Luminex</h2>
          <p className="text-muted-foreground text-lg">
            High-performance ML inference framework
          </p>
        </div>

        <div className="flex justify-center">
          <Card className="w-full max-w-md hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/repo/${LUMINEX_REPO.owner}/${LUMINEX_REPO.name}`)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{LUMINEX_REPO.full_name}</CardTitle>
                {syncing && (
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {stats?.description && (
                <CardDescription>{stats.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-1">
                  <FileCode className="h-4 w-4" />
                  {loading ? "..." : `${stats?.file_count || 0} files`}
                </span>
                <span className="flex items-center gap-1">
                  <GitBranch className="h-4 w-4" />
                  {stats?.language || "C++"}
                </span>
              </div>
              <Button className="w-full">
                Browse Code
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>API: <code className="bg-muted px-2 py-1 rounded">GET /api/help</code> for documentation</p>
        </div>
      </main>
    </div>
  );
}
