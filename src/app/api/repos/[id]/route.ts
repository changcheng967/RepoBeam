import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { auth, unauthorized, notFound } from '@/lib/api';

export const dynamic = 'force-dynamic';

// DELETE /api/repos/[id] - Remove a repo and all its data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!auth(request)) return unauthorized();

  const { id } = await params;
  const repoId = parseInt(id);
  if (isNaN(repoId)) {
    return notFound('Invalid repo ID');
  }

  // Get file IDs to delete symbols
  const { data: files } = await supabase
    .from('files')
    .select('id')
    .eq('repo_id', repoId);

  if (files && files.length > 0) {
    const fileIds = files.map(f => f.id);

    // Delete symbols first (foreign key constraint)
    await supabase
      .from('symbols')
      .delete()
      .in('file_id', fileIds);
  }

  // Delete files
  await supabase
    .from('files')
    .delete()
    .eq('repo_id', repoId);

  // Delete repo
  const { error } = await supabase
    .from('repos')
    .delete()
    .eq('id', repoId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Repository deleted' });
}

// GET /api/repos/[id] - Get repo details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!auth(request)) return unauthorized();

  const { id } = await params;
  const repoId = parseInt(id);
  if (isNaN(repoId)) {
    return notFound('Invalid repo ID');
  }

  const { data: repo, error } = await supabase
    .from('repos')
    .select(`
      *,
      files:files(count),
      symbols:symbols(count)
    `)
    .eq('id', repoId)
    .single();

  if (error || !repo) {
    return notFound('Repository not found');
  }

  return NextResponse.json({
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    language: repo.language,
    last_synced_at: repo.last_synced_at,
    last_sha: repo.last_sha,
    file_count: (repo.files as any)?.[0]?.count || 0,
    symbol_count: (repo.symbols as any)?.[0]?.count || 0,
  });
}
