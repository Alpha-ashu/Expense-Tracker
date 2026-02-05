import { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthService } from '../backend/src/modules/auth/auth.service';

const authService = new AuthService();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    if (req.url?.endsWith('/register')) {
      try {
        const user = await authService.register(req.body);
        res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
      return;
    }
    if (req.url?.endsWith('/login')) {
      try {
        const tokens = await authService.login(req.body);
        res.status(200).json(tokens);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
      return;
    }
  }
  res.status(404).json({ error: 'Not found' });
}
