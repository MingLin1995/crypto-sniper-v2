import { CookieOptions } from 'express';

export const ACCESS_TOKEN_COOKIE_OPTIONS = (isProd: boolean): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: 30 * 60 * 1000, // 30 分鐘
  path: '/',
});

export const REFRESH_TOKEN_COOKIE_OPTIONS = (isProd: boolean): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
  path: '/',
});
