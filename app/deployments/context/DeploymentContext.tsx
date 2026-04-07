'use client';

import {
    createContext, useContext, useState,
    useCallback, useEffect, ReactNode,
} from 'react';
import { getDeployments } from '@/app/actions/deployments';
import { getProjects }    from '@/app/actions/projects';

type DeploymentContextValue = {
    deployments: any[];
    projects:    any[];
    actorId:     string;
    loading:     boolean;
    refresh:     () => Promise<void>;
};

const DeploymentContext = createContext<DeploymentContextValue | null>(null);

export function useDeploymentContext() {
    const ctx = useContext(DeploymentContext);
    if (!ctx) throw new Error('useDeploymentContext must be used within DeploymentProvider');
    return ctx;
}

export function DeploymentProvider({
    children,
    actorId,
}: {
    children: ReactNode;
    actorId:  string;
}) {
    const [deployments, setDeployments] = useState<any[]>([]);
    const [projects, setProjects]       = useState<any[]>([]);
    const [loading, setLoading]         = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        const [deps, projs] = await Promise.all([
            getDeployments(),
            getProjects(),
        ]);
        setDeployments(Array.isArray(deps)   ? deps.filter((d: any) => d.deployed_by === actorId)  : []);
        setProjects(Array.isArray(projs)     ? projs                                                 : []);
        setLoading(false);
    }, [actorId]);

    useEffect(() => { refresh(); }, [refresh]);

    return (
        <DeploymentContext.Provider value={{ deployments, projects, actorId, loading, refresh }}>
            {children}
        </DeploymentContext.Provider>
    );
}