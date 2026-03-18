export interface ReceiptFormatConfig {
  name: string;
  patterns: {
    merchantName?: RegExp[];
    date?: RegExp[];
    total?: RegExp[];
    tax?: RegExp[];
    items?: RegExp[];
  };
  dateFormat: 'DD/MM/YY' | 'MM/DD/YY' | 'YYYY-MM-DD';
  currency: string;
}

export const RECEIPT_CONFIGS: ReceiptFormatConfig[] = [
  {
    name: 'Indian Restaurant',
    patterns: {
      merchantName: [/^([A-Z\s]+)(?:\n|$)/],
      date: [/Date\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i],
      total: [
        /Food\s*Total\s*:?\s*[₹Rs.]*\s*(\d+\.?\d*)/i,
        /Grand\s*Total\s*:?\s*[₹Rs.]*\s*(\d+\.?\d*)/i,
      ],
      tax: [/CGST.*?(\d+\.?\d*).*?SGST.*?(\d+\.?\d*)/is],
    },
    dateFormat: 'DD/MM/YY',
    currency: 'INR',
  },
  {
    name: 'US Retail',
    patterns: {
      merchantName: [/^([A-Za-z\s]+(?:Store|Mart|Shop))/i],
      date: [/(\d{2}\/\d{2}\/\d{4})/, /(\d{4}-\d{2}-\d{2})/],
      total: [/TOTAL\s*\$?(\d+\.\d{2})/i],
    },
    dateFormat: 'MM/DD/YY',
    currency: 'USD',
  },
];
