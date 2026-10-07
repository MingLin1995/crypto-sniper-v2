"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useApp } from "@/components/AppProviders";
import { translations } from "@/lib/i18n";
import { ThemeLanguageSelector } from "@/components/ThemeLanguageSelector";
import { Turnstile, TurnstileRef } from "@/components/ui/Turnstile";

declare global {
  interface Window {
    onTelegramAuth?: (user: any) => void;
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, theme } = useApp();
  const t = translations[locale];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef<TurnstileRef>(null);

  // 動態獲取後端 Turnstile 啟用狀態與公鑰，避免容器建置期與執行期金鑰脫節
  const [turnstileConfig, setTurnstileConfig] = useState<{
    enabled: boolean;
    siteKey: string;
  }>({
    enabled: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
  });

  useEffect(() => {
    fetch("/api/auth/turnstile-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        const cfg = resData?.data;
        if (cfg && typeof cfg.enabled === "boolean") {
          setTurnstileConfig({
            enabled: cfg.enabled && Boolean(cfg.siteKey),
            siteKey: cfg.siteKey || "",
          });
        }
      })
      .catch(() => {});
  }, []);

  const isTurnstileRequired = turnstileConfig.enabled && Boolean(turnstileConfig.siteKey);

  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
    setError(null);
  }, []);

  const handleTurnstileError = useCallback((errorCode?: string) => {
    console.warn("[Login] Turnstile 驗證事件異常:", errorCode);
    setTurnstileToken(null);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  // Bot username from env or fallback
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "CryptoSniper_MLvip_Bot";

  const targetFrom = searchParams.get("from") || "/screener";

  useEffect(() => {
    // Handle error/success messages passed via query parameters (e.g. from OAuth redirects)
    const status = searchParams.get("status");
    const msg = searchParams.get("message");
    if (status === "error" && msg) {
      setError(decodeURIComponent(msg));
    } else if (status === "success") {
      setSuccess(t.loginSuccess);
      setTimeout(() => {
        router.push(targetFrom);
      }, 1500);
    }
  }, [searchParams, router, t, targetFrom]);

  // Load Telegram Widget dynamically
  useEffect(() => {
    window.onTelegramAuth = (user: any) => {
      onTelegramLoginSuccess(user);
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");

    const container = document.getElementById("telegram-login-container");
    if (container) {
      container.appendChild(script);
    }

    return () => {
      if (container) {
        container.replaceChildren();
      }
      delete window.onTelegramAuth;
    };
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t.enterAllFields);
      return;
    }

    if (isTurnstileRequired && !turnstileToken) {
      setError("請先完成安全驗證");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || t.loginSuccess.replace("成功！", "失敗"));
      }

      setSuccess(t.loginSuccess);
      setTimeout(() => {
        router.push(targetFrom);
      }, 1000);
    } catch (err: any) {
      setError(err.message);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  };

  const onTelegramLoginSuccess = async (user: any) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/telegram/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Telegram 登入失敗");
      }

      setSuccess(t.loginSuccess);
      setTimeout(() => {
        router.push("/screener");
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-indigo-500/20 glass-indigo animate-fade-in-up hover-premium">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          {t.loginTitle}
        </CardTitle>
        <CardDescription>
          {t.loginDesc}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Error & Success Messages */}
        {error && (
          <div data-testid="login-error-message" className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        {success && (
          <div data-testid="login-success-message" className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm text-center">
            {success}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">{t.email}</Label>
            <Input
              id="email"
              data-testid="login-email-input"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t.password}</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
              >
                {t.forgotPasswordLink}
              </Link>
            </div>
            <Input
              id="password"
              data-testid="login-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {isTurnstileRequired && (
            <Turnstile
              ref={turnstileRef}
              siteKey={turnstileConfig.siteKey}
              theme={theme}
              onSuccess={handleTurnstileSuccess}
              onError={handleTurnstileError}
              onExpire={handleTurnstileExpire}
            />
          )}

          <Button
            data-testid="login-submit-button"
            type="submit"
            loading={loading}
            disabled={loading || (isTurnstileRequired && !turnstileToken)}
            className="w-full mt-2 cursor-pointer"
          >
            {t.loginBtn}
          </Button>
        </form>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span 
              className="px-2 text-zinc-500 rounded"
              style={{ backgroundColor: "var(--card)" }}
            >
              {t.orOAuth}
            </span>
          </div>
        </div>

        {/* 3-Column Unified Third Party Logins Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Google Button */}
          <Button
            variant="outline"
            className="flex items-center justify-center px-2 py-1.5 cursor-pointer h-10"
            onClick={() => {
              window.location.href = "/api/auth/google?action=login";
            }}
          >
            <svg className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
              <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
            </svg>
            Google
          </Button>

          {/* Discord Button */}
          <Button
            variant="outline"
            className="flex items-center justify-center px-2 py-1.5 cursor-pointer h-10"
            onClick={() => {
              window.location.href = "/api/auth/discord?action=login";
            }}
          >
            <svg className="mr-1.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
            </svg>
          </Button>

          {/* Styled Telegram Button with transparent overlay */}
          <div className="group relative overflow-hidden h-10 rounded-md">
            <Button
              variant="outline"
              className="w-full h-full flex items-center justify-center px-2 py-1.5 cursor-pointer group-hover:bg-secondary group-hover:text-secondary-foreground group-hover:border-indigo-500/30"
            >
              <svg className="mr-1.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.35-.49.97-.74 3.79-1.65 6.32-2.73 7.59-3.25 3.61-1.48 4.36-1.74 4.85-1.75.11 0 .35.03.51.16.13.1.17.25.19.35.02.1.02.24.01.37z"/>
              </svg>
              Telegram
            </Button>
            {/* The transparent official Telegram login widget */}
            <div
              id="telegram-login-container"
              className="absolute inset-0 z-10 cursor-pointer"
              style={{ filter: "opacity(0)" }}
            />
            {/* Override styles for the telegram widget iframe */}
            <style>{`
              #telegram-login-container iframe {
                width: 100% !important;
                height: 100% !important;
                min-width: 100% !important;
                filter: opacity(0) !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                transform: scale(2.5) !important;
                cursor: pointer !important;
              }
            `}</style>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-900 light:border-zinc-200 pt-6">
        <div className="text-sm text-zinc-500">
          {t.noAccount}{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            {t.registerNow}
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950/60 min-h-screen">
      <ThemeLanguageSelector />
      <Link href="/" className="flex items-center gap-2.5 mb-6 group" title="返回首頁">
        <div className="bg-indigo-600/10 p-2 rounded-2xl border border-indigo-500/20 group-hover:scale-105 transition-all shadow-md shadow-indigo-500/10">
          <img src="/icon.png" alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
        </div>
        <span className="text-2xl font-extrabold bg-gradient-to-r from-zinc-900 via-slate-800 to-indigo-600 dark:from-zinc-50 dark:via-zinc-100 dark:to-indigo-400 bg-clip-text text-transparent">
          CryptoSniper V2
        </span>
      </Link>
      <Suspense fallback={<div className="text-zinc-500 text-sm">載入中...</div>}>
        <LoginContent />
      </Suspense>
    </main>
  );
}
