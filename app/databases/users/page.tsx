import { Suspense } from 'react'
import UsersTab from '@/components/databases/UsersTab'
import DatabasesSkeleton from '../loading-skeleton'

export default function DatabaseUsersPage() {
    return (
        <Suspense fallback={<DatabasesSkeleton />}>
            <UsersTab />
        </Suspense>
    )
}