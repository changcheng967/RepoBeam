"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, FileCode, GitBranch, Code, ArrowRight,
  Zap, Github, Database, Sparkles, RefreshCw
} from "lucide-react";
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
}

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchStats();
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
          syncing: isSyncing,
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Browse code instantly with smart token-aware responses"
    },
    {
      icon: Search,
      title: "Powerful Search",
      description: "Search across symbols, functions, and full codebase"
    },
    {
      icon: Code,
      title: "LLM Optimized",
      description: "API designed for AI agents to consume code efficiently"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-lg" />
              <Code className="relative h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">RepoBeam</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/search")}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </Button>
            <Button
              size="sm"
              onClick={() => window.open("https://github.com/changcheng967/RepoBeam", "_blank")}
              className="gap-2"
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">GitHub</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative">
        <section className="container mx-auto px-6 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              LLM-Friendly Code Browser
            </div>

            <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              <span className="gradient-text">Explore Code</span>
              <br />
              <span className="text-foreground">Without Limits</span>
            </h2>

            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Browse, search, and navigate code repositories with an API designed for AI agents.
              No more truncated responses or token limits.
            </p>

            {/* Main Repo Card */}
            <div className="max-w-md mx-auto animate-slide-up">
              <Card
                className="group cursor-pointer border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10"
                onClick={() => router.push(`/repo/${LUMINEX_REPO.owner}/${LUMINEX_REPO.name}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        L
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-lg">{LUMINEX_REPO.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{LUMINEX_REPO.description}</p>
                      </div>
                    </div>
                    {syncing && (
                      <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                    <span className="flex items-center gap-1.5">
                      <FileCode className="h-4 w-4" />
                      {loading ? "..." : `${stats?.file_count || 0} files`}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <GitBranch className="h-4 w-4" />
                      {LUMINEX_REPO.language}
                    </span>
                  </div>

                  <Button className="w-full group/btn" size="lg">
                    Browse Code
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-6 py-20">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <Card
                key={feature.title}
                className="border-none bg-gradient-to-br from-card to-card/50 backdrop-blur animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* API CTA */}
        <section className="container mx-auto px-6 py-20">
          <Card className="max-w-3xl mx-auto bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20">
            <CardContent className="p-10 text-center">
              <Database className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-3">REST API for AI Agents</h3>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Every endpoint returns token counts and smart truncation hints.
                Perfect for LLMs that need to understand code structure.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <code className="px-4 py-2 rounded-lg bg-background border text-sm font-mono">
                  GET /api/help
                </code>
                <Button
                  variant="outline"
                  onClick={() => router.push("/api/help")}
                  className="gap-2"
                >
                  View Documentation
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-8 border-t">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>Built with Next.js, Supabase, and shadcn/ui</p>
            <p>© 2026 RepoBeam. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
