import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo } from '@/lib/supabase';
import { syncRepo } from '@/lib/sync';

export const dynamic = 'force-dynamic';

// GET /api/cron/sync
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all repos
  const { data: repos } = await supabase
    .from('repos')
    .select('*');

  if (!repos) {
    return NextResponse.json({ synced: 0, repos: [] });
  }

  const results = [];

  // Sync each repo
  for (const repo of repos) {
    try {
      await syncRepo(repo.owner, repo.name);
      results.push({
        full_name: repo.full_name,
        status: 'synced',
      });
    } catch (error) {
      results.push({
        full_name: repo.full_name,
        status: 'error',
        error: String(error),
      });
    }
  }

  return NextResponse.json({
    synced: repos.length,
    results,
  });
}
