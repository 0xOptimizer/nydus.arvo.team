import { auth } from '@/auth'
import { DatabaseProvider } from './context/DatabaseContext'
import { ReactNode } from 'react'

export default async function DatabasesLayout({ children }: { children: ReactNode }) {
    const session = await auth()
    const actorId = session?.user?.id ?? ''

    return (
        <DatabaseProvider actorId={actorId}>
            {children}
        </DatabaseProvider>
    )
}