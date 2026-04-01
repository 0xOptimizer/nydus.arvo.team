import { Suspense } from 'react'
import AssignmentsTab from '@/components/databases/AssignmentsTab'
import DatabasesSkeleton from '../loading-skeleton'

export default function DatabaseAssignmentsPage() {
    return (
        <Suspense fallback={<DatabasesSkeleton />}>
            <AssignmentsTab />
        </Suspense>
    )
}