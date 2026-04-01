import { Suspense } from 'react'
import DatabasesTab from '@/components/databases/DatabasesTab'
import DatabasesSkeleton from './loading-skeleton'

export default function DatabasesPage() {
    return (
        <Suspense fallback={<DatabasesSkeleton />}>
            <DatabasesTab />
        </Suspense>
    )
}