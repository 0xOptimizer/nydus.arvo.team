'use server';

import { cookies } from 'next/headers';

export async function saveSettings(formData: FormData) {
  const cookieStore = await cookies();
  
  const pat = formData.get('pat') as string;
  const cfToken = formData.get('cf_token') as string;
  const cfZone = formData.get('cf_zone') as string;

  const options = { httpOnly: true, secure: true, maxAge: 31536000, path: '/' };

  if (pat) cookieStore.set('nydus_pat', pat, options);
  if (cfToken) cookieStore.set('nydus_cf_token', cfToken, options);
  if (cfZone) cookieStore.set('nydus_cf_zone', cfZone, options);

  return { success: true };
}

export async function getSettings() {
  const cookieStore = await cookies();
  return {
    pat: cookieStore.get('nydus_pat')?.value || '',
    cfToken: cookieStore.get('nydus_cf_token')?.value || '',
    cfZone: cookieStore.get('nydus_cf_zone')?.value || '',
  };
}

export async function checkIntegrations() {
  const cookieStore = await cookies();
  return {
    hasPat: !!cookieStore.get('nydus_pat')?.value,
    hasCloudflare: !!cookieStore.get('nydus_cf_token')?.value
  };
}