import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { logger } from '../../config/logger';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

/**
 * Enhanced schema for receipt extraction
 */
const RECEIPT_SCHEMA: any = {
    description: "Extracted receipt details",
    type: SchemaType.OBJECT,
    properties: {
        merchantName: { type: SchemaType.STRING, description: "Name of the restaurant or store" },
        date: { type: SchemaType.STRING, description: "Date of the transaction in YYYY-MM-DD format" },
        time: { type: SchemaType.STRING, description: "Time of the transaction" },
        amount: { type: SchemaType.NUMBER, description: "Total amount payable (final amount)" },
        subtotal: { type: SchemaType.NUMBER, description: "Total before taxes and discounts" },
        taxAmount: { type: SchemaType.NUMBER, description: "Total tax amount (sum of GST, VAT, etc.)" },
        currency: { type: SchemaType.STRING, description: "Currency code (default INR)" },
        invoiceNumber: { type: SchemaType.STRING, description: "Bill or Invoice number" },
        items: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING },
                    quantity: { type: SchemaType.NUMBER },
                    rate: { type: SchemaType.NUMBER },
                    amount: { type: SchemaType.NUMBER }
                },
                required: ["name", "amount"]
            }
        },
        taxes: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING, description: "Tax name (e.g., CGST, SGST, VAT, Service Tax)" },
                    rate: { type: SchemaType.NUMBER },
                    amount: { type: SchemaType.NUMBER }
                }
            }
        },
        paymentMethod: { type: SchemaType.STRING, description: "CASH, CARD, UPI, etc." },
        confidence: { type: SchemaType.NUMBER, description: "Confidence score 0-1" }
    },
    required: ["merchantName", "amount", "date"]
};

/**
 * System prompt to "teach" the model about these specific bills
 */
const SYSTEM_PROMPT = `
You are an expert OCR and document analysis engine specialized in Indian restaurant bills.
Your task is to extract structured JSON data from receipt images.

PAY ATTENTION to these patterns found in common Indian bills:
1. MERCHANT: Usually at the very top in large or bold text (e.g., "HIRA SWEETS", "RESTAURANT SHREYAS").
2. DATE: Often in DD-MM-YYYY or DD/MM/YY format. Normalize to YYYY-MM-DD.
3. ITEMS: Look for tables with columns like Description, Qty, Rate, Amount.
4. TAXES: Common taxes include CGST, SGST, VAT (@12.5% or @14.5%), Service Tax (@5.6% or @6%).
5. TOTAL: Look for "Amount Payable", "Net Amount", "Nett", or "Bill Total". This is the final value to extract as 'amount'.
6. ROUND OFF: Many bills have a small "Round Off" value to make the total a whole number.

EXAMPLES of bills you should recognize:
- "HIRA SWEETS": Has "CHHOLE BHATURE" as an item.
- "RESTAURANT SHREYAS": Has "THALI MEAL" with quantity like 5.
- "PARIVAAR RESTAURANT": Has items like "Apollo Fish" and "Kadai Chicken".
- "NAIR MESS": High contrast dot-matrix print with items like "MUTTON FRY".

Always return the closest valid JSON matching the provided schema.
If a field is not found, leave it null or omit it.
`;

export const scanReceiptWithGemini = async (imageBuffer: Buffer, mimeType: string) => {
    if (!GOOGLE_API_KEY) {
        throw new Error('GOOGLE_API_KEY is not configured for Gemini OCR');
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: RECEIPT_SCHEMA,
            },
        });

        const result = await model.generateContent([
            SYSTEM_PROMPT,
            {
                inlineData: {
                    data: imageBuffer.toString('base64'),
                    mimeType: mimeType
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();
        return JSON.parse(text);
    } catch (error) {
        logger.error('Gemini OCR extraction failed', { error });
        throw error;
    }
};
