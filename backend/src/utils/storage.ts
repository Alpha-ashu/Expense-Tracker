import { createClient } from '@supabase/supabase-js';

let _storageClient: any = null;
const getStorageClient = () => {
  if (_storageClient) return _storageClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && key !== 'undefined') {
    try {
      _storageClient = createClient(url, key);
      return _storageClient;
    } catch (err) {
      console.error('Failed to init Supabase storage client:', err);
    }
  }
  return null;
};

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'secure-uploads';
export const SIGNED_URL_TTL = Number(process.env.SUPABASE_SIGNED_URL_TTL || 600);

export const requireStorageClient = () => {
  const client = getStorageClient();
  if (!client) {
    throw new Error('Supabase storage is not configured');
  }
  return client;
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
