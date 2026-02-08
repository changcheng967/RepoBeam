import { NextRequest, NextResponse } from 'next/server';
import { supabase, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest } from '@/lib/api';
import { syncRepo } from '@/lib/sync';
import { getRepo } from '@/lib/github';

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
    `)
    .order('last_synced_at', { ascending: false, nullsFirst: false });

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
    last_sha: repo.last_sha,
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

    const fullName = `${owner}/${name}`;

    // Check if repo already exists
    const { data: existing } = await supabase
      .from('repos')
      .select('*')
      .eq('full_name', fullName)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Repository already exists' },
        { status: 409 }
      );
    }

    // Verify repo exists on GitHub
    let ghRepo;
    try {
      ghRepo = await getRepo(owner, name);
    } catch (error) {
      return NextResponse.json(
        { error: 'Repository not found on GitHub or is private' },
        { status: 404 }
      );
    }

    // Create repo in database
    const { data: newRepo, error: createError } = await supabase
      .from('repos')
      .insert({
        owner,
        name,
        full_name: fullName,
        description: ghRepo.description,
        language: ghRepo.language,
        last_sha: null,
        last_synced_at: null,
      })
      .select()
      .single();

    if (createError || !newRepo) {
      return NextResponse.json(
        { error: createError?.message || 'Failed to create repository' },
        { status: 500 }
      );
    }

    // Trigger sync in background
    syncRepo(owner, name).catch(console.error);

    return NextResponse.json(
      createResponse({
        id: newRepo.id,
        owner: newRepo.owner,
        name: newRepo.name,
        full_name: newRepo.full_name,
        description: newRepo.description,
        language: newRepo.language,
        last_synced_at: newRepo.last_synced_at,
        last_sha: newRepo.last_sha,
      }, 50),
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
