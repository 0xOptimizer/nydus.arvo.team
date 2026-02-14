'use client';

import { useState, useEffect, MouseEvent } from 'react';
import Link from 'next/link';
import { getAttachedProjects, attachProject, detachProject } from '@/app/actions/github-projects';
import { fetchUserRepos } from '@/app/actions/github-api';
import { detectRepository } from '@/app/actions/detect';
import { checkIntegrations } from '@/app/actions/settings';

const RippleButton = ({ children, onClick, className, disabled, type = 'button' }: any) => {
  const createRipple = (event: MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    const rect = button.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add('ripple');
    const existing = button.getElementsByClassName('ripple')[0];
    if (existing) existing.remove();
    button.appendChild(circle);
    if (onClick) onClick(event);
  };
  return (
    <button type={type} disabled={disabled} onClick={createRipple} className={`relative overflow-hidden transition-all duration-200 ${className}`}>
      <span className="relative z-10">{children}</span>
      <style jsx global>{`
        span.ripple { position: absolute; border-radius: 50%; transform: scale(0); animation: ripple 600ms linear; background-color: rgba(255, 255, 255, 0.3); pointer-events: none; }
        @keyframes ripple { to { transform: scale(4); opacity: 0; } }
      `}</style>
    </button>
  );
};

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
    <div className="space-y-8 max-w-5xl mx-auto relative font-sans">
      
      <div className="flex items-end justify-between pb-6">
        <div>
          <h1 className="text-3xl font-bold text-sky-900 uppercase tracking-tight">Projects</h1>
          <p className="text-sm text-gray-600 mt-2 font-medium">Manage repositories and synchronization</p>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search repositories..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-50 border border-gray-200 p-3 text-sm text-black focus:outline-none focus:border-sky-500 w-64 shadow-sm"
          />
        </div>
      </div>

      {!patKey && (
        <div className="bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm flex items-center justify-between shadow-sm rounded-sm">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
            <span><strong>Setup Required:</strong> Configure your GitHub PAT to sync repositories.</span>
          </div>
          <Link href="/settings?from=projects" className="text-amber-900 underline font-bold hover:text-amber-600 text-xs uppercase tracking-wide">
            Setup Git Key &rarr;
          </Link>
        </div>
      )}

      {/* SECTION: ATTACHED PROJECTS */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-black uppercase tracking-wide border-b border-gray-100 pb-2">Attached Projects</h3>
        <div className="grid gap-4">
          {attached.map((project) => (
            <div key={project.project_uuid} className="bg-white border border-gray-200 p-6 hover:border-sky-500 transition-all duration-200 group shadow-sm hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold text-black">{project.name}</h3>
                    <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 font-bold uppercase tracking-widest border border-gray-200">
                      {project.visibility}
                    </span>
                  </div>
                  <div className="text-sm text-sky-600 font-mono mt-2 font-medium">
                    {project.owner_login}
                  </div>
                </div>
                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <RippleButton onClick={() => handleDetach(project.project_uuid)} className="bg-white text-red-600 border border-red-200 px-4 py-2 text-xs font-bold hover:bg-red-50 hover:border-red-500 uppercase">
                    Detach
                  </RippleButton>
                  <a href={project.url_path} target="_blank" className="inline-block bg-white text-black border border-gray-200 px-4 py-2 text-xs font-bold hover:bg-black hover:text-white transition-colors uppercase">
                    Repo
                  </a>
                </div>
              </div>
            </div>
          ))}
          {!isLoading && attached.length === 0 && (
            <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200">
              No projects attached to local database.
            </div>
          )}
        </div>
      </div>

      {/* SECTION: AVAILABLE REPOSITORIES */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-black uppercase tracking-wide border-b border-gray-100 pb-2">Available on GitHub</h3>
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase text-gray-500">
                <th className="px-6 py-4">Repository</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAvailable.map((repo) => (
                <tr key={repo.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm text-black">{repo.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{repo.owner.login} • {repo.language || 'Code'}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <RippleButton 
                      disabled={processingId === repo.id}
                      onClick={() => handleAttach(repo)}
                      className="bg-black text-white px-4 py-2 text-xs font-bold hover:bg-gray-800 uppercase disabled:bg-gray-200"
                    >
                      {processingId === repo.id ? 'Attaching...' : 'Attach Project'}
                    </RippleButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isLoading && (
            <div className="p-12 text-center text-gray-400 text-sm">
              <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Syncing with GitHub...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}