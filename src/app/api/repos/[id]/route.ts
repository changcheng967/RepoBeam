import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo } from '@/lib/supabase';
import { auth, unauthorized, notFound } from '@/lib/api';
import { syncRepo } from '@/lib/sync';

export const dynamic = 'force-dynamic';

// DELETE /api/repos/[id] - Remove a repo
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

  const { error } = await supabase
    .from('repos')
    .delete()
    .eq('id', repoId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Repository deleted' });
}
