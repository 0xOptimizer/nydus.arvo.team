/**
 * Deployment display helpers. With custom domains (dns_mode), `subdomain` can be
 * null and `fqdn` is the canonical hostname — always render `fqdn`.
 */

/**
 * Canonical hostname for a deployment or status object. Prefers `fqdn` (always
 * present going forward); falls back to `{subdomain}.arvo.team` for rows created
 * before the custom-domains migration backfilled `fqdn`.
 */
export function deploymentFqdn(d: { fqdn?: string | null; subdomain?: string | null }): string {
    if (d?.fqdn) return d.fqdn;
    if (d?.subdomain) return `${d.subdomain}.arvo.team`;
    return '—';
}

/** Short display name: the subdomain if present, else the fqdn. */
export function deploymentName(d: { fqdn?: string | null; subdomain?: string | null }): string {
    return d?.subdomain || d?.fqdn || '—';
}

export type DnsMode = 'subdomain' | 'cloudflare' | 'external';

const DNS_MODE_LABEL: Record<string, string> = {
    subdomain: 'subdomain',
    cloudflare: 'cloudflare',
    external: 'external',
};

export function dnsModeLabel(mode?: string | null): string {
    return DNS_MODE_LABEL[mode ?? ''] ?? 'subdomain';
}

/** True when nydus does not manage this deployment's DNS (client-run). */
export function isExternalDns(d: { dns_mode?: string | null }): boolean {
    return d?.dns_mode === 'external';
}
