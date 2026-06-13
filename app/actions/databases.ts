'use server';

import { revalidatePath } from 'next/cache';
import { fetchWithAuth } from '@/lib/api';

export async function getDatabases(includeDeleted: boolean = false) {
    try {
        const query = new URLSearchParams({ include_deleted: includeDeleted.toString() });
        return await fetchWithAuth(`/databases?${query}`);
    } catch (error: any) {
        return { success: false, error: error.message, result: [] };
    }
}

export async function getDatabase(uuid: string) {
    try {
        return await fetchWithAuth(`/databases/${uuid}`);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createDatabase(
    databaseType: string,
    databaseName: string,
    allowedHosts: string,
    createdBy: string
) {
    try {
        const data = await fetchWithAuth(`/databases`, {
            method: 'POST',
            body: JSON.stringify({
                database_type: databaseType,
                database_name: databaseName,
                allowed_hosts: allowedHosts,
                created_by: createdBy
            })
        });
        revalidatePath('/databases');
        return { success: true, database_uuid: data.database_uuid };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteDatabase(
    uuid: string,
    databaseName: string,
    databaseType: string,
    deletedBy: string
) {
    try {
        await fetchWithAuth(`/databases/${uuid}`, {
            method: 'DELETE',
            body: JSON.stringify({
                database_name: databaseName,
                database_type: databaseType,
                deleted_by: deletedBy
            })
        });
        revalidatePath('/databases');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getDatabaseUsers(includeDeleted: boolean = false) {
    try {
        const query = new URLSearchParams({ include_deleted: includeDeleted.toString() });
        return await fetchWithAuth(`/databases/users?${query}`);
    } catch (error: any) {
        return { success: false, error: error.message, result: [] };
    }
}

export async function createDatabaseUser(
    databaseType: string,
    username: string,
    password: string,
    createdBy: string,
    allowedHosts: string = '%'
) {
    try {
        const data = await fetchWithAuth(`/databases/users`, {
            method: 'POST',
            body: JSON.stringify({
                database_type: databaseType,
                username,
                password,
                created_by: createdBy,
                allowed_hosts: allowedHosts
            })
        });
        revalidatePath('/databases');
        return { success: true, user_uuid: data.user_uuid };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteDatabaseUser(
    userUuid: string,
    databaseType: string,
    username: string,
    deletedBy: string
) {
    try {
        await fetchWithAuth(`/databases/users/${userUuid}`, {
            method: 'DELETE',
            body: JSON.stringify({
                database_type: databaseType,
                username,
                deleted_by: deletedBy
            })
        });
        revalidatePath('/databases');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function grantPrivileges(
    databaseUuid: string,
    databaseType: string,
    databaseName: string,
    userUuid: string,
    username: string,
    privileges: string,
    grantedBy: string
) {
    try {
        await fetchWithAuth(`/databases/${databaseUuid}/privileges`, {
            method: 'POST',
            body: JSON.stringify({
                database_type: databaseType,
                database_name: databaseName,
                user_uuid: userUuid,
                username,
                privileges,
                granted_by: grantedBy
            })
        });
        revalidatePath('/databases');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function revokePrivileges(
    databaseUuid: string,
    userUuid: string,
    databaseType: string,
    databaseName: string,
    username: string,
    revokedBy: string
) {
    try {
        await fetchWithAuth(`/databases/${databaseUuid}/privileges/${userUuid}`, {
            method: 'DELETE',
            body: JSON.stringify({
                database_type: databaseType,
                database_name: databaseName,
                username,
                revoked_by: revokedBy
            })
        });
        revalidatePath('/databases');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getPrivilegesForDatabase(databaseUuid: string) {
    try {
        return await fetchWithAuth(`/databases/${databaseUuid}/privileges`);
    } catch (error: any) {
        return { success: false, error: error.message, result: [] };
    }
}

export async function getAllPrivileges() {
    try {
        return await fetchWithAuth(`/databases/privileges`);
    } catch (error: any) {
        return { success: false, error: error.message, result: [] };
    }
}

export async function getUserCredentials(userUuid: string) {
    try {
        return await fetchWithAuth(`/databases/users/${userUuid}/credentials`);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function performBackup(
    databaseUuid: string,
    databaseType: string,
    databaseName: string
) {
    try {
        const data = await fetchWithAuth(`/databases/${databaseUuid}/backup`, {
            method: 'POST',
            body: JSON.stringify({
                database_type: databaseType,
                database_name: databaseName
            })
        });
        return { success: true, backup_uuid: data.backup_uuid };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function restoreBackup(
    databaseUuid: string,
    databaseType: string,
    databaseName: string,
    backupFilePath: string
) {
    try {
        await fetchWithAuth(`/databases/${databaseUuid}/restore`, {
            method: 'POST',
            body: JSON.stringify({
                database_type: databaseType,
                database_name: databaseName,
                backup_file_path: backupFilePath
            })
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getPmaToken(userUuid: string) {
    try {
        const data = await fetchWithAuth(`/databases/pma-token`, {
            method: 'POST',
            body: JSON.stringify({ user_uuid: userUuid })
        });
        return { success: true, token: data.token };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function quickgenProvision(createdBy: string) {
    try {
        const data = await fetchWithAuth(`/databases/quickgen`, {
            method: 'POST',
            body: JSON.stringify({
                database_type: 'mysql',
                created_by: createdBy
            })
        });
        revalidatePath('/databases');
        return {
            success: true,
            database_uuid: data.database_uuid,
            database_name: data.database_name,
            user_uuid: data.user_uuid,
            username: data.username,
            password: data.password,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getAllRecentBackups(limit: number = 50) {
    try {
        return await fetchWithAuth(`/databases/backups?limit=${limit}`);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getBackupsForDatabase(databaseUuid: string, limit: number = 50) {
    try {
        return await fetchWithAuth(`/databases/${databaseUuid}/backups?limit=${limit}`);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getAllSchedules() {
    try {
        return await fetchWithAuth(`/databases/schedules`);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSchedulesForDatabase(databaseUuid: string) {
    try {
        return await fetchWithAuth(`/databases/${databaseUuid}/schedules`);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function toggleSchedule(scheduleUuid: string) {
    try {
        const data = await fetchWithAuth(`/databases/schedules/${scheduleUuid}/toggle`, { method: 'POST' });
        return { success: true, enabled: data.enabled };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function forceRunSchedule(scheduleUuid: string) {
    try {
        await fetchWithAuth(`/databases/schedules/${scheduleUuid}/run`, { method: 'POST' });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}