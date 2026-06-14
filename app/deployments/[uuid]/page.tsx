import { getDeployment } from '@/app/actions/deployments';
import { DeploymentDetail, DeploymentNotFound } from '@/components/deployments/detail/DeploymentDetail';

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
        return <DeploymentNotFound />;
    }

    return <DeploymentDetail deployment={deployment} />;
}
