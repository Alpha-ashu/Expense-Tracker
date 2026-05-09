import type { VercelRequest, VercelResponse } from '@vercel/node';

// All auth routes (register, login, etc.) are handled by the main Express app.
// This file delegates to api/index.ts handler to avoid duplicate transpilation issues.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const indexHandler = require('./index').default;

export default function handler(req: VercelRequest, res: VercelResponse) {
  return indexHandler(req, res);
}
