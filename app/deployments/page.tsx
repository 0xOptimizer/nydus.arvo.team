import { Suspense }        from 'react';
import DeployTab           from '@/components/deployments/DeployTab';
import DeploymentsSkeleton from './loading-skeleton';

export default function DeploymentsPage() {
    return (
        <Suspense fallback={<DeploymentsSkeleton />}>
            <DeployTab />
        </Suspense>
    );
}