import supabase from '@/utils/supabase/client';
import type { OCRProgress, ReceiptScanResult } from '@/types/receipt.types';

const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const MAX_LONG_EDGE = 1920;
const JPEG_QUALITY = 0.86;

const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load receipt image'));
    };
    image.src = url;
  });

const compressImageForUpload = async (file: File) => {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(image.width, image.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is unavailable for image compression');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error('Failed to compress receipt image'));
        return;
      }
      resolve(nextBlob);
    }, 'image/jpeg', JPEG_QUALITY);
  });

  return blob;
};

const parseScanDate = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

export class CloudReceiptScanService {
  async scanReceipt(
    file: File,
    onProgress?: (progress: OCRProgress) => void,
  ): Promise<ReceiptScanResult> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Cloud receipt scan currently supports image files only');
    }

    onProgress?.({ status: 'Compressing image for upload…', progress: 15 });
    const compressedBlob = await compressImageForUpload(file);

    const formData = new FormData();
    formData.append('file', compressedBlob, `${file.name.replace(/\.[^.]+$/, '') || 'receipt'}.jpg`);

    const token = await getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    onProgress?.({ status: 'Uploading receipt to secure OCR server…', progress: 35 });
    const response = await fetch(`${API_BASE}/receipts/scan`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      const errorMessage = typeof payload?.error === 'string' ? payload.error : 'Cloud receipt scan failed';
      throw new Error(errorMessage);
    }

    onProgress?.({ status: 'Applying extracted receipt fields…', progress: 85 });

    const merchantName = typeof payload.merchantName === 'string' ? payload.merchantName : undefined;
    const amount = typeof payload.amount === 'number' && Number.isFinite(payload.amount) ? payload.amount : undefined;
    const currency = typeof payload.currency === 'string' ? payload.currency : 'INR';
    const date = parseScanDate(payload.date);
    const confidence = typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)
      ? payload.confidence
      : 0.85;

    const rawFields = payload && typeof payload.rawFields === 'object' ? payload.rawFields : payload;

    onProgress?.({ status: 'Cloud OCR completed', progress: 100 });

    return {
      merchantName,
      amount,
      currency,
      date,
      time: typeof payload.time === 'string' ? payload.time : undefined,
      subtotal: typeof payload.subtotal === 'number' ? payload.subtotal : undefined,
      taxAmount: typeof payload.taxAmount === 'number' ? payload.taxAmount : undefined,
      invoiceNumber: typeof payload.invoiceNumber === 'string' ? payload.invoiceNumber : undefined,
      paymentMethod: typeof payload.paymentMethod === 'string' ? payload.paymentMethod : undefined,
      items: Array.isArray(payload.items) ? payload.items : undefined,
      confidence: Math.max(0, Math.min(1, confidence)),
      rawText: JSON.stringify(rawFields || {}),
      notes: merchantName ? 'cloud ocr receipt' : 'cloud ocr import',
    };
  }
}

export const cloudReceiptScanService = new CloudReceiptScanService();
