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

// Get single file content
export async function getFileContent(owner: string, name: string, path: string) {
  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo: name,
    path,
  });

  if (Array.isArray(data) || data.type !== 'file') {
    throw new Error('Not a file');
  }

  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return {
    content,
    sha: data.sha,
    size: data.size,
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

export default octokit;
