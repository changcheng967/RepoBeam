import { Octokit } from 'octokit';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export interface GitHubFile {
  path: string;
  sha: string;
  size: number;
  type: string;
  content?: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
}

// Get repository information
export async function getRepo(owner: string, name: string) {
  const { data } = await octokit.rest.repos.get({
    owner,
    repo: name,
  });
  return data;
}

// Get file tree recursively
export async function getTree(owner: string, name: string, sha?: string) {
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo: name,
    tree_sha: sha || 'HEAD',
    recursive: 'true',
  });
  return data.tree;
}

// Get single file content using raw.githubusercontent.com
// Better than contents API: no base64, no JSON overhead, no rate limit
export async function getFileContent(owner: string, name: string, path: string, branch = 'main') {
  // Use raw.githubusercontent.com - faster, no base64, no rate limit
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${path}`;
  const response = await fetch(rawUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }

  const content = await response.text();

  // Get SHA from tree (we already have it from the tree fetch)
  // This avoids an extra API call just for the SHA
  return {
    content,
    sha: '', // SHA is already known from tree endpoint
    size: content.length,
  };
}

// Get latest commit SHA
export async function getLatestCommit(owner: string, name: string, branch = 'main') {
  const { data } = await octokit.rest.repos.getBranch({
    owner,
    repo: name,
    branch,
  });
  return data.commit.sha;
}

// Get commits since SHA
export async function getCommitsSince(owner: string, name: string, sinceSha: string) {
  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo: name,
    per_page: 100,
  });

  const commits: string[] = [];
  for (const commit of data) {
    if (commit.sha === sinceSha) break;
    commits.push(commit.sha);
  }
  return commits;
}

// Get changed files in a commit
export async function getCommitFiles(owner: string, name: string, sha: string) {
  const { data } = await octokit.rest.repos.getCommit({
    owner,
    repo: name,
    ref: sha,
  });

  return data.files?.map(f => f.filename) || [];
}

// Get a single file's metadata (SHA) without fetching entire tree
// This is much faster than getTree() for webhook sync
export async function getFileMetadata(owner: string, name: string, path: string, branch = 'main') {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: name,
      path,
      ref: branch,
    });

    if ('sha' in data) {
      return {
        sha: data.sha as string,
        size: data.size || 0,
      };
    }
    throw new Error('Not a file');
  } catch (error) {
    // File might have been deleted
    console.error(`Failed to get metadata for ${path}:`, error);
    return {
      sha: '',
      size: 0,
    };
  }
}

export default octokit;
