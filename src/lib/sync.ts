import { supabase, estimateTokens } from './supabase';
import { getRepo, getTree, getFileContent, getLatestCommit } from './github';
import { detectLanguage, countLines } from './parser';

// Supported source code extensions for indexing
const SOURCE_EXTENSIONS = [
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
  '.py', '.js', '.jsx', '.ts', '.tsx',
  '.rs', '.go', '.java', '.kt', '.cs',
  '.php', '.rb', '.swift', '.scala', '.sh',
];

// Check if file should be indexed
function shouldIndex(path: string): boolean {
  const ext = path.substring(path.lastIndexOf('.'));
  return SOURCE_EXTENSIONS.includes(ext);
}

// Sync a repository
export async function syncRepo(owner: string, name: string, force = false): Promise<void> {
  try {
    // Check GitHub token
    if (!process.env.GITHUB_TOKEN) {
      console.error('GITHUB_TOKEN not set, skipping sync');
      return;
    }

    // Get or create repo
    const { data: existingRepo } = await supabase
      .from('repos')
      .select('*')
      .eq('full_name', `${owner}/${name}`)
      .single();

    let repo = existingRepo;

    if (!repo) {
      const ghRepo = await getRepo(owner, name);
      const { data: newRepo } = await supabase
        .from('repos')
        .insert({
          owner,
          name,
          full_name: `${owner}/${name}`,
          description: ghRepo.description,
          language: ghRepo.language,
          last_sha: null,
          last_synced_at: null,
        })
        .select()
        .single();
      repo = newRepo!;
    }

    // Check if any files exist
    const { count } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('repo_id', repo!.id);

    const hasFiles = (count || 0) > 0;

    // Get latest commit
    const latestSha = await getLatestCommit(owner, name);
    if (!force && repo!.last_sha === latestSha && hasFiles) {
      console.log(`[sync] ${owner}/${name} already up to date (${count} files)`);
      return; // Already up to date
    }

    console.log(`[sync] Starting sync for ${owner}/${name} (force=${force}, hasFiles=${hasFiles})`);

    // Get file tree
    const tree = await getTree(owner, name);
    // GitHub tree API returns "type": "blob" for files, "type": "tree" for directories
    const files = tree.filter(item => item.type === 'blob' && shouldIndex(item.path));

    console.log(`[sync] Found ${files.length} source files to index`);

    // Index each file (pass SHA from tree for change detection)
    for (const file of files) {
      try {
        await indexFile(repo!.id, owner, name, file.path, file.sha, force);
      } catch (error) {
        console.error(`Failed to index ${file.path}:`, error);
      }
    }

    // Update repo sync state
    await supabase
      .from('repos')
      .update({
        last_sha: latestSha,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', repo!.id);
  } catch (error) {
    console.error(`Failed to sync ${owner}/${name}:`, error);
    throw error;
  }
}

// Index a single file
async function indexFile(repoId: number, owner: string, name: string, path: string, sha: string, force = false): Promise<void> {
  const { content } = await getFileContent(owner, name, path);
  const language = detectLanguage(path);
  const tokenCount = estimateTokens(content);
  const lineCount = countLines(content);

  // Check if file exists and needs update
  const { data: existingFile } = await supabase
    .from('files')
    .select('*')
    .eq('repo_id', repoId)
    .eq('path', path)
    .single();

  if (existingFile && existingFile.last_sha === sha && !force) {
    return; // File unchanged
  }

  // Upsert file
  const { data: file } = await supabase
    .from('files')
    .upsert({
      repo_id: repoId,
      path,
      content,
      language,
      token_count: tokenCount,
      line_count: lineCount,
      last_sha: sha,
    }, { onConflict: 'repo_id,path' })
    .select()
    .single();

  if (!file) return;

  // Clean up any old symbols (no longer using symbol extraction)
  await supabase
    .from('symbols')
    .delete()
    .eq('file_id', file.id);

  console.log(`[sync] Indexed ${path} (${lineCount} lines, ${tokenCount} tokens)`);
}

// Sync specific files (for webhook)
export async function syncFiles(repoId: number, owner: string, name: string, paths: string[]): Promise<void> {
  // Get tree for SHA lookup
  const tree = await getTree(owner, name);
  const treeMap = new Map(tree.map(item => [item.path, item.sha]));

  for (const path of paths) {
    if (!shouldIndex(path)) continue;
    const sha = treeMap.get(path) || '';
    try {
      await indexFile(repoId, owner, name, path, sha, false);
    } catch (error) {
      console.error(`Failed to sync ${path}:`, error);
    }
  }

  // Update repo sync time
  await supabase
    .from('repos')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', repoId);
}
