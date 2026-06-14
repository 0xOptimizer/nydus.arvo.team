'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { getAttachedProjects, attachProject, detachProject } from '@/app/actions/github-projects';
import { fetchUserRepos } from '@/app/actions/github-api';
import { detectRepository } from '@/app/actions/detect';
import { checkIntegrations } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageShell } from '@/components/PageShell';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton, TableRowsSkeleton } from '@/components/ui/skeleton';
import { staggerContainer, listItem } from '@/lib/motion';

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
    const [attachedData, githubData] = await Promise.all([
      getAttachedProjects(),
      fetchUserRepos()
    ]);

    setAttached(attachedData || []);

    if (githubData.success) {
      const attachedUrls = (attachedData || []).map((p: any) => p.url_path.toLowerCase());
      const filtered = githubData.repos.filter((repo: any) =>
        !attachedUrls.includes(repo.html_url.toLowerCase())
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
      branch: detection.success ? detection.default_branch : repo.default_branch
    };

    const result = await attachProject(projectData);
    if (result.success) await loadData();
    setProcessingId(null);
  };

  const handleDetach = async (uuid: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    const result = await detachProject(uuid);
    if (result.success) await loadData();
  };

  const filteredAvailable = available.filter(repo =>
    repo.name.toLowerCase().includes(search.toLowerCase()) ||
    repo.owner.login.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageShell
      title="Projects"
      description="Manage repositories and synchronization."
      actions={
        <Input
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-card border-border text-foreground min-w-64"
        />
      }
    >

      {!patKey && (
        <Alert className="bg-amber-950/30 border-amber-700/50 text-amber-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
              <span><strong>Setup Required:</strong> Configure your GitHub PAT to sync repositories.</span>
            </div>
            <Link href="/settings?from=projects" className="text-amber-200 underline font-bold hover:text-amber-300 text-xs uppercase tracking-wide">
              Setup Git Key →
            </Link>
          </div>
        </Alert>
      )}

      {/* SECTION: ATTACHED PROJECTS */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Attached Projects</h3>
        {isLoading && attached.length === 0 ? (
          <Card className="rounded-sm border border-border bg-card overflow-hidden">
            <ListSkeleton rows={3} />
          </Card>
        ) : attached.length > 0 ? (
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4">
            <AnimatePresence initial={false}>
              {attached.map((project) => (
                <motion.div key={project.project_uuid} variants={listItem} exit="exit" layout>
                  <Card className="p-4 sm:p-6 border-border bg-card hover:border-primary transition-all duration-200 group">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0">
                      <div className="w-full sm:w-auto">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                          <h3 className="text-lg sm:text-xl font-bold text-foreground line-clamp-1">{project.name}</h3>
                          <Badge variant="secondary" className="text-[10px] uppercase shrink-0">
                            {project.visibility}
                          </Badge>
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground font-mono mt-1 sm:mt-2 font-medium">
                          {project.owner_login}
                        </div>
                      </div>

                      <div className="flex w-full sm:w-auto gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 mt-2 sm:mt-0">
                        <Button size="sm" variant="destructive" onClick={() => handleDetach(project.project_uuid)} className="text-xs uppercase flex-1 sm:flex-none">
                          Detach
                        </Button>
                        <Button asChild variant="secondary" size="sm" className="text-xs uppercase flex-1 sm:flex-none">
                          <a href={project.url_path} target="_blank" rel="noreferrer">Repo</a>
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <EmptyState
            icon="fa-solid fa-folder-open"
            title="No projects attached"
            hint="No projects attached to local database."
          />
        )}
      </div>

      {/* SECTION: AVAILABLE REPOSITORIES */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Available on GitHub</h3>
        <Card className="border-border overflow-hidden bg-card">
          {isLoading ? (
            <TableRowsSkeleton rows={5} cols={2} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-secondary">
                  <TableHead className="text-foreground font-bold uppercase text-xs px-4">Repository</TableHead>
                  <TableHead className="text-right text-foreground font-bold uppercase text-xs px-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAvailable.map((repo) => (
                  <TableRow key={repo.id} className="border-border hover:bg-secondary transition-colors">
                    <TableCell>
                      <div className="font-bold text-sm text-foreground">{repo.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{repo.owner.login} • {repo.language || 'Code'}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        ripple
                        size="sm"
                        pending={processingId === repo.id}
                        pendingText="Attaching…"
                        onClick={() => handleAttach(repo)}
                        className="text-xs font-bold uppercase"
                      >
                        Attach Project
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
