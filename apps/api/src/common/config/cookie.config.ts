import { CookieOptions } from 'express';

export const getCookieDomain = (): string | undefined => {
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN;
  }
  const appDomain = process.env.APP_DOMAIN || process.env.WEB_DOMAIN;
  if (appDomain && !appDomain.includes('localhost') && !appDomain.includes('127.0.0.1')) {
    const parts = appDomain.split('.');
    if (parts.length >= 2) {
      return `.${parts.slice(-2).join('.')}`;
    }
  }
  return undefined;
};

export const ACCESS_TOKEN_COOKIE_OPTIONS = (isProd: boolean): CookieOptions => {
  const domain = getCookieDomain();
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000, // 30 分鐘
    path: '/',
    ...(domain ? { domain } : {}),
  };
};

export const REFRESH_TOKEN_COOKIE_OPTIONS = (isProd: boolean): CookieOptions => {
  const domain = getCookieDomain();
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    path: '/',
    ...(domain ? { domain } : {}),
  };
};
