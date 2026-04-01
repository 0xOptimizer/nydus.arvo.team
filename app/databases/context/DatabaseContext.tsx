'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { getDatabases, getDatabaseUsers, getAllPrivileges } from '@/app/actions/databases'

type DatabaseContextValue = {
    databases: any[]
    dbUsers: any[]
    privileges: any[]
    actorId: string
    loading: boolean
    refresh: () => Promise<void>
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null)

export function useDatabaseContext() {
    const ctx = useContext(DatabaseContext)
    if (!ctx) throw new Error('useDatabaseContext must be used within DatabaseProvider')
    return ctx
}

export function DatabaseProvider({ children, actorId }: { children: ReactNode; actorId: string }) {
    const [databases, setDatabases]   = useState<any[]>([])
    const [dbUsers, setDbUsers]       = useState<any[]>([])
    const [privileges, setPrivileges] = useState<any[]>([])
    const [loading, setLoading]       = useState(true)

    const refresh = useCallback(async () => {
        setLoading(true)
        const [dbs, users, privs] = await Promise.all([
            getDatabases(),
            getDatabaseUsers(),
            getAllPrivileges(),
        ])
        // Filter to only show items created by the current user
        const userDbs = Array.isArray(dbs) ? dbs.filter((db: any) => db.created_by === actorId) : []
        const userUsers = Array.isArray(users) ? users.filter((user: any) => user.created_by === actorId) : []
        const userPrivs = Array.isArray(privs) ? privs.filter((priv: any) => {
            const userOwnDb = userDbs.some((db: any) => db.database_uuid === priv.database_uuid)
            const userOwnUser = userUsers.some((u: any) => u.user_uuid === priv.user_uuid)
            return userOwnDb && userOwnUser
        }) : []
        setDatabases(userDbs)
        setDbUsers(userUsers)
        setPrivileges(userPrivs)
        setLoading(false)
    }, [actorId])

    useEffect(() => { refresh() }, [refresh])

    return (
        <DatabaseContext.Provider value={{ databases, dbUsers, privileges, actorId, loading, refresh }}>
            {children}
        </DatabaseContext.Provider>
    )
}