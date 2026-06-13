'use client';

import * as React from 'react';
import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { getCloudflareAnalytics } from '@/app/actions/cloudflare';

const chartConfig = {
    visitors: { label: 'Visitors', color: 'var(--primary)' },
} satisfies ChartConfig;

/** Condensed traffic strip for the dashboard: visitors area chart + total. */
export function CloudflareCondensed() {
    const [data, setData] = React.useState<any[]>([]);
    const [granularity, setGranularity] = React.useState('daily');

    React.useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await getCloudflareAnalytics(7);
                if (active && res?.data) {
                    setData(res.data);
                    setGranularity(res.granularity);
                }
            } catch (err) {
                console.error(err);
            }
        })();
        return () => { active = false; };
    }, []);

    const total = React.useMemo(
        () => data.reduce((acc, curr) => acc + (curr.visitors || 0), 0),
        [data],
    );

    const formatDate = React.useCallback((value: string) => {
        if (!value) return '';
        const date = new Date(value);
        if (granularity === 'hourly') return date.toLocaleTimeString('en-US', { hour: 'numeric' });
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }, [granularity]);

    return (
        <div className="rounded-sm border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Traffic · last 7 days
                    </h3>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{total.toLocaleString()}</p>
                </div>
                <Link href="/cloudflare/analytics" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                    Full analytics →
                </Link>
            </div>
            <div className="p-2 sm:p-4">
                <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
                    <AreaChart data={data} margin={{ left: -20, right: 12, top: 8, bottom: 4 }}>
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={formatDate}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                            minTickGap={32}
                        />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} width={32} />
                        <ChartTooltip content={<ChartTooltipContent indicator="line" labelFormatter={formatDate} />} />
                        <Area
                            dataKey="visitors"
                            type="monotone"
                            fill="var(--primary)"
                            fillOpacity={0.15}
                            stroke="var(--primary)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ChartContainer>
            </div>
        </div>
    );
}

export default CloudflareCondensed;
