/**
 * Deploy/rebuild log streams (SSE format A) carry no percentage. We infer
 * progress by matching known stage markers in the log lines and mapping them
 * onto a weighted stage sequence.
 *
 * The marker prefixes below are a best-effort guess based on the deploy
 * pipeline (clone → install → build → nginx → ssl → dns → pm2). Confirm the
 * exact prefixes against real backend logs and adjust STAGES if they differ —
 * unmatched lines simply leave the bar where it is (indeterminate shimmer).
 */
export interface DeployStage {
    /** Fraction complete (0–1) once this stage's marker is seen. */
    progress: number;
    label: string;
    /** Case-insensitive substrings that indicate this stage has started. */
    markers: string[];
}

export const STAGES: DeployStage[] = [
    { progress: 0.08, label: 'Starting',   markers: ['[start]', 'starting deployment', 'queued'] },
    { progress: 0.18, label: 'Cloning',    markers: ['[clone]', 'cloning', 'git clone', 'fetching repo'] },
    { progress: 0.40, label: 'Installing', markers: ['[install]', 'npm install', 'installing dependencies', 'composer install'] },
    { progress: 0.60, label: 'Building',   markers: ['[build]', 'running build', 'npm run build'] },
    { progress: 0.74, label: 'Nginx',      markers: ['[nginx]', 'nginx config', 'writing nginx'] },
    { progress: 0.84, label: 'SSL',        markers: ['[ssl]', 'certbot', "let's encrypt", 'lets encrypt', 'certificate'] },
    { progress: 0.92, label: 'DNS',        markers: ['[dns]', 'cloudflare', 'a record', 'dns record'] },
    { progress: 0.98, label: 'Process',    markers: ['[pm2]', 'starting process', 'pm2 start', 'reloading'] },
];

export interface ProgressState {
    /** 0–1. */
    fraction: number;
    /** Current stage label, or null if nothing matched yet. */
    stageLabel: string | null;
    /** True once a stage marker has been seen (vs. fully indeterminate). */
    determinate: boolean;
}

const ERROR_MARKERS = ['[error]', 'error:', 'failed', 'fatal'];

/**
 * Compute progress from the accumulated log lines. Monotonic: only advances.
 * `done` snaps to 100%.
 */
export function computeProgress(lines: string[], done: boolean): ProgressState {
    if (done) return { fraction: 1, stageLabel: 'Done', determinate: true };

    let best = -1;
    for (const raw of lines) {
        const line = raw.toLowerCase();
        for (let i = 0; i < STAGES.length; i++) {
            if (i <= best) continue;
            if (STAGES[i].markers.some(m => line.includes(m))) {
                best = i;
            }
        }
    }

    if (best < 0) {
        return { fraction: 0.04, stageLabel: null, determinate: false };
    }
    return { fraction: STAGES[best].progress, stageLabel: STAGES[best].label, determinate: true };
}

/** True if any line looks like a hard failure. */
export function hasErrorLine(lines: string[]): boolean {
    return lines.some(raw => {
        const line = raw.toLowerCase();
        return ERROR_MARKERS.some(m => line.includes(m));
    });
}

/**
 * Parse a self-test `[RESULT] {json}` line if present. Returns null otherwise.
 */
export interface SelfTestResult {
    token?: string;
    passed: number;
    total: number;
    ok: boolean;
    steps: { step: string; ok: boolean; detail?: string }[];
}

export function parseSelfTestResult(lines: string[]): SelfTestResult | null {
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const idx = line.indexOf('[RESULT] ');
        if (idx !== -1) {
            try {
                return JSON.parse(line.slice(idx + '[RESULT] '.length));
            } catch {
                return null;
            }
        }
    }
    return null;
}
