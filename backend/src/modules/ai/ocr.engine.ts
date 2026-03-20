import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { logger } from '../../config/logger';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

/**
 * Enhanced schema for global receipt extraction with:
 *  - location detection
 *  - full tax breakdown (CGST, SGST, VAT, Sales Tax, Service Tax, etc.)
 *  - context-based category classification
 *  - full item extraction with qty + rate
 *  - auto-generated smart description
 *  - total validation metadata
 */
const RECEIPT_SCHEMA: any = {
  description: 'Extracted receipt details',
  type: SchemaType.OBJECT,
  properties: {
    merchantName: {
      type: SchemaType.STRING,
      description: 'Name of the business, restaurant, or store',
    },
    date: {
      type: SchemaType.STRING,
      description: 'Date of transaction in YYYY-MM-DD format',
    },
    time: {
      type: SchemaType.STRING,
      description: 'Time of transaction (e.g., 14:35)',
    },
    amount: {
      type: SchemaType.NUMBER,
      description: 'Total amount payable (grand total / final amount)',
    },
    subtotal: {
      type: SchemaType.NUMBER,
      description: 'Total before taxes and discounts',
    },
    taxAmount: {
      type: SchemaType.NUMBER,
      description: 'Total tax amount (sum of all taxes)',
    },
    currency: {
      type: SchemaType.STRING,
      description: 'ISO 4217 currency code (e.g., INR, USD, EUR, AED)',
    },
    location: {
      type: SchemaType.STRING,
      description:
        'Detected country/region from bill signals. Use: INDIA | USA | EU | UAE | UK | AUSTRALIA | UNKNOWN',
    },
    invoiceNumber: {
      type: SchemaType.STRING,
      description: 'Bill or invoice number',
    },
    paymentMethod: {
      type: SchemaType.STRING,
      description: 'Payment method: CASH | CARD | UPI | ONLINE | BANK_TRANSFER',
    },
    category: {
      type: SchemaType.STRING,
      description:
        'Expense category based on CONTEXT (merchant type + items). Use: Food & Dining | Groceries | Shopping | Transportation | Health & Medical | Utilities | Entertainment | Travel | Business Expenses | Personal Care | Miscellaneous',
    },
    categorySignals: {
      type: SchemaType.OBJECT,
      description: 'Signals used to classify the category',
      properties: {
        merchantType: {
          type: SchemaType.STRING,
          description: 'Detected merchant type: restaurant | grocery_store | retail | pharmacy | hotel | transport | other',
        },
        isRestaurant: { type: SchemaType.BOOLEAN },
        isGrocery: { type: SchemaType.BOOLEAN },
        hasCookedItems: { type: SchemaType.BOOLEAN },
        hasRawItems: { type: SchemaType.BOOLEAN },
      },
    },
    items: {
      type: SchemaType.ARRAY,
      description: 'Line items detected on the receipt',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: 'Item name' },
          quantity: { type: SchemaType.NUMBER, description: 'Quantity ordered' },
          rate: { type: SchemaType.NUMBER, description: 'Unit price / rate' },
          amount: { type: SchemaType.NUMBER, description: 'Line total (qty × rate)' },
        },
        required: ['name', 'amount'],
      },
    },
    taxBreakdown: {
      type: SchemaType.ARRAY,
      description: 'Individual tax components extracted from the bill',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: 'Tax name: CGST | SGST | IGST | VAT | Sales Tax | Service Tax | GST | TRN',
          },
          rate: { type: SchemaType.NUMBER, description: 'Tax rate percentage (e.g., 2.5 for 2.5%)' },
          amount: { type: SchemaType.NUMBER, description: 'Tax amount in currency' },
        },
        required: ['name', 'amount'],
      },
    },
    description: {
      type: SchemaType.STRING,
      description:
        'Auto-generated smart description: top 3 items with prices joined by comma. Example: "Mutton Curry ₹350, Rice ₹50, Lassi ₹80"',
    },
    confidence: {
      type: SchemaType.NUMBER,
      description: 'Confidence score 0–1 for extraction accuracy',
    },
  },
  required: ['merchantName', 'amount', 'date'],
};

/**
 * Global OCR system prompt — handles bills from any country.
 */
const SYSTEM_PROMPT = `
You are a world-class financial data extraction and OCR engine that understands bills and receipts from ANY country.
Your task is to extract structured JSON from receipt/invoice images.

## STEP 1 — DETECT LOCATION FROM BILL SIGNALS
Use these signals to detect the country/region:
- ₹, GST, CGST, SGST, IGST, FSSAI → INDIA
- $, Sales Tax, USD → USA
- €, VAT, EUR → EU
- AED, TRN → UAE
- £, GBP, VAT → UK
- A$, GST (Australia) → AUSTRALIA
- No signals → UNKNOWN

## STEP 2 — EXTRACT MERCHANT (always at top in bold/large text)
Look for restaurant name, store name, company name at the header.

## STEP 3 — EXTRACT LINE ITEMS
Parse tables with columns like: Item | Qty | Rate | Amount
For each item extract: name, quantity, rate, lineTotal.
Stop at subtotal/total/tax boundary lines.

## STEP 4 — EXTRACT TAX BREAKDOWN (VERY IMPORTANT)
Extract ALL individual tax components separately:
- India: CGST, SGST, IGST (each often at 2.5%, 5%, 9%, 14%)
- EU/UK: VAT (at various rates)
- USA: Sales Tax
- UAE: VAT / TRN tax
Store each as: { name, rate, amount }
Also compute taxAmount = sum of all tax components.

## STEP 5 — CONTEXT-BASED CATEGORY (DO NOT use keywords blindly)
Use MULTIPLE signals:
1. Merchant type → restaurant/cafe/hotel/dhaba → "Food & Dining"
2. Item types → curry/biryani/fried/meal/beverage → "Food & Dining"
3. Item types → raw/kg/fresh/vegetables/fruits → "Groceries"
4. Tax pattern → restaurant service charge → "Food & Dining"
5. Merchant type → supermarket/mart → "Groceries"

Example: "Mutton" at a dhaba → "Food & Dining". "Mutton 1kg" at a grocery store → "Groceries".

## STEP 6 — GENERATE SMART DESCRIPTION
Auto-generate: top 3 items joined by comma with amounts.
Example: "Chicken Biryani ₹280, Raita ₹40, Pepsi ₹60"

## STEP 7 — VALIDATE TOTAL
The amount field must be the GRAND TOTAL (Amount Payable / Net Amount / Bill Total).
Do NOT blindly trust printed total — validate by checking: subtotal + taxes ≈ total.

## DATE FORMAT
Always normalize date to YYYY-MM-DD.

## CURRENCY CODE
Return proper ISO 4217 code: INR, USD, EUR, GBP, AED, AUD, etc.

Always return closest valid JSON. Omit fields that cannot be found.
`;

export const scanReceiptWithGemini = async (imageBuffer: Buffer, mimeType: string) => {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not configured for Gemini OCR');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RECEIPT_SCHEMA,
      },
    });

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    return JSON.parse(text);
  } catch (error) {
    logger.error('Gemini OCR extraction failed', { error });
    throw error;
  }
};
