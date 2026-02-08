import { supabase, estimateTokens } from './supabase';
import { getRepo, getTree, getFileContent, getLatestCommit } from './github';
import { detectLanguage, extractSymbolsRegex, countLines } from './parser';

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
export async function syncRepo(owner: string, name: string): Promise<void> {
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

    // Get latest commit
    const latestSha = await getLatestCommit(owner, name);
    if (repo!.last_sha === latestSha) {
      return; // Already up to date
    }

    // Get file tree
    const tree = await getTree(owner, name);
    const files = tree.filter(item => item.type === 'file' && shouldIndex(item.path));

    // Index each file
    for (const file of files) {
      try {
        await indexFile(repo!.id, owner, name, file.path);
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
async function indexFile(repoId: number, owner: string, name: string, path: string): Promise<void> {
  const { content, sha } = await getFileContent(owner, name, path);
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

  if (existingFile && existingFile.last_sha === sha) {
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

  // Delete old symbols
  await supabase
    .from('symbols')
    .delete()
    .eq('file_id', file.id);

  // Extract and insert symbols
  const symbols = extractSymbolsRegex(content, language);
  if (symbols.length > 0) {
    const symbolsToInsert = symbols.map(s => ({
      file_id: file.id,
      name: s.name,
      kind: s.kind,
      signature: s.signature,
      start_line: s.startLine,
      end_line: s.endLine,
      token_count: estimateTokens(
        content.split('\n').slice(s.startLine - 1, s.endLine).join('\n')
      ),
      parent_symbol: s.parentSymbol,
    }));

    await supabase
      .from('symbols')
      .insert(symbolsToInsert);
  }
}

// Sync specific files (for webhook)
export async function syncFiles(repoId: number, owner: string, name: string, paths: string[]): Promise<void> {
  for (const path of paths) {
    if (!shouldIndex(path)) continue;
    try {
      await indexFile(repoId, owner, name, path);
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
