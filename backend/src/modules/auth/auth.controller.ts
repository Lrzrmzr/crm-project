import { Request, Response } from 'express';
import * as authService from './auth.service';
import { ok, created, noContent, fail } from '../../utils/response.utils';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    const user = await authService.register(name, email, password);
    created(res, user);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EMAIL_TAKEN') { fail(res, 'Email already in use', 409); return; }
    fail(res, 'Registration failed', 500);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const { accessToken, refreshToken, user } = await authService.login(email, password);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    ok(res, { accessToken, user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'INVALID_CREDENTIALS') { fail(res, 'Invalid credentials', 401); return; }
    fail(res, 'Login failed', 500);
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = req.cookies?.refreshToken as string | undefined;
    if (!rawToken) { fail(res, 'No refresh token', 401); return; }
    const result = await authService.refresh(rawToken);
    ok(res, result);
  } catch {
    fail(res, 'Invalid or expired token', 401);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = req.cookies?.refreshToken as string | undefined;
    if (rawToken) await authService.logout(rawToken);
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    noContent(res);
  } catch {
    fail(res, 'Logout failed', 500);
  }
}