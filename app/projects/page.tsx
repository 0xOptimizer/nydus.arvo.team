'use client';

import { useState, useEffect, MouseEvent } from 'react';
import Link from 'next/link';
import { getProjects, createProject, deleteProject } from '@/app/actions/projects';
import { detectRepository } from '@/app/actions/detect';
import { checkIntegrations } from '@/app/actions/settings';

function timeAgo(dateString?: string) {
  if (!dateString) return 'Unknown';
  
  const cleanDate = dateString.endsWith('Z') ? dateString : dateString.replace(' ', 'T') + 'Z';
  const date = new Date(cleanDate);
  const now = new Date();
  
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "Just now";
  
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 }
  ];

  for (const i of intervals) {
    const count = Math.floor(seconds / i.seconds);
    if (count >= 1) {
      return `${count} ${i.label}${count !== 1 ? 's' : ''} ago`;
    }
  }
  
  return "Just now";
}

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
};

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

const IconOption = ({ icon, label, selected, onClick, colorClass }: any) => (
  <div className="relative group">
    <button 
      type="button"
      onClick={onClick}
      className={`w-14 h-14 border transition-all duration-200 flex items-center justify-center text-2xl rounded-sm
        ${selected 
            ? `bg-gray-50 border-gray-400 ${colorClass} shadow-inner` 
            : 'bg-white border-gray-200 text-gray-300 hover:border-gray-300 hover:text-gray-400'
        }`}
    >
      <i className={icon}></i>
    </button>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
      {label}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black"></div>
    </div>
  </div>
);

type Project = {
  webhook_uuid: string;
  project_name: string;
  github_repository_url: string;
  deploy_path: string;
  tech_stack?: string;
  last_deployed_at?: string;
  webhook_secret: string;
};

export default function ProjectsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [patKey, setPatKey] = useState('');

  const [repoUrl, setRepoUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [techStack, setTechStack] = useState('');
  const [branch, setBranch] = useState('');

  const [isDetecting, setIsDetecting] = useState(false);
  const [isValidRepo, setIsValidRepo] = useState(false);
  const [detectionError, setDetectionError] = useState('');
  const [repoMeta, setRepoMeta] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  useEffect(() => {
    loadProjects();
    checkIntegrations().then((status) => {
        setPatKey(status.hasPat ? 'present' : '');
    });
  }, []);

  const loadProjects = async () => {
    const data = await getProjects();
    setProjects(data);
    setIsLoading(false);
  };

  const handleUrlBlur = async () => {
    setDetectionError('');
    setRepoMeta(null);
    
    if (isValidRepo) {
        setProjectName('');
        setSubdomain('');
        setTechStack('');
        setBranch('');
    }

    if (!repoUrl) { setIsValidRepo(false); return; }

    setIsDetecting(true);

    try {
        const result = await detectRepository(repoUrl);

        if (result.success && result.name) {
            setIsValidRepo(true);
            setRepoMeta(result);
            
            if (result.stack) setTechStack(result.stack);
            if (!subdomain) setSubdomain(result.name.toLowerCase().replace(/\./g, '-').substring(0, 36));
            if (!branch && result.default_branch) setBranch(result.default_branch);
            if (!projectName) {
                 const title = result.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                 setProjectName(title.substring(0, 100));
            }
        } else {
            setIsValidRepo(false);
            setDetectionError(result.error || 'Repository validation failed');
        }
    } catch (err) {
        setDetectionError('System error during detection');
    } finally {
        setIsDetecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    if (!formData.get('subdomain')) formData.append('subdomain', subdomain);
    if (!formData.get('project_name')) formData.append('project_name', projectName);
    if (!formData.get('tech_stack')) formData.append('tech_stack', techStack);
    if (!formData.get('branch')) formData.append('branch', branch);
    formData.append('deploy_path', `/var/www/${subdomain}`); 

    const result = await createProject(formData);
    
    setIsSubmitting(false);

    if (result.success) {
        setSuccessData({
            uuid: result.webhook_uuid,
            secret: result.webhook_secret,
            repoUrl: repoUrl
        });
        
        setIsCreating(false);
        setRepoUrl(''); setProjectName(''); setSubdomain(''); setTechStack(''); setBranch('');
        setIsValidRepo(false); setRepoMeta(null);
        loadProjects();
    } else {
        alert("Failed to create project.");
    }
  };

  const handleDelete = async (uuid: string) => {
    if(confirm('Are you sure? This cannot be undone.')) {
        await deleteProject(uuid);
        loadProjects();
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto relative font-sans">
      
      <div className="flex items-end justify-between pb-6">
        <div>
          <h1 className="text-3xl font-bold text-sky-900 uppercase tracking-tight">Projects</h1>
          <p className="text-sm text-gray-600 mt-2 font-medium">Manage repositories and listeners</p>
        </div>
        <div className="flex gap-3">
            <RippleButton
                disabled={!patKey}
                onClick={() => setIsCreating(!isCreating)}
                className={`px-6 py-3 text-sm font-bold uppercase tracking-wider ${
                    !patKey ? 'bg-gray-300 text-white cursor-not-allowed' 
                    : isCreating ? 'bg-gray-100 text-black hover:bg-gray-200' 
                    : 'bg-sky-600 text-white hover:bg-sky-700 shadow-md hover:shadow-lg'
                }`}
            >
                {isCreating ? 'Cancel' : 'Add Project'}
            </RippleButton>
        </div>
      </div>

      {successData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm animate-fade-in">
            <div className="bg-white max-w-lg w-full p-8 shadow-2xl border-t-4 border-green-500">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fa-solid fa-check text-2xl text-green-600"></i>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase">Project Created</h2>
                    <p className="text-sm text-gray-500 mt-2">Connect this webhook to your GitHub repository.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payload URL</label>
                        <div className="flex">
                            <input readOnly value={`https://nydus-tunnel.arvo.team/webhook/${successData.uuid}`} className="flex-1 bg-gray-50 border border-gray-200 p-3 text-xs font-mono text-gray-700" />
                            <button onClick={() => copyToClipboard(`https://nydus-tunnel.arvo.team/webhook/${successData.uuid}`)} className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-600 border border-l-0 border-gray-200">
                                <i className="fa-regular fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Secret</label>
                        <div className="flex">
                            <input readOnly value={successData.secret} className="flex-1 bg-gray-50 border border-gray-200 p-3 text-xs font-mono text-gray-700" />
                            <button onClick={() => copyToClipboard(successData.secret)} className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-600 border border-l-0 border-gray-200">
                                <i className="fa-regular fa-copy"></i>
                            </button>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 text-xs text-blue-800 border border-blue-100 mt-4 leading-relaxed">
                        <strong>Instructions:</strong>
                        <ul className="list-disc pl-4 mt-2 space-y-1">
                            <li>Set <strong>Content type</strong> to <code className="bg-white px-1">application/json</code></li>
                            <li>Select <strong>Just the push event</strong></li>
                            <li>Ensure <strong>Active</strong> is checked</li>
                        </ul>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button onClick={() => setSuccessData(null)} className="flex-1 px-4 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 uppercase transition-colors">
                        Close
                    </button>
                    <a href={`${successData.repoUrl}/settings/hooks/new`} target="_blank" className="flex-1 px-4 py-3 text-sm font-bold bg-black text-white hover:bg-gray-800 uppercase text-center flex items-center justify-center gap-2 transition-colors">
                        Open GitHub <i className="fa-solid fa-external-link-alt text-xs"></i>
                    </a>
                </div>
            </div>
        </div>
      )}

      {!patKey && (
        <div className="bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm flex items-center justify-between shadow-sm rounded-sm">
            <div className="flex items-center gap-3">
                <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                <span><strong>Setup Required:</strong> You need to configure your GitHub Personal Access Token to create projects.</span>
            </div>
            <Link href="/settings?from=projects" className="text-amber-900 underline font-bold hover:text-amber-600 text-xs uppercase tracking-wide">
                Setup Git Key &rarr;
            </Link>
        </div>
      )}

      {isCreating && patKey && (
        <div className="bg-white border border-gray-200 p-8 shadow-sm animate-fade-in-down">
          <h3 className="text-lg font-bold text-black mb-6 uppercase tracking-wide border-b border-gray-100 pb-2">New Project</h3>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-sky-600 uppercase tracking-wider">Repository URL</label>
              <div className="relative">
                <input 
                    name="github_repository_url" required type="text" value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)} onBlur={handleUrlBlur}
                    className={`w-full bg-gray-50 border p-3 text-sm text-black focus:outline-none focus:bg-white transition-all duration-200 ${detectionError ? 'border-red-300' : 'border-gray-200 focus:border-sky-500'}`}
                    placeholder="https://github.com/username/repo" 
                />
                {isDetecting && <div className="absolute right-3 top-3"><i className="fa-solid fa-circle-notch fa-spin text-sky-500"></i></div>}
              </div>
              {detectionError && <p className="text-xs text-red-500 font-bold mt-1">{detectionError}</p>}
            </div>

            {isValidRepo && repoMeta && (
                <div className="bg-sky-50 border border-sky-100 p-4 flex items-start gap-4 animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                    <img src={repoMeta.owner.avatar_url} alt="Owner" className="w-10 h-10 rounded border border-sky-200" />
                    <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                        <div className="col-span-2 font-bold text-sky-800 text-sm mb-1">{repoMeta.owner.login} / {repoMeta.name}</div>
                        
                        <div className="text-sky-600 flex items-center gap-2">
                            <i className="fa-solid fa-code-commit"></i>
                            <span className="font-mono text-[10px] bg-white px-1 border border-sky-100 rounded">{repoMeta.latest_commit.sha}</span>
                            <span className="truncate max-w-[200px] italic">"{repoMeta.latest_commit.message}"</span>
                        </div>
                        
                        <div className="text-sky-600 flex items-center gap-2">
                             <i className="fa-regular fa-clock"></i>
                             {/* CHANGED: APPLIED RELATIVE TIME HERE */}
                             <span>{timeAgo(repoMeta.latest_commit.date)} by {repoMeta.latest_commit.author_name}</span>
                        </div>

                        <div className="text-sky-600 flex items-center gap-2 mt-1">
                             <i className="fa-regular fa-folder-open"></i>
                             <span>{repoMeta.file_count || '?'} files in root</span>
                        </div>
                         
                        <div className="text-sky-600 flex items-center gap-2 mt-1">
                             <i className="fa-solid fa-code-branch"></i>
                             <span>Default: <strong>{repoMeta.default_branch}</strong></span>
                        </div>
                    </div>
                </div>
            )}

            {isValidRepo && (
                <div className="space-y-8 animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-sky-600 uppercase tracking-wider">Project Name</label>
                            <input 
                                name="project_name" required type="text" maxLength={100}
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 p-3 text-sm text-black focus:outline-none focus:border-sky-500" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-sky-600 uppercase tracking-wider">Production Branch</label>
                            <div className="relative">
                                <input 
                                    name="branch" required type="text" maxLength={64}
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 p-3 text-sm text-black focus:outline-none focus:border-sky-500 font-mono" 
                                />
                                <i className="fa-solid fa-code-branch absolute right-4 top-3.5 text-gray-400"></i>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-sky-600 uppercase tracking-wider block">Tech Stack</label>
                        <div className="flex flex-wrap gap-3">
                            <IconOption icon="fa-brands fa-node" label="Node.js" selected={techStack === 'node'} onClick={() => setTechStack('node')} colorClass="text-green-600" />
                            <IconOption icon="fa-brands fa-php" label="PHP" selected={techStack === 'php'} onClick={() => setTechStack('php')} colorClass="text-indigo-600" />
                            <IconOption icon="fa-brands fa-python" label="Python" selected={techStack === 'python'} onClick={() => setTechStack('python')} colorClass="text-yellow-500" />
                            <IconOption icon="fa-brands fa-golang" label="Go" selected={techStack === 'go'} onClick={() => setTechStack('go')} colorClass="text-cyan-600" />
                            <IconOption icon="fa-brands fa-docker" label="Docker" selected={techStack === 'docker'} onClick={() => setTechStack('docker')} colorClass="text-blue-500" />
                            <IconOption icon="fa-brands fa-java" label="Java" selected={techStack === 'java'} onClick={() => setTechStack('java')} colorClass="text-red-500" />
                            <IconOption icon="fa-regular fa-gem" label="Ruby" selected={techStack === 'ruby'} onClick={() => setTechStack('ruby')} colorClass="text-red-700" />
                            <IconOption icon="fa-brands fa-html5" label="Static" selected={techStack === 'html'} onClick={() => setTechStack('html')} colorClass="text-orange-600" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-sky-600 uppercase tracking-wider">Assign Subdomain</label>
                        <div className="flex items-center">
                            <input 
                                name="subdomain" type="text" maxLength={36}
                                value={subdomain}
                                onChange={(e) => setSubdomain(e.target.value)}
                                className="flex-1 bg-gray-50 border border-gray-200 p-3 text-sm text-black focus:outline-none focus:border-sky-500 text-right font-mono" 
                            />
                            <span className="bg-gray-100 border border-l-0 border-gray-200 p-3 text-sm text-gray-500 font-mono whitespace-nowrap">.arvo.team</span>
                        </div>
                    </div>

                    <div className="pt-2">
                        <RippleButton type="submit" disabled={isSubmitting} className="w-full bg-black text-white p-4 text-sm font-bold hover:bg-gray-900 transition-colors uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                            {isSubmitting ? (
                                <>
                                    <i className="fa-solid fa-circle-notch fa-spin"></i> Initializing...
                                </>
                            ) : (
                                <>
                                    <span>Initialize Webhook</span>
                                    <i className="fa-solid fa-arrow-right"></i>
                                </>
                            )}
                        </RippleButton>
                    </div>
                </div>
            )}
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {isLoading && <div className="text-gray-400 text-sm">Loading projects from Tunnel...</div>}
        
        {!isLoading && projects.length === 0 && (
            <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200">
                No active webhooks found. Create one to get started.
            </div>
        )}

        {projects.map((project) => (
            <div key={project.webhook_uuid} className="bg-white border border-gray-200 p-6 hover:border-sky-500 transition-all duration-200 group shadow-sm hover:shadow-md">
                <div className="flex justify-between items-start">
                    <div>
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-bold text-black">{project.project_name}</h3>
                        <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 font-bold uppercase tracking-widest border border-gray-200">
                            {project.tech_stack || 'Generic'}
                        </span>
                    </div>
                    <div className="text-sm text-sky-600 font-mono mt-2 font-medium">
                      https://{project.subdomain || project.project_name.toLowerCase().replace(/\s+/g, '-')}.arvo.team
                    </div>
                    </div>
                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <RippleButton onClick={() => handleDelete(project.webhook_uuid)} className="bg-white text-red-600 border border-red-200 px-4 py-2 text-xs font-bold hover:bg-red-50 hover:border-red-500 uppercase">
                            Delete
                        </RippleButton>
                        <a href={project.github_repository_url} target="_blank" className="inline-block bg-white text-black border border-gray-200 px-4 py-2 text-xs font-bold hover:bg-black hover:text-white transition-colors uppercase">
                            Repo
                        </a>
                    </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 text-gray-500 font-medium">
                        {project.last_deployed_at ? <i className="fa-solid fa-circle-check text-green-600"></i> : <i className="fa-solid fa-circle text-gray-300"></i>}
                        {timeAgo(project.last_deployed_at)}
                    </div>
                    <div className="text-right">
                        <div className="font-mono text-gray-400 select-all cursor-pointer hover:text-black transition-colors" title="Click to copy UUID">UUID: {project.webhook_uuid}</div>
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}