import type { ChipState } from '@/components/StatusChip';

/**
 * Derive control-plane health chip states from a deployment /status object.
 * Shared by the dashboard health grid and the deployment detail header.
 */
export function pm2ChipState(pm2: any): ChipState {
    if (!pm2) return 'unknown';
    return pm2.status === 'online' ? 'ok' : 'fail';
}

export function httpChipState(http: any): ChipState {
    if (!http) return 'unknown';
    return http.ok ? 'ok' : 'fail';
}

export function sslChipState(ssl: any): ChipState {
    const days = ssl?.days_left;
    if (days === null || days === undefined) return 'unknown';
    if (days <= 0) return 'fail';
    if (days <= 14) return 'warn';
    return 'ok';
}

export function dnsChipState(dns: any): ChipState {
    if (!dns) return 'unknown';
    // External (client-managed) DNS — nydus doesn't manage it, so absence isn't a failure.
    if (dns.managed === false) return 'unknown';
    if (!dns.present) return 'fail';
    if (dns.drift) return 'warn';
    return 'ok';
}
