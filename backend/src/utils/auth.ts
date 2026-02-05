import { SignJWT, jwtVerify } from 'jose';
import { AuthTokens } from '../modules/auth/auth.types';

// Security: No fallback secret - application must fail if JWT_SECRET is not set
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export const generateTokens = async (userId: string): Promise<AuthTokens> => {
  const accessToken = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(secret);

  const refreshToken = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);

  return { accessToken, refreshToken };
};

export const verifyToken = async (token: string): Promise<{ userId: string }> => {
  const { payload } = await jwtVerify(token, secret);
  return payload as { userId: string };
};