import { auth }               from '@/auth';
import { DeploymentProvider }  from './context/DeploymentContext';
import { ReactNode }           from 'react';

export default async function DeploymentsLayout({ children }: { children: ReactNode }) {
    const session = await auth();
    const actorId = session?.user?.id ?? '';

    return (
        <DeploymentProvider actorId={actorId}>
            {children}
        </DeploymentProvider>
    );
}