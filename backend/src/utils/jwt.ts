import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET ?? 'gm-bank-dev-secret-change-in-production';
const expiresIn = process.env.JWT_EXPIRES_IN ?? '7d';

export type JwtPayload = {
  sub: string;
  email: string;
  role?: 'client' | 'admin';
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}
