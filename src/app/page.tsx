"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, GitBranch, FileCode, Database } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

interface Repo {
  id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  last_synced_at: string | null;
  file_count: number;
  symbol_count: number;
}

export default function HomePage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [newOwner, setNewOwner] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    try {
      const res = await fetch("/api/repos", {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY || ""}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRepos(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch repos:", error);
    } finally {
      setLoading(false);
    }
  };

  const addRepo = async () => {
    if (!newOwner || !newName) return;

    setAdding(true);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY || ""}`,
        },
        body: JSON.stringify({ owner: newOwner, name: newName }),
      });

      if (res.ok) {
        setAddRepoOpen(false);
        setNewOwner("");
        setNewName("");
        fetchRepos();
      }
    } catch (error) {
      console.error("Failed to add repo:", error);
    } finally {
      setAdding(false);
    }
  };

  const deleteRepo = async (id: number) => {
    try {
      await fetch(`/api/repos/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY || ""}`,
        },
      });
      fetchRepos();
    } catch (error) {
      console.error("Failed to delete repo:", error);
    }
  };

  const syncRepo = async (id: number) => {
    try {
      await fetch(`/api/repos/${id}/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY || ""}`,
        },
      });
      fetchRepos();
    } catch (error) {
      console.error("Failed to sync repo:", error);
    }
  };

  const filteredRepos = repos.filter(
    (repo) =>
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            <h1 className="text-2xl font-bold">RepoBeam</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/search")}
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Dialog open={addRepoOpen} onOpenChange={setAddRepoOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Repo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Repository</DialogTitle>
                  <DialogDescription>
                    Enter the GitHub repository to index
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium">Owner</label>
                    <Input
                      placeholder="e.g. facebook"
                      value={newOwner}
                      onChange={(e) => setNewOwner(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Repository Name</label>
                    <Input
                      placeholder="e.g. react"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={addRepo} disabled={adding || !newOwner || !newName}>
                    {adding ? "Adding..." : "Add Repository"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No repositories found. Add one to get started.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredRepos.map((repo) => (
              <Card key={repo.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{repo.full_name}</CardTitle>
                  {repo.description && (
                    <CardDescription className="line-clamp-2">
                      {repo.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <FileCode className="h-3 w-3" />
                        {repo.language}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <FileCode className="h-3 w-3" />
                      {repo.file_count} files
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {repo.symbol_count} symbols
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const [owner, name] = repo.full_name.split("/");
                        router.push(`/repo/${owner}/${name}`);
                      }}
                    >
                      Browse
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncRepo(repo.id)}
                    >
                      <GitBranch className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRepo(repo.id)}
                    >
                      ×
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
