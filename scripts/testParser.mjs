// Test the new end-anchored block parser against real Canara Bank PDF structure
const simulatedLines = [
  'UPI/DR/301929587807/GOPALAKRI/YESB/**88521@YBL/SENT',
  '04-05-2026 USI//PTM36A39E9BB82F4B84B3DD346BC3811B1A/04/05/2026',
  '35.00 4.54',
  '11:31:10',
  'Chq: 301929587807',
  'UPI/CR/612687378189/MRS. KM//IDIB/**EE900@OKSBI/PETROL//SBIF29D4BC3135B4B7C84',
  '06-05-2026 C92D286518F410/06/05/2026',
  '500.00 504.54',
  '12:07:45',
  'Chq: 612687378189',
  'UPI/DR/302048383359/MR MANIKA/YESB/**FLMX9@PTYS/SENT',
  '06-05-2026 USI//PTM9C8F487E034643FA8C3CDF3006D9E9FB/06/05/2026',
  '32.00 472.54',
  'Chq: 302048383359',
  'UPI/DR/302051797637/CAFE MILA/SIBL/**R.MIL@SIB/SENTUSI//PTMBB9B8F425DB54ADA9',
  '06-05-2026 07F659B2D611148/06/05/2026',
  '15.00 457.54',
  'Chq: 302051797637',
];

const SKIP_RE = /^\s*(?:statement for|opening balance|closing balance|page\s*\d+|date\s+particulars|sl\.?\s*no|deposits\s+withdrawals|deposits|withdrawals|narration|\*{3,}|-{5,}|={5,})/i;
const TRAILING_PAIR_RE = /[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s*$/;
const TXN_DATE_RE = /\b(\d{2}-(?:\d{2}|[A-Za-z]{3,9})-\d{4})\b/;
const CHQ_RE = /^(?:chq|ref)\s*:\s*\d+/i;

const blocks = [];
let acc = [];
for (const line of simulatedLines) {
  if (SKIP_RE.test(line)) continue;
  if (CHQ_RE.test(line)) { if (blocks.length > 0) blocks[blocks.length-1].push(line); continue; }
  acc.push(line);
  if (TRAILING_PAIR_RE.test(line)) { blocks.push([...acc]); acc = []; }
}
if (acc.length > 0) blocks.push(acc);

console.log('Blocks found:', blocks.length, '(expected 4)');
blocks.forEach((block, i) => {
  const full = block.join(' ');
  const dm = full.match(TXN_DATE_RE);
  const amts = (full.match(/[\d,]+\.\d{2}/g) || []).map(v => parseFloat(v.replace(/,/g, '')));
  const merchantMatch = full.match(/UPI\/(?:DR|CR)\/\d+\/([^/]+)\//i);
  const upiType = /UPI\/CR/i.test(full) ? 'income' : 'expense';
  const txnAmt = amts[amts.length - 2];
  const balance = amts[amts.length - 1];
  console.log('Block ' + (i+1) + ': date=' + (dm && dm[1]) + ' amt=' + txnAmt + ' bal=' + balance + ' type=' + upiType + ' merchant=' + (merchantMatch && merchantMatch[1]));
});
