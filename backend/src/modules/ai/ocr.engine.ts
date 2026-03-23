import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../config/logger';
import Tesseract from 'tesseract.js';
import { sanitizeAIInput, sanitizeAIOutput, validateOcrResult } from '../../utils/sanitize';
import { withCircuitBreaker } from '../../utils/circuitBreaker';
import { audit } from '../../utils/auditLogger';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

/**
 * Hybrid OCR Pipeline using Open-Source Tesseract + Gemini:
 * 1. Tesseract OCR: Scans the image to extract all raw text exactly as printed.
 *    (This fulfills the request to use the specific open-source OCR engine).
 * 2. Gemini LLM: Takes the raw Tesseract text and structures it into the required JSON shape.
 */

const SYSTEM_INSTRUCTION = `You are a specialist financial data extractor.
Your job is to read raw, messy OCR text (extracted by Tesseract) and map it into structured JSON.
You NEVER hallucinate or invent data. If a field isn't present in the raw text, return null for it.
Fix obvious OCR typos (like O vs 0, or \`?\` instead of \`₹\`), but do not invent items or amounts.`;

const buildPrompt = (rawText: string) => `
Here is the raw text extracted from a receipt using Tesseract OCR.
Translate it into structured JSON.

--- RAW OCR TEXT ---
${rawText}
--- END RAW OCR TEXT ---

⚠️ PARSING RULES:

1. CURRENCY: Tesseract often misreads "₹" as "?", "R", "F", or "¥". If the receipt mentions GST, TIN, Indian addresses, or INR, the currency is "INR".
2. INVOICE NUMBER: Look for "INV#", "Invoice No", "Bill No", "Token No", "Check No". The word "DATE" is NEVER an invoice number.
3. MERCHANT NAME: The first reasonably sized, clear text string at the top.
4. AMOUNT (CRITICAL): Pick the FINAL payable amount (e.g., "Amount Payable", "NETT", "Grand Total"). Do NOT pick "Bill Total" or "SubTotal" if tax lines follow it.
5. TAXES: Search for "CGST", "SGST", "VAT", "Service Tax", "S.TAX" and map them to the taxBreakdown array.
6. ITEMS: Only real items (e.g. "CHHOLE BHATURE"). Do not invent items if you're not sure.
7. DATE: Format as YYYY-MM-DD. "26-02-2016" -> "2016-02-26".

Return ONLY the JSON. No explanation.

{
  "merchantName": "string",
  "netAmount": number,
  "preTaxSubtotal": number | null,
  "totalTaxAmount": number | null,
  "taxBreakdown": [ { "name": "string", "rate": number | null, "amount": number } ],
  "items": [ { "name": "string", "quantity": number | null, "rate": number | null, "amount": number } ],
  "date": "YYYY-MM-DD | null",
  "time": "HH:MM | null",
  "currency": "INR | USD | EUR | GBP | AED | JPY",
  "location": "INDIA | USA | EU | UAE | UK | UNKNOWN",
  "invoiceNumber": "string | null",
  "paymentMethod": "Cash | Card | UPI | Online | null",
  "category": "expense category",
  "subcategory": "specific type (Restaurant, Fast Food, Cafe, etc)",
  "description": "top 3 item names with amounts (e.g., Chhole Bhature ₹75)",
  "confidence": number
}
`;

export const scanReceiptWithGemini = async (imageBuffer: Buffer, mimeType: string) => {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not configured for Gemini OCR');
  }

  try {
    // ----------------------------------------------------------------------
    // STEP 1: Execute Open-Source Tesseract OCR
    // ----------------------------------------------------------------------
    logger.info('Starting open-source Tesseract OCR pass...');
    const tesseractResult = await Tesseract.recognize(
      imageBuffer,
      'eng', // Default to English for fastest execution
      {
        logger: m => {
          if (m.status === 'recognizing text' && Math.round(m.progress * 100) % 20 === 0) {
            logger.debug(`Tesseract progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );
    const rawOcrText = tesseractResult.data.text.trim();
    logger.info('Tesseract OCR pass complete', { extractedLength: rawOcrText.length });

    // ── Sanitise OCR text before feeding to LLM ──────────────────────
    const { sanitized: cleanText, flagged } = sanitizeAIInput(rawOcrText);
    if (flagged) {
      audit({
        event: 'ai.prompt_injection',
        resource: 'ocr',
        meta: { inputLength: rawOcrText.length, preview: rawOcrText.slice(0, 200) },
      });
      logger.warn('Prompt-injection pattern detected in OCR text – proceeding with sanitised input');
    }

    // ----------------------------------------------------------------------
    // STEP 2: Execute Gemini Mapping via circuit breaker
    // ----------------------------------------------------------------------
    logger.info('Starting Gemini JSON Mapping pass...');

    const jsonString = await withCircuitBreaker(
      { name: 'gemini-ocr', failureThreshold: 5, resetTimeoutMs: 60_000 },
      async () => {
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          systemInstruction: SYSTEM_INSTRUCTION,
          generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });

        const result = await model.generateContent([{ text: buildPrompt(cleanText) }]);
        let text = result.response.text().trim();

        // Strip markdown code fences if model wraps output in ```json ... ```
        text = text
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```\s*$/i, '')
          .trim();

        return sanitizeAIOutput(text);
      },
    );

    const parsed = JSON.parse(jsonString);

    // ── Validate parsed result ──────────────────────────────────────
    const validation = validateOcrResult(parsed);
    if (!validation.valid) {
      logger.warn('OCR result failed validation', { reason: validation.reason });
      throw new Error(`OCR result validation failed: ${validation.reason}`);
    }
    
    // Safety fallback for Tesseract hallucinated artifacts
    if (parsed.items) {
      parsed.items = parsed.items.filter((item: { name?: string }) => item.name && item.name.length > 2);
    }

    logger.info('Hybrid Tesseract+Gemini OCR success', {
      merchantName: parsed.merchantName,
      netAmount: parsed.netAmount,
      invoiceNumber: parsed.invoiceNumber,
    });

    return parsed;
  } catch (error: any) {
    logger.error('Hybrid OCR pipeline failed', { error: error.message || error });
    throw error;
  }
};
