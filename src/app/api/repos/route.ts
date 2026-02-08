import { NextRequest, NextResponse } from 'next/server';
import { supabase, Repo, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';
import { syncRepo } from '@/lib/sync';

export const dynamic = 'force-dynamic';

// GET /api/repos - List all repos
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { data: repos, error } = await supabase
    .from('repos')
    .select(`
      *,
      files:files(count),
      symbols:symbols(count)
    `);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reposWithStats = repos?.map(repo => ({
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    language: repo.language,
    last_synced_at: repo.last_synced_at,
    file_count: (repo.files as any)?.[0]?.count || 0,
    symbol_count: (repo.symbols as any)?.[0]?.count || 0,
  })) || [];

  return NextResponse.json(createResponse(reposWithStats, 100));
}

// POST /api/repos - Add a new repo
export async function POST(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  try {
    const body = await request.json();
    const { owner, name } = body;

    if (!owner || !name) {
      return badRequest('owner and name are required');
    }

    // Check if repo already exists
    const { data: existing } = await supabase
      .from('repos')
      .select('*')
      .eq('full_name', `${owner}/${name}`)
      .single();

    if (existing) {
      return NextResponse.json(
        createResponse(existing, 50),
        { status: 409 }
      );
    }

    // Trigger sync in background
    syncRepo(owner, name).catch(console.error);

    return NextResponse.json(
      createResponse(
        { message: 'Repository added, indexing in progress', full_name: `${owner}/${name}` },
        30
      ),
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
