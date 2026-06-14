'use client';

import dynamic from 'next/dynamic';
import { PageShell } from '@/components/PageShell';

// recharts is client-only; avoid SSR to prevent hydration mismatches.
const AnalyticsPanel = dynamic(() => import('@/components/cloudflare/AnalyticsPanel'), { ssr: false });

export default function CloudflareAnalyticsPage() {
    return (
        <PageShell
            title="Cloudflare Analytics"
            description="Traffic analytics for arvo.team and its subdomains."
            backHref="/cloudflare"
        >
            <AnalyticsPanel />
        </PageShell>
    );
}
