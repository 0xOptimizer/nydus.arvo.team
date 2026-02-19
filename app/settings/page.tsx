'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSettings, saveSettings } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

const EditableInput = ({ label, name, initialValue, type = "text", placeholder, note }: any) => {
    const [value, setValue] = useState(initialValue || '');
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState<'saved' | 'saving' | 'idle'>('idle');

    useEffect(() => {
        if (initialValue) setValue(initialValue);
        if (!initialValue) setIsEditing(true);
    }, [initialValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setValue(newVal);
        setStatus('saving');

        const timeoutId = setTimeout(async () => {
            const formData = new FormData();
            formData.append(name, newVal);
            
            await saveSettings(formData);
            
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
        }, 800);

        return () => clearTimeout(timeoutId);
    };

    return (
        <div className="relative group">
            <Label className="text-xs font-bold text-primary uppercase tracking-wider">{label}</Label>
            
            <div className="relative mt-2">
                <div className="absolute right-3 top-3 text-xs transition-opacity duration-300 pointer-events-none">
                    {status === 'saving' && <span className="text-primary animate-pulse"><i className="fa-solid fa-spinner fa-spin"></i> Saving...</span>}
                    {status === 'saved' && <span className="text-primary"><i className="fa-solid fa-check"></i> Saved</span>}
                    {status === 'idle' && !isEditing && value && <i className="fa-solid fa-lock text-muted-foreground"></i>}
                </div>

                <Input
                    type={type} 
                    value={value}
                    readOnly={!isEditing}
                    onClick={() => setIsEditing(true)}
                    onChange={handleChange}
                    onBlur={() => {
                        if(value) setIsEditing(false);
                    }}
                    className={`font-mono transition-all duration-200 ${
                        isEditing 
                            ? 'bg-secondary border-primary text-foreground ring-1 ring-primary/20' 
                            : 'bg-card border-border text-muted-foreground cursor-pointer hover:border-border'
                    }`}
                    placeholder={placeholder} 
                />
            </div>
            {note && <p className="text-[10px] text-muted-foreground mt-2">{note}</p>}
        </div>
    );
};

function SettingsContent() {
  const searchParams = useSearchParams();
  const showBackBtn = searchParams.get('from') === 'projects';
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border pb-6 mb-8">
        <div>
            <h1 className="text-3xl font-bold text-foreground uppercase tracking-tight">System Settings</h1>
            <p className="text-sm text-muted-foreground mt-2 font-medium">Configure external service integrations</p>
        </div>
        
        {showBackBtn && (
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 uppercase tracking-wider">
              <Link href="/projects">Back to Projects</Link>
            </Button>
        )}
      </div>

      <div className="space-y-8 max-w-3xl mx-auto">
        
        <Card className="border-border bg-card p-8">
            <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                <i className="fa-brands fa-github text-2xl text-foreground"></i>
                <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">GitHub Integration</h3>
            </div>
            
            <EditableInput 
                label="Personal Access Token (Classic)"
                name="pat"
                initialValue={settings.pat}
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                note={<>Required to verify repo ownership. Scopes needed: <span className="font-bold">repo, read:user</span></>}
            />
        </Card>

        <Card className="border-border bg-card p-8">
            <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                <i className="fa-brands fa-cloudflare text-2xl text-foreground"></i>
                <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">Cloudflare DNS</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                    <EditableInput 
                        label="API Token"
                        name="cf_token"
                        initialValue={settings.cfToken}
                        type="password"
                        placeholder="Cloudflare API Token"
                    />
                </div>
                <div className="col-span-2">
                    <EditableInput 
                        label="Zone ID"
                        name="cf_zone"
                        initialValue={settings.cfZone}
                        placeholder="e.g. 023e105f4ecef8ad9ca31a8372d0c353"
                        note="Found in the Overview tab of your Cloudflare domain dashboard."
                    />
                </div>
            </div>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading settings...</div>}>
            <SettingsContent />
        </Suspense>
    );
}