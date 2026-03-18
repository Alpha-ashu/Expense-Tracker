export const RECEIPT_OCR_SAMPLES = {
  labeledTotalWithTax: [
    'AI A TEA',
    'GSTIN: 27ABCDE1234F1Z5',
    'Invoice No: INV-1092',
    'Date: 09/06/25',
    'Subtotal 100.00',
    'Tax 3.00',
    'Grand Total 103.00',
    'Paid by UPI',
  ].join('\n'),

  deriveTaxFromSubtotalAndTotal: [
    'Fresh Basket Mart',
    'Date: 18/03/26',
    'Sub Total 450.00',
    'Grand Total 472.50',
    'Payment: Visa',
  ].join('\n'),

  deriveSubtotalFromTaxAndTotal: [
    'Metro Fuel Point',
    'Date: 17/03/26',
    'Tax 42.00',
    'Amount Payable 700.00',
    'Paid by card',
  ].join('\n'),

  metadataNoiseWithRealTotal: [
    'Store XYZ',
    'Account No: 123456789012',
    'GSTIN: 07ABCDE9999Z5',
    'Phone: 9999999999',
    'Ref: 20260318123456',
    'TOTAL 219.00',
  ].join('\n'),

  noisyItemLines: [
    'Tea House',
    'Date: 18/03/26',
    '> Masala Dosa 120.00',
    '. I No & .?? 71.00',
    'xxxxx | 4.00',
    'Grand Total 196.00',
  ].join('\n'),

  invalidFutureDate: [
    'Cafe Name',
    'Date: 09/06/2075',
    'Total 155.00',
  ].join('\n'),

  caravanMenuRestaurant: [
    'CARAVAN MENU',
    'Sun Magnetica Building',
    'Greens Road',
    'Louiswadi, Thane(W) 400604',
    'Tax Invoice',
    'Date : 30/12/24   Bill No. : 12827',
    'T.No. : 71        W. No. : 11',
    'Particulars       Qty Rate Amount',
    'SPICY MANGOLA 2 219 438',
    'STRAWBERRY & BASIL',
    'MOJITO',
    '4G 1 219 219',
    'KAALA KHATTA CHATPATTA 3 219 657',
    'MON TUES THURS DINNER 3 786 2358',
    'CHILLING GUAVA 1 219 219',
    'Sub Total : 10428.00',
    'CGST @2.5% : 260.70',
    'SGST @2.5% : 260.70',
    'Food Total : 10949.40',
    '7/18/1 Total : 10949',
    'GSTIN:- 27AANFC5730G1ZE',
    'FSSAI NO - 11517014000298',
    'VAT TIN :27311622151V',
    'Thank You Visit Again',
    '(09:18 PM)',
  ].join('\n'),

  // Date with dot separators (common in Indian printed bills)
  dotSeparatorDate: [
    'PO SHREYA RESTAURANT',
    'Dt. 15.03.2026',
    'Bill No. 66067',
    'Paneer Tikka 1 1728.00',
    'CGST 2.5% 43.00',
    'SGST 2.5% 43.00',
    'Grand Total 1814.00',
    'Cash',
  ].join('\n'),

  // Date with OCR-garbled separators (pipe/lowercase-L read)
  garbledSeparatorDate: [
    'HOTEL SHREYA',
    'Date: 15|03|2026',
    'Biryani 450.00',
    'Tax 22.50',
    'Total 472.50',
    'UPI',
  ].join('\n'),

  // Tax on standalone GST line without C/S prefix
  plainGstTaxLine: [
    'Fresh Cafe',
    'Date: 18/03/26',
    'Subtotal 500.00',
    'GST 25.00',
    'Total 525.00',
    'Card',
  ].join('\n'),

  // Spaced date separators
  spacedDate: [
    'BIRYANI HUB',
    'Date : 10 / 03 / 2026',
    'Bill No : 4521',
    'Total 680.00',
    'Cash',
  ].join('\n'),
};
