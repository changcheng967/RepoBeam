import { NextRequest, NextResponse } from 'next/server';
import { supabase, createResponse } from '@/lib/supabase';
import { auth, unauthorized, badRequest, parseRepoParam } from '@/lib/api';
import { syncRepo } from '@/lib/sync';
import { getTree } from '@/lib/github';

export const dynamic = 'force-dynamic';

// In-memory sync status (for simple tracking)
const syncStatus = new Map<string, {
  syncing: boolean;
  startedAt?: string;
  filesIndexed: number;
  totalFiles?: number;
  error?: string;
}>();

// GET /api/sync?repo=owner/name - get sync status
export async function GET(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  const fullName = `${repo.owner}/${repo.name}`;

  // Get repo from database
  const { data: repoData } = await supabase
    .from('repos')
    .select('*')
    .eq('full_name', fullName)
    .single();

  if (!repoData) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  // Get file count
  const { count } = await supabase
    .from('files')
    .select('*', { count: 'exact', head: true })
    .eq('repo_id', repoData.id);

  const status = syncStatus.get(fullName) || { syncing: false, filesIndexed: count || 0 };

  return NextResponse.json(createResponse({
    repo: fullName,
    inDatabase: !!repoData,
    lastSyncedAt: repoData.last_synced_at,
    lastSha: repoData.last_sha,
    filesIndexed: count || 0,
    currentlySyncing: status.syncing,
    syncStartedAt: status.startedAt,
    syncError: status.error,
  }, 50));
}

// POST /api/sync?repo=owner/name&force=true - trigger sync
export async function POST(request: NextRequest) {
  if (!auth(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get('repo');
  const force = searchParams.get('force') === 'true';

  const repo = parseRepoParam(repoParam);
  if (!repo) {
    return badRequest('Invalid repo parameter');
  }

  if (!process.env.GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500 });
  }

  const fullName = `${repo.owner}/${repo.name}`;

  // Check if already syncing
  const currentStatus = syncStatus.get(fullName);
  if (currentStatus?.syncing) {
    return NextResponse.json(createResponse({
      message: 'Sync already in progress',
      startedAt: currentStatus.startedAt,
      filesIndexed: currentStatus.filesIndexed,
    }, 50));
  }

  // Get repo from database
  const { data: repoData } = await supabase
    .from('repos')
    .select('*')
    .eq('full_name', fullName)
    .single();

  if (!repoData && !force) {
    return NextResponse.json({ error: 'Repository not found. Use ?force=true to create and sync.' }, { status: 404 });
  }

  // Get file tree for progress tracking
  let totalFiles = 0;
  try {
    const tree = await getTree(repo.owner, repo.name);
    // GitHub tree API returns "type": "blob" for files
    totalFiles = tree.filter(item => item.type === 'blob' && item.path.match(/\.(c|cpp|cc|cxx|h|hpp|py|js|jsx|ts|tsx|rs|go|java|kt|cs|php|rb|swift|scala|sh)$/i)).length;
  } catch (e) {
    console.error('Failed to get tree for progress:', e);
  }

  // Set syncing status
  syncStatus.set(fullName, {
    syncing: true,
    startedAt: new Date().toISOString(),
    filesIndexed: 0,
    totalFiles,
  });

  // Trigger sync in background
  syncRepo(repo.owner, repo.name, force)
    .then(() => {
      const status = syncStatus.get(fullName);
      syncStatus.set(fullName, {
        syncing: false,
        filesIndexed: status?.totalFiles || 0,
      });
    })
    .catch((error) => {
      console.error(`Sync failed for ${fullName}:`, error);
      const status = syncStatus.get(fullName);
      syncStatus.set(fullName, {
        syncing: false,
        filesIndexed: status?.filesIndexed || 0,
        error: error.message,
      });
    });

  return NextResponse.json(createResponse({
    message: 'Sync started',
    repo: fullName,
    totalFiles,
  }, 50));
}
