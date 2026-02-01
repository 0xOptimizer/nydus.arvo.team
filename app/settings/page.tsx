'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSettings, saveSettings } from '@/app/actions/settings';

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
            <label className="block text-xs font-bold text-sky-600 uppercase tracking-wider mb-2">{label}</label>
            
            <div className="relative">
                <div className="absolute right-3 top-3 text-xs transition-opacity duration-300 pointer-events-none">
                    {status === 'saving' && <span className="text-sky-500 animate-pulse">Saving...</span>}
                    {status === 'saved' && <span className="text-green-600"><i className="fa-solid fa-check"></i> Saved</span>}
                    {status === 'idle' && !isEditing && value && <i className="fa-solid fa-lock text-gray-300"></i>}
                </div>

                <input 
                    type={type} 
                    value={value}
                    readOnly={!isEditing}
                    onClick={() => setIsEditing(true)}
                    onChange={handleChange}
                    onBlur={() => {
                        if(value) setIsEditing(false);
                    }}
                    className={`w-full p-4 text-sm font-mono border transition-all duration-200 outline-none
                        ${isEditing 
                            ? 'bg-white border-sky-500 text-black shadow-sm ring-1 ring-sky-100' 
                            : 'bg-gray-50 border-gray-200 text-gray-500 cursor-pointer hover:bg-white hover:border-gray-300'
                        }
                    `}
                    placeholder={placeholder} 
                />
            </div>
            {note && <p className="text-[10px] text-gray-400 mt-2">{note}</p>}
        </div>
    );
};

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const showBackBtn = searchParams.get('from') === 'projects';
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  return (
    <div className="max-w-3xl mx-auto font-sans">
      <div className="flex items-center justify-between border-b border-gray-200 pb-6 mb-8">
        <div>
            <h1 className="text-3xl font-black text-black uppercase tracking-tight">System Settings</h1>
            <p className="text-sm text-gray-600 mt-2 font-medium">Configure external service integrations</p>
        </div>
        
        {showBackBtn && (
            <Link 
                href="/projects" 
                className="px-6 py-3 text-sm font-bold bg-white text-black border border-gray-200 hover:bg-gray-50 transition-colors uppercase tracking-wider shadow-sm hover:shadow-md"
            >
                Back to Projects
            </Link>
        )}
      </div>

      <div className="space-y-8 animate-fade-in-down">
        
        <div className="bg-white border border-gray-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                <i className="fa-brands fa-github text-2xl text-black"></i>
                <h3 className="text-lg font-bold text-black uppercase tracking-wide">GitHub Integration</h3>
            </div>
            
            <EditableInput 
                label="Personal Access Token (Classic)"
                name="pat"
                initialValue={settings.pat}
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                note={<>Required to verify repo ownership. Scopes needed: <span className="font-bold">repo, read:user</span></>}
            />
        </div>

        <div className="bg-white border border-gray-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                <i className="fa-brands fa-cloudflare text-2xl text-black"></i>
                <h3 className="text-lg font-bold text-black uppercase tracking-wide">Cloudflare DNS</h3>
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
        </div>
      </div>
    </div>
  );
}