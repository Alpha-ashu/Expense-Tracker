import type { VercelRequest, VercelResponse } from '@vercel/node';

// Delegates to the main Express handler which includes auth protection
// eslint-disable-next-line @typescript-eslint/no-var-requires
const indexHandler = require('./index').default;

export default function handler(req: VercelRequest, res: VercelResponse) {
  return indexHandler(req, res);
}
