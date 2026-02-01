'use server';

import { cookies } from 'next/headers';

type DetectionResult = {
  success: boolean;
  stack?: 'node' | 'php' | 'html' | 'python' | 'go' | 'docker' | 'ruby' | 'java';
  name?: string;
  default_branch?: string;
  owner?: {
    login: string;
    avatar_url: string;
  };
  latest_commit?: {
    message: string;
    author_name: string;
    date: string;
    sha: string;
  };
  file_count?: number; 
  error?: string;
};

export async function detectRepository(repoUrl: string): Promise<DetectionResult> {
  const cookieStore = await cookies();
  const pat = cookieStore.get('nydus_pat')?.value;

  if (!pat) {
    return { success: false, error: 'Missing GitHub PAT' };
  }

  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (!match) return { success: false, error: 'Invalid GitHub URL' };
  const [_, owner, repo] = match;

  const headers = {
    'Authorization': `Bearer ${pat}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Nydus-Tunnel'
  };

  try {
    const [repoRes, contentsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers, next: { revalidate: 0 } }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers, next: { revalidate: 0 } })
    ]);

    if (!repoRes.ok) {
        if (repoRes.status === 404) return { success: false, error: 'Repository not found (Check permissions)' };
        return { success: false, error: 'GitHub API Error' };
    }

    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch;

    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${defaultBranch}`, { headers, next: { revalidate: 0 } });
    const commitData = await commitRes.json();

    let fileNames: string[] = [];
    let fileCount = 0;
    
    if (contentsRes.ok) {
        const files = await contentsRes.json();
        if (Array.isArray(files)) {
            fileNames = files.map((f: any) => f.name);
            fileCount = files.length;
        }
    }

    let stack: DetectionResult['stack'] = 'html';
    if (fileNames.includes('composer.json')) stack = 'php';
    else if (fileNames.includes('package.json')) stack = 'node';
    else if (fileNames.includes('requirements.txt') || fileNames.includes('Pipfile')) stack = 'python';
    else if (fileNames.includes('go.mod')) stack = 'go';
    else if (fileNames.includes('Dockerfile') || fileNames.includes('docker-compose.yml')) stack = 'docker';
    else if (fileNames.includes('Gemfile')) stack = 'ruby';
    else if (fileNames.includes('pom.xml') || fileNames.includes('build.gradle')) stack = 'java';

    return { 
        success: true, 
        stack, 
        name: repoData.name,
        default_branch: defaultBranch,
        file_count: fileCount,
        owner: {
            login: repoData.owner.login,
            avatar_url: repoData.owner.avatar_url
        },
        latest_commit: {
            message: commitData.commit.message.split('\n')[0], 
            author_name: commitData.commit.author.name,
            date: commitData.commit.author.date, 
            sha: commitData.sha.substring(0, 7)
        }
    };

  } catch (error) {
    console.error('Detection Error:', error);
    return { success: false, error: 'Failed to connect to GitHub' };
  }
}