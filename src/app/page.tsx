"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileCode, GitBranch, RefreshCw, Settings, Plus, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { internalFetch } from "@/lib/api";

const LUMINEX_REPO = {
  owner: "changcheng967",
  name: "Luminex",
  full_name: "changcheng967/Luminex",
  description: "High-performance ML inference framework",
  language: "C++"
};

interface RepoStats {
  file_count: number;
  syncing?: boolean;
  lastSynced?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await internalFetch(`/api/tree?repo=${LUMINEX_REPO.full_name}`);
      if (res.ok) {
        const json = await res.json();
        const repoInfo = json.data?.repo;
        const files = json.data?.files || [];
        setStats({
          file_count: repoInfo?.fileCount || files.length || 0,
          syncing: repoInfo?.syncing || false,
          lastSynced: repoInfo?.lastSynced || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const isStale = stats?.lastSynced
    ? Date.now() - new Date(stats.lastSynced).getTime() > 24 * 60 * 60 * 1000
    : false;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold tracking-tight">RepoBeam</h1>
            <nav className="hidden sm:flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground/70 hover:text-foreground"
                onClick={() => router.push("/")}
              >
                Repos
              </Button>
            </nav>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code, symbols..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-muted/50 border-border/50 text-sm"
              />
            </div>
          </form>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Repo Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Main Repo Card */}
          <Card
            className="group cursor-pointer border-border/50 hover:border-border transition-colors"
            onClick={() => router.push(`/repo/${LUMINEX_REPO.owner}/${LUMINEX_REPO.name}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-mono text-sm font-medium truncate">{LUMINEX_REPO.full_name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{LUMINEX_REPO.description}</p>
                </div>
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ml-2 ${
                  stats?.syncing ? "bg-warning animate-pulse" : isStale ? "bg-warning" : "bg-success"
                }`} />
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5" />
                  {loading ? "..." : `${stats?.file_count || 0} files`}
                </span>
                <span className="flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" />
                  {LUMINEX_REPO.language}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {stats?.lastSynced
                    ? `Synced ${Math.floor((Date.now() - new Date(stats.lastSynced).getTime()) / 60000)}m ago`
                    : "Not synced"}
                </span>
                {stats?.syncing && <RefreshCw className="h-3 w-3 text-warning animate-spin ml-auto" />}
              </div>
            </CardContent>
          </Card>

          {/* Add Repo Card */}
          <Card className="border-dashed border-border/50 hover:border-border transition-colors flex items-center justify-center">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full min-h-[140px]">
              <Plus className="h-5 w-5 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Add Repository</span>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
