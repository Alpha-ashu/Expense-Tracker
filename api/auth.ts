import { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthService } from '../backend/src/modules/auth/auth.service';

const authService = new AuthService();

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const sendJson = (res: VercelResponse, status: number, payload: Record<string, unknown>) => {
  res.status(status).json(payload);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 404, { success: false, error: 'Not found' });
    return;
  }

  const url = req.url || '';
  const isRegister = url.endsWith('/register');
  const isLogin = url.endsWith('/login');

  if (!isRegister && !isLogin) {
    sendJson(res, 404, { success: false, error: 'Not found' });
    return;
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};

  if (isRegister) {
    const { email, name, password } = body as Record<string, unknown>;

    if (!email || !name || !password) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: email, name, password',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      sendJson(res, 400, {
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
      return;
    }

    if (typeof password !== 'string' || password.length < 8) {
      sendJson(res, 400, {
        success: false,
        error: 'Password must be at least 8 characters long',
        code: 'PASSWORD_TOO_SHORT',
      });
      return;
    }

    try {
      const tokens = await authService.register({
        ...(body as Record<string, unknown>),
        email: email.toLowerCase().trim(),
        name: String(name).trim(),
        password,
      });

      sendJson(res, 201, {
        success: true,
        message: 'Registration successful',
        data: tokens,
      });
    } catch (error: any) {
      const message = error?.message || 'Registration failed';
      const isEmailExists = message.includes('UNIQUE constraint failed') || message === 'Email already registered';
      const isDatabaseError =
        message.includes('database') ||
        message.includes("Can't reach database") ||
        message.includes('Error validating datasource');

      sendJson(res, isEmailExists ? 409 : isDatabaseError ? 500 : 400, {
        success: false,
        error: isEmailExists
          ? 'This email is already registered. Please use a different email or try signing in.'
          : isDatabaseError
            ? 'Database error occurred. Please try again later.'
            : 'Registration failed. Please try again.',
        code: isEmailExists ? 'EMAIL_EXISTS' : isDatabaseError ? 'DATABASE_ERROR' : 'REGISTRATION_FAILED',
      });
    }
    return;
  }

  const { email, password } = body as Record<string, unknown>;

  if (!email || !password) {
    sendJson(res, 400, {
      success: false,
      error: 'Missing required fields: email, password',
      code: 'MISSING_FIELDS',
    });
    return;
  }

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    sendJson(res, 400, {
      success: false,
      error: 'Invalid email format',
      code: 'INVALID_EMAIL',
    });
    return;
  }

  try {
    const tokens = await authService.login({
      email: email.toLowerCase().trim(),
      password: String(password),
    });

    sendJson(res, 200, {
      success: true,
      message: 'Login successful',
      data: tokens,
    });
  } catch (error: any) {
    const message = error?.message || 'Login failed';
    const isDatabaseError =
      message.includes('database') ||
      message.includes("Can't reach database") ||
      message.includes('Error validating datasource');

    sendJson(res, isDatabaseError ? 500 : 401, {
      success: false,
      error: message === 'Invalid credentials'
        ? 'Invalid email or password. Please check your credentials and try again.'
        : isDatabaseError
          ? 'Database error occurred. Please try again later.'
          : 'Invalid email or password. Please check your credentials and try again.',
      code: message === 'Invalid credentials'
        ? 'INVALID_CREDENTIALS'
        : isDatabaseError
          ? 'DATABASE_ERROR'
          : 'LOGIN_FAILED',
    });
  }
}
