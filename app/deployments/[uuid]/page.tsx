import Link from 'next/link';
import { getDeployment } from '@/app/actions/deployments';
import { DeploymentDetail } from '@/components/deployments/detail/DeploymentDetail';

/**
 * Deployment detail page. Fetches the deployment directly by uuid — the list
 * context filters by deployed_by, so we must not rely on it here.
 */
export default async function DeploymentDetailPage({
    params,
}: {
    params: Promise<{ uuid: string }>;
}) {
    const { uuid } = await params;
    const deployment = await getDeployment(uuid);

    if (!deployment || deployment.error || !deployment.deployment_uuid) {
        return (
            <div className="mx-auto max-w-md py-20 text-center">
                <i className="fa-solid fa-circle-question mb-3 text-3xl text-muted-foreground/50" />
                <h1 className="text-lg font-semibold">Deployment not found</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    It may have been deleted, or the ID is incorrect.
                </p>
                <Link href="/deployments" className="mt-4 inline-block text-sm text-primary hover:underline">
                    ← Back to deployments
                </Link>
            </div>
        );
    }

    return <DeploymentDetail deployment={deployment} />;
}
