import { Suspense } from 'react'
import BackupsTab from '@/components/databases/BackupsTab'
import DatabasesSkeleton from '../loading-skeleton'

export default function DatabaseUsersPage() {
    return (
        <Suspense fallback={<DatabasesSkeleton />}>
            <BackupsTab />
        </Suspense>
    )
}