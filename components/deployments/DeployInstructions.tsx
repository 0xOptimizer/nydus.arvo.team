'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const STEPS = [
    { icon: 'fa-link',    title: 'Attach a repository', body: 'On the Projects page, attach a GitHub repo (paste a PAT in Settings first if you haven’t).' },
    { icon: 'fa-rocket',  title: 'Deploy with a domain', body: 'Click Deploy and choose how it’s served — a free <name>.arvo.team subdomain, or a custom Cloudflare / external domain. Nydus clones, builds, and serves it.' },
    { icon: 'fa-shield-halved', title: 'DNS + SSL handled for you', body: 'Subdomain and Cloudflare deployments get their DNS record and a Let’s Encrypt certificate automatically. For external domains, point an A record at the server first.' },
    { icon: 'fa-code-branch', title: 'Push to redeploy', body: 'Configure the deployment webhook (Webhook tab) so pushes to your branch rebuild automatically.' },
];

/**
 * Collapsible "How to deploy" guide. Shown on the deployments list and detail
 * pages.
 */
export function DeployInstructions({ defaultOpen = false }: { defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="rounded-sm border border-border bg-card">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/30"
            >
                <span className="text-sm font-medium">
                    <i className="fa-solid fa-circle-question mr-2 text-primary" />
                    How to deploy a project
                </span>
                <i className={cn('fa-solid text-xs text-muted-foreground transition-transform', open ? 'fa-chevron-down' : 'fa-chevron-right')} />
            </button>

            {open && (
                <div className="space-y-3 border-t border-border p-4">
                    <ol className="space-y-3">
                        {STEPS.map((s, i) => (
                            <li key={s.title} className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border bg-background/40 text-xs font-bold text-primary">
                                    {i + 1}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">
                                        <i className={cn('fa-solid mr-1.5 text-xs text-muted-foreground', s.icon)} />
                                        {s.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{s.body}</p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <div className="flex items-center gap-2 rounded-sm border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                        <i className="fa-solid fa-globe" />
                        <span><span className="font-medium text-foreground">Custom domains</span> are supported &mdash; choose <span className="font-mono">Cloudflare</span> (automated) or <span className="font-mono">External</span> (point your A record first) in the deploy dialog.</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DeployInstructions;
