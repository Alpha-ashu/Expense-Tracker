import supabase from '@/utils/supabase/client';
import type { OCRProgress, ReceiptLineItem, ReceiptScanResult, TaxComponent, TotalValidationResult } from '@/types/receipt.types';

const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const MAX_LONG_EDGE = 1920;
const JPEG_QUALITY = 0.86;

const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  
  // Fallback to custom JWT stored in localStorage
  const token = localStorage.getItem('accessToken') || 
                localStorage.getItem('token') || 
                localStorage.getItem('auth_token') || 
                localStorage.getItem('authToken');
                
  if (!token) {
    console.warn('[ReceiptScanner] No auth token found in localStorage among keys: accessToken, token, auth_token, authToken');
  }
  return token || null;
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

const parseTaxBreakdown = (raw: unknown): TaxComponent[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const components = raw
    .filter((t): t is Record<string, unknown> => t !== null && typeof t === 'object')
    .map((t) => ({
      name: typeof t.name === 'string' ? t.name : 'Tax',
      rate: typeof t.rate === 'number' ? t.rate : undefined,
      amount: typeof t.amount === 'number' ? t.amount : 0,
    }))
    .filter((t) => t.amount > 0);
  return components.length > 0 ? components : undefined;
};

const parseItems = (raw: unknown): ReceiptLineItem[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .filter((i): i is Record<string, unknown> => i !== null && typeof i === 'object')
    .map((i) => ({
      name: typeof i.name === 'string' ? i.name : 'Item',
      quantity: typeof i.quantity === 'number' ? i.quantity : undefined,
      rate: typeof i.rate === 'number' ? i.rate : undefined,
      amount: typeof i.amount === 'number' ? i.amount : 0,
    }))
    .filter((i) => i.name && i.amount > 0);
  return items.length > 0 ? items : undefined;
};

const parseValidationResult = (raw: unknown): TotalValidationResult | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as Record<string, unknown>;
  if (typeof v.isValid !== 'boolean') return undefined;
  return {
    isValid: v.isValid,
    calculated: typeof v.calculated === 'number' ? v.calculated : 0,
    detected: typeof v.detected === 'number' ? v.detected : 0,
  };
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

    const finalUrl = `${API_BASE}/receipts/scan`;
    console.log(`[ReceiptScanner] Sending fetch to: ${finalUrl}. Token present: ${!!token}`);
    
    onProgress?.({ status: 'Running AI financial intelligence engine…', progress: 35 });
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers,
      body: formData,
    });
    console.log(`[ReceiptScanner] Received response status: ${response.status}`);

    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      const errorMessage = typeof payload?.error === 'string' ? payload.error : 'Cloud receipt scan failed';
      throw new Error(errorMessage);
    }

    onProgress?.({ status: 'Applying global intelligence & tax extraction…', progress: 80 });

    const merchantName = typeof payload.merchantName === 'string' ? payload.merchantName : undefined;
    const amount = typeof payload.amount === 'number' && Number.isFinite(payload.amount) ? payload.amount : undefined;
    const currency = typeof payload.currency === 'string' ? payload.currency : 'INR';
    const date = parseScanDate(payload.date);
    const location = typeof payload.location === 'string' ? payload.location : 'UNKNOWN';

    const confidence = typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)
      ? payload.confidence
      : 0.85;

    const taxBreakdown = parseTaxBreakdown(payload.taxBreakdown);
    const items = parseItems(payload.items);
    const validationResult = parseValidationResult(payload.validationResult);

    // Auto-generate smart description from top items if not provided by AI
    const aiDescription = typeof payload.description === 'string' ? payload.description : undefined;
    const itemsDescription = items && items.length > 0
      ? items.slice(0, 3).map((i) => `${i.name} ${currency} ${i.amount}`).join(', ')
      : undefined;

    const rawFields = payload && typeof payload.rawFields === 'object' ? payload.rawFields : payload;

    onProgress?.({ status: 'Intelligence engine complete', progress: 100 });

    return {
      merchantName,
      amount,
      currency,
      date,
      location,
      time: typeof payload.time === 'string' ? payload.time : undefined,
      subtotal: typeof payload.subtotal === 'number' ? payload.subtotal : undefined,
      taxAmount: typeof payload.taxAmount === 'number' ? payload.taxAmount : undefined,
      taxBreakdown,
      invoiceNumber: typeof payload.invoiceNumber === 'string' ? payload.invoiceNumber : undefined,
      paymentMethod: typeof payload.paymentMethod === 'string' ? payload.paymentMethod : undefined,
      category: typeof payload.category === 'string' ? payload.category : undefined,
      subcategory: typeof payload.subcategory === 'string' && payload.subcategory.trim() ? payload.subcategory.trim() : undefined,
      description: aiDescription ?? itemsDescription,
      items,
      validationResult,
      confidence: Math.max(0, Math.min(1, confidence)),
      rawText: JSON.stringify(rawFields || {}),
      notes: typeof payload.category === 'string' ? `${payload.category.toLowerCase()} receipt` : 'cloud ocr receipt',
    };
  }
}

export const cloudReceiptScanService = new CloudReceiptScanService();
