"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, FileCode, GitBranch, RefreshCw, Settings, Plus, Clock,
  Loader2, Trash2, X, Check, AlertCircle
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { internalFetch } from "@/lib/api";

interface Repo {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  last_synced_at: string | null;
  last_sha: string | null;
  syncing?: boolean;
  file_count?: number;
}

interface RepoStats {
  [key: string]: {
    syncing: boolean;
    filesIndexed: number;
    error?: string;
  };
}

export default function HomePage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [stats, setStats] = useState<RepoStats>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ owner: "", name: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [syncingRepo, setSyncingRepo] = useState<string | null>(null);
  const [deletingRepo, setDeletingRepo] = useState<number | null>(null);

  const fetchRepos = useCallback(async () => {
    try {
      const res = await internalFetch("/api/repos");
      if (res.ok) {
        const json = await res.json();
        const repoList = json.data || [];
        setRepos(repoList);

        // Fetch stats for each repo
        for (const repo of repoList) {
          try {
            const syncRes = await internalFetch(`/api/sync?repo=${encodeURIComponent(repo.full_name)}`);
            if (syncRes.ok) {
              const syncJson = await syncRes.json();
              setStats(prev => ({
                ...prev,
                [repo.full_name]: {
                  syncing: syncJson.data?.currentlySyncing || false,
                  filesIndexed: syncJson.data?.filesIndexed || 0,
                  error: syncJson.data?.syncError,
                },
              }));
            }
          } catch (e) {
            console.error("Failed to fetch sync status:", e);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch repos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepos();
    // Poll for sync status every 5 seconds
    const interval = setInterval(() => {
      if (repos.some(r => stats[r.full_name]?.syncing)) {
        fetchRepos();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [repos, fetchRepos, stats]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.owner || !addForm.name) return;

    setAdding(true);
    setAddError(null);

    try {
      const res = await internalFetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: addForm.owner.trim(),
          name: addForm.name.trim(),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const newRepo = json.data;
        setRepos(prev => [...prev, newRepo]);
        setAddForm({ owner: "", name: "" });
        setShowAddDialog(false);

        // Start polling for sync status
        setStats(prev => ({
          ...prev,
          [newRepo.full_name]: { syncing: true, filesIndexed: 0 },
        }));

        // Refresh after a delay
        setTimeout(() => fetchRepos(), 2000);
      } else {
        const error = await res.json();
        setAddError(error.error || "Failed to add repository");
      }
    } catch (error) {
      console.error("Failed to add repo:", error);
      setAddError("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleSync = async (repo: Repo) => {
    setSyncingRepo(repo.full_name);
    try {
      const res = await internalFetch(`/api/repos/${repo.id}/sync`, { method: "POST" });
      if (res.ok) {
        setStats(prev => ({
          ...prev,
          [repo.full_name]: { syncing: true, filesIndexed: prev[repo.full_name]?.filesIndexed || 0 },
        }));
        setTimeout(() => fetchRepos(), 2000);
      }
    } catch (error) {
      console.error("Failed to sync:", error);
    } finally {
      setSyncingRepo(null);
    }
  };

  const handleDelete = async (repo: Repo) => {
    if (!confirm(`Delete ${repo.full_name}? This will remove all indexed data.`)) return;

    setDeletingRepo(repo.id);
    try {
      const res = await internalFetch(`/api/repos/${repo.id}`, { method: "DELETE" });
      if (res.ok) {
        setRepos(prev => prev.filter(r => r.id !== repo.id));
        setStats(prev => {
          const next = { ...prev };
          delete next[repo.full_name];
          return next;
        });
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeletingRepo(null);
    }
  };

  const isStale = (repo: Repo) => {
    if (!repo.last_synced_at) return true;
    return Date.now() - new Date(repo.last_synced_at).getTime() > 24 * 60 * 60 * 1000;
  };

  const filteredRepos = repos.filter(repo =>
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground/70 hover:text-foreground"
                onClick={() => router.push("/search")}
              >
                Search
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
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Repo
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : repos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileCode className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2">No repositories yet</h2>
            <p className="text-sm text-muted-foreground mb-4">Add a GitHub repository to get started</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Repository
            </Button>
          </div>
        ) : (
          <>
            {/* Stats Bar */}
            <div className="flex items-center gap-4 mb-6 text-sm">
              <span className="text-muted-foreground">{repos.length} repositories</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                {Object.values(stats).reduce((sum, s) => sum + s.filesIndexed, 0).toLocaleString()} files indexed
              </span>
              {Object.values(stats).some(s => s.syncing) && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="flex items-center gap-1.5 text-warning">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Syncing...
                  </span>
                </>
              )}
            </div>

            {/* Repo Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRepos.map((repo) => {
                const repoStats = stats[repo.full_name];
                const isSyncing = repoStats?.syncing || syncingRepo === repo.full_name;
                const isRepoStale = isStale(repo);
                const hasError = repoStats?.error;

                return (
                  <Card
                    key={repo.id}
                    className="group border-border/50 hover:border-border transition-colors"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => router.push(`/repo/${repo.owner}/${repo.name}`)}
                        >
                          <h3 className="font-mono text-sm font-medium truncate">{repo.full_name}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {repo.description || "No description"}
                          </p>
                        </div>
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ml-2 ${
                          hasError ? "bg-destructive" :
                          isSyncing ? "bg-warning animate-pulse" :
                          isRepoStale ? "bg-warning" : "bg-success"
                        }`} />
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1.5">
                          <FileCode className="h-3.5 w-3.5" />
                          {repoStats?.filesIndexed || 0} files
                        </span>
                        {repo.language && (
                          <span className="flex items-center gap-1.5">
                            <GitBranch className="h-3.5 w-3.5" />
                            {repo.language}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground flex-1">
                          {repo.last_synced_at
                            ? `Synced ${Math.floor((Date.now() - new Date(repo.last_synced_at!).getTime()) / 60000)}m ago`
                            : "Not synced"}
                        </span>
                        {hasError && (
                          <div className="relative group">
                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-xs text-popover-foreground rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">
                              {repoStats.error}
                            </div>
                          </div>
                        )}
                        {isSyncing && <RefreshCw className="h-3.5 w-3.5 text-warning animate-spin" />}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleSync(repo)}
                          disabled={isSyncing}
                        >
                          <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive ml-auto"
                          onClick={() => handleDelete(repo)}
                          disabled={deletingRepo === repo.id}
                        >
                          {deletingRepo === repo.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add Repo Card */}
              <Card
                className="border-dashed border-border/50 hover:border-border transition-colors cursor-pointer"
                onClick={() => setShowAddDialog(true)}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full min-h-[160px]">
                  <Plus className="h-5 w-5 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Add Repository</span>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      {/* Add Repo Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Add Repository</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowAddDialog(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleAddRepo} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Repository</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="owner"
                      value={addForm.owner}
                      onChange={(e) => setAddForm({ ...addForm, owner: e.target.value })}
                      className="flex-1"
                      autoFocus
                    />
                    <span className="flex items-center text-muted-foreground">/</span>
                    <Input
                      placeholder="name"
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Example: facebook / react
                  </p>
                </div>

                {addError && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-destructive">{addError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                    disabled={adding}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={adding || !addForm.owner || !addForm.name}>
                    {adding ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Repo
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
