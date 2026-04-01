import { Suspense } from 'react'
import SchedulesTab from '@/components/databases/SchedulesTab'
import DatabasesSkeleton from '../loading-skeleton'

export default function DatabaseUsersPage() {
    return (
        <Suspense fallback={<DatabasesSkeleton />}>
            <SchedulesTab />
        </Suspense>
    )
}