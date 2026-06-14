'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAttachedProjects, attachProject, detachProject } from '@/app/actions/github-projects';
import { fetchUserRepos } from '@/app/actions/github-api';
import { detectRepository } from '@/app/actions/detect';
import { checkIntegrations } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/ui/section';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/EmptyState';

export default function ProjectsPage() {
  const [attached, setAttached] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [patKey, setPatKey] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
    checkIntegrations().then((status) => setPatKey(status.hasPat));
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [attachedData, githubData] = await Promise.all([getAttachedProjects(), fetchUserRepos()]);

    setAttached(attachedData || []);

    if (githubData.success) {
      const attachedUrls = (attachedData || []).map((p: any) => p.url_path.toLowerCase());
      const filtered = githubData.repos.filter(
        (repo: any) => !attachedUrls.includes(repo.html_url.toLowerCase()),
      );
      setAvailable(filtered);
    }
    setIsLoading(false);
  };

  const handleAttach = async (repo: any) => {
    setProcessingId(repo.id);
    const detection = await detectRepository(repo.html_url);

    const projectData = {
      name: repo.name,
      owner: repo.owner.login,
      owner_type: repo.owner.type,
      description: repo.description || '',
      url_path: repo.html_url,
      git_url: repo.clone_url,
      ssh_url: repo.ssh_url,
      visibility: repo.private ? 'private' : 'public',
      branch: detection.success ? detection.default_branch : repo.default_branch,
    };

    const result = await attachProject(projectData);
    if (result.success) await loadData();
    setProcessingId(null);
  };

  const handleDetach = async (uuid: string) => {
    if (!confirm('Detach this project? This cannot be undone.')) return;
    const result = await detachProject(uuid);
    if (result.success) await loadData();
  };

  const filteredAvailable = available
    .filter(
      (repo) =>
        repo.name.toLowerCase().includes(search.toLowerCase()) ||
        repo.owner.login.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const attachedColumns: Column<any>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (p) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{p.name}</span>
            <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
              {p.visibility}
            </Badge>
          </div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">{p.owner_login}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button asChild variant="ghost" size="sm">
            <a href={p.url_path} target="_blank" rel="noreferrer">
              <i className="fa-solid fa-arrow-up-right-from-square" /> Repo
            </a>
          </Button>
          <Button variant="outline" tone="inactive" size="sm" onClick={() => handleDetach(p.project_uuid)}>
            Detach
          </Button>
        </div>
      ),
    },
  ];

  const availableColumns: Column<any>[] = [
    {
      key: 'repo',
      header: 'Repository',
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {r.owner.login} • {r.language || 'Code'}
          </div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (r) => (
        <Button
          ripple
          size="sm"
          pending={processingId === r.id}
          pendingText="Attaching…"
          onClick={() => handleAttach(r)}
        >
          <i className="fa-solid fa-plus" /> Attach
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      title="Projects"
      description="Attach GitHub repositories to deploy and manage them in Nydus."
      meta={
        <Badge variant="secondary" className="text-[10px] uppercase">
          {attached.length} attached
        </Badge>
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          pending={isLoading}
          pendingText="Syncing…"
        >
          <i className="fa-solid fa-rotate" /> Sync
        </Button>
      }
    >
      {!patKey && (
        <Section className="border-amber-700/40 bg-amber-950/20">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-triangle-exclamation text-amber-500" />
              <div>
                <p className="text-sm font-medium text-amber-200">GitHub not connected</p>
                <p className="text-xs text-amber-200/70">
                  Add a Personal Access Token to sync your repositories.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" tone="warning" size="sm">
              <Link href="/settings?from=projects">Configure token</Link>
            </Button>
          </div>
        </Section>
      )}

      <Section title="Attached projects" description="Repositories connected to Nydus" icon="fa-solid fa-folder" flush>
        <DataTable
          columns={attachedColumns}
          rows={attached}
          getRowId={(p) => p.project_uuid}
          loading={isLoading}
          empty={
            <EmptyState
              icon="fa-solid fa-folder-open"
              title="No projects attached"
              hint="Attach a repository below to start deploying."
            />
          }
        />
      </Section>

      <Section
        title="Available on GitHub"
        description="Repositories you can attach"
        icon="fa-brands fa-github"
        flush
        actions={
          <Input
            placeholder="Search repositories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-44 sm:w-64"
          />
        }
      >
        <DataTable
          columns={availableColumns}
          rows={filteredAvailable}
          getRowId={(r) => r.id}
          loading={isLoading}
          empty={
            <EmptyState
              icon="fa-brands fa-github"
              title={search ? 'No matching repositories' : 'No repositories found'}
              hint={
                patKey
                  ? 'All your repositories are attached, or none match your search.'
                  : 'Connect GitHub in Settings to see your repositories.'
              }
            />
          }
        />
      </Section>
    </PageShell>
  );
}
