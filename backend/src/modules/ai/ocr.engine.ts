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
Translate it into structured JSON with professional-grade accuracy.

--- RAW OCR TEXT ---
${rawText}
--- END RAW OCR TEXT ---

⚠️ CRITICAL EXTRACTION RULES:

1. MERCHANT BLOCK: Look at the top 5-10 lines. Find the legal name, address (e.g., "Nana Chowk, Mumbai"), and Phone numbers ("Ph:", "Tel:").
2. DATE & BILL NO: Identify "Date", "Bill No", "Invoice No", "Token". If date is "01/07/17", year is 2017.
3. TABLE EXTRACTION (QTY/RATE/AMOUNT): 
   - Receipts often have columns: Particulars | Qty | Rate | Amount.
   - If an item line says "MEDU WADA 1 65 65", the quantity is 1, rate is 65, and amount is 65.
   - Verify: Qty * Rate should equal Amount.
4. TOTALS & TAXES (INDIA SPECIFIC):
   - "Sub Total": The raw sum of items.
   - "Dis" or "Discount": The amount subtracted. You MUST find this.
   - "Net Total" or "Taxable Value": Subtotal minus Discount.
   - "CGST" & "SGST": Usually 9% or 2.5% each. They MUST both be extracted.
   - "Grand Total": The final payable amount (e.g. 70). This is your netAmount.
5. CURRENCY: Always "INR" for Indian receipts.
6. GSTIN: The 15-character ID (e.g. 27AADFH5037M1Z6).

⚠️ MATH VALIDATION:
- Ensure (Subtotal - Discount + Taxes) roughly equals Grand Total.
- If they differ slightly (e.g. 69.62 vs 70), the "Grand Total" is the source of truth for the transaction amount.

Return ONLY the JSON. No explanation.

{
  "merchantName": "string",
  "netAmount": number (Grand Total / Final Payable),
  "preTaxSubtotal": number | null,
  "totalTaxAmount": number | null,
  "discountAmount": number | null,
  "taxBreakdown": [ { "name": "string", "rate": number | null, "amount": number } ],
  "gstin": "string | null",
  "items": [ { "name": "string", "quantity": number | null, "rate": number | null, "amount": number } ],
  "date": "YYYY-MM-DD | null",
  "time": "HH:MM | null",
  "currency": "INR",
  "location": "INDIA",
  "invoiceNumber": "string | null",
  "paymentMethod": "Cash | Card | UPI | Online | null",
  "category": "expense category",
  "subcategory": "specific type",
  "description": "Short summary of main items",
  "confidence": number (0.0 to 1.0)
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
          model: 'gemini-1.5-flash',
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
