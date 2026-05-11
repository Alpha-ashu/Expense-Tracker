import type { VercelRequest, VercelResponse } from '@vercel/node';
import indexHandler from './index';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return await indexHandler(req, res);
}
