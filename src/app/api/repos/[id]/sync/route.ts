import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo } from '@/lib/supabase';
import { auth, unauthorized, notFound } from '@/lib/api';
import { syncRepo } from '@/lib/sync';

export const dynamic = 'force-dynamic';

// POST /api/repos/[id]/sync - Trigger manual sync
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!auth(request)) return unauthorized();

  const { id } = await params;
  const repoId = parseInt(id);
  if (isNaN(repoId)) {
    return notFound('Invalid repo ID');
  }

  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('id', repoId)
    .single();

  if (!repo) {
    return notFound('Repository not found');
  }

  // Trigger sync in background
  syncRepo(repo.owner, repo.name).catch(console.error);

  return NextResponse.json({
    message: 'Sync started',
    full_name: repo.full_name,
  });
}
