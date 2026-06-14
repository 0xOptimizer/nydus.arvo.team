'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSettings, saveSettings } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/ui/section';
import { Field, FormGrid } from '@/components/ui/field';
import { WatchdogCard } from '@/components/settings/WatchdogCard';
import { cn } from '@/lib/utils';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * A single secret/credential field. Unlike the old click-to-unlock + silent
 * debounced auto-save EditableInput, this is ALWAYS editable, has a show/hide
 * reveal toggle for secret values, and an explicit Save button with a clear
 * per-field state (idle / saving spinner / "Saved" check). It posts the exact
 * same FormData field name to the same saveSettings() server action.
 */
function SecretField({
    label,
    name,
    initialValue,
    secret = false,
    placeholder,
    hint,
    required,
}: {
    label: string;
    name: string;
    initialValue?: string;
    secret?: boolean;
    placeholder?: string;
    hint?: React.ReactNode;
    required?: boolean;
}) {
    const [value, setValue] = useState(initialValue || '');
    const [saved, setSaved] = useState(initialValue || '');
    const [reveal, setReveal] = useState(false);
    const [state, setState] = useState<SaveState>('idle');

    useEffect(() => {
        setValue(initialValue || '');
        setSaved(initialValue || '');
    }, [initialValue]);

    const dirty = value !== saved;

    const handleSave = async () => {
        if (!dirty || !value) return;
        setState('saving');
        try {
            const formData = new FormData();
            formData.append(name, value);
            const res = await saveSettings(formData);
            if (res?.success) {
                setSaved(value);
                setState('saved');
                setTimeout(() => setState('idle'), 2500);
            } else {
                setState('error');
            }
        } catch {
            setState('error');
        }
    };

    return (
        <Field
            label={label}
            htmlFor={`field-${name}`}
            required={required}
            hint={
                state === 'error'
                    ? undefined
                    : hint
            }
            error={state === 'error' ? 'Could not save. Try again.' : undefined}
        >
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Input
                        id={`field-${name}`}
                        name={name}
                        type={secret && !reveal ? 'password' : 'text'}
                        value={value}
                        placeholder={placeholder}
                        onChange={(e) => {
                            setValue(e.target.value);
                            if (state !== 'idle') setState('idle');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSave();
                            }
                        }}
                        className={cn('font-mono', secret && 'pr-10')}
                    />
                    {secret && (
                        <button
                            type="button"
                            onClick={() => setReveal((r) => !r)}
                            aria-label={reveal ? 'Hide value' : 'Show value'}
                            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <i className={reveal ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} />
                        </button>
                    )}
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant={dirty ? 'default' : 'outline'}
                    tone={state === 'saved' ? 'active' : 'none'}
                    disabled={!dirty || !value}
                    pending={state === 'saving'}
                    pendingText="Saving…"
                    onClick={handleSave}
                    className="shrink-0"
                >
                    {state === 'saved' ? (
                        <>
                            <i className="fa-solid fa-check" /> Saved
                        </>
                    ) : (
                        'Save'
                    )}
                </Button>
            </div>
        </Field>
    );
}

function SettingsContent() {
    const searchParams = useSearchParams();
    const showBackBtn = searchParams.get('from') === 'projects';
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    const backAction = showBackBtn ? (
        <Button asChild variant="outline" size="sm">
            <Link href="/projects">
                <i className="fa-solid fa-arrow-left" /> Back to Projects
            </Link>
        </Button>
    ) : undefined;

    if (!settings) {
        return (
            <PageShell
                title="System Settings"
                description="Connect the external services Nydus uses to deploy, route, and monitor your projects."
                actions={backAction}
            >
                <CardSkeleton rows={1} />
                <CardSkeleton rows={2} />
                <CardSkeleton rows={2} />
            </PageShell>
        );
    }

    return (
        <PageShell
            title="System Settings"
            description="Connect the external services Nydus uses to deploy, route, and monitor your projects."
            actions={backAction}
        >
            <Section
                title="GitHub Integration"
                description="Used to verify repository ownership and sync your repos."
                icon="fa-brands fa-github"
            >
                <SecretField
                    label="Personal Access Token (Classic)"
                    name="pat"
                    initialValue={settings.pat}
                    secret
                    placeholder="ghp_xxxxxxxxxxxx"
                    hint={
                        <>
                            Scopes needed: <span className="font-bold">repo, read:user</span>
                        </>
                    }
                />
            </Section>

            <Section
                title="Cloudflare DNS"
                description="Used to create and manage DNS records for deployments."
                icon="fa-brands fa-cloudflare"
            >
                <FormGrid cols={2}>
                    <SecretField
                        label="API Token"
                        name="cf_token"
                        initialValue={settings.cfToken}
                        secret
                        placeholder="Cloudflare API Token"
                        hint="A scoped token with Zone · DNS · Edit permission."
                    />
                    <SecretField
                        label="Zone ID"
                        name="cf_zone"
                        initialValue={settings.cfZone}
                        placeholder="e.g. 023e105f4ecef8ad9ca31a8372d0c353"
                        hint="Found in the Overview tab of your Cloudflare domain dashboard."
                    />
                </FormGrid>
            </Section>

            <WatchdogCard />
        </PageShell>
    );
}

export default function SettingsPage() {
    return (
        <Suspense
            fallback={
                <PageShell
                    title="System Settings"
                    description="Connect the external services Nydus uses to deploy, route, and monitor your projects."
                >
                    <CardSkeleton rows={1} />
                    <CardSkeleton rows={2} />
                    <CardSkeleton rows={2} />
                </PageShell>
            }
        >
            <SettingsContent />
        </Suspense>
    );
}
