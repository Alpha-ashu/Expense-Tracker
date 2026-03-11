import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const storageClient = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'secure-uploads';
export const SIGNED_URL_TTL = Number(process.env.SUPABASE_SIGNED_URL_TTL || 600);

export const requireStorageClient = () => {
  if (!storageClient) {
    throw new Error('Supabase storage is not configured');
  }
  return storageClient;
};

export const uploadBuffer = async (path: string, buffer: Buffer, contentType: string) => {
  const client = requireStorageClient();
  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }
};

export const removeObject = async (path: string) => {
  const client = requireStorageClient();
  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(error.message);
  }
};

export const createSignedUrl = async (path: string, expiresIn = SIGNED_URL_TTL) => {
  const client = requireStorageClient();
  const { data, error } = await client.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(error.message);
  }

  return data?.signedUrl || null;
};
