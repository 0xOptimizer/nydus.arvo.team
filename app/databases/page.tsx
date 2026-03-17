import { auth } from '@/auth';
import DatabasesClient from './client';

export default async function DatabasesPage() {
    const session = await auth();
    const actorId = session?.user?.id ?? '';
    return <DatabasesClient actorId={actorId} />;
}