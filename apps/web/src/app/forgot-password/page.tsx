"use client";

import * as React from "react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useApp } from "@/components/AppProviders";
import { translations } from "@/lib/i18n";
import { ThemeLanguageSelector } from "@/components/ThemeLanguageSelector";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useApp();
  const t = translations[locale];

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-fill email from query parameters if present
  useEffect(() => {
    const queryEmail = searchParams.get("email");
    if (queryEmail) {
      setEmail(queryEmail);
    }
  }, [searchParams]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError(t.enterEmailFirst || "請先輸入電子信箱");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "發送失敗");
      }

      setSuccess(t.codeSent || "驗證碼已發送至您的信箱");
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !password || !confirmPassword) {
      setError(t.enterAllFields);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.passwordsDoNotMatch);
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "重設密碼失敗");
      }

      setSuccess(t.resetPasswordSuccess);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-indigo-500/20 glass-indigo">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          {t.forgotPasswordTitle}
        </CardTitle>
        <CardDescription>
          {t.forgotPasswordDesc}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Error & Success Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm text-center">
            {success}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" loading={loading} className="w-full mt-2 cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white">
              {t.sendResetCodeBtn}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email-disabled">{t.email}</Label>
              <Input
                id="email-disabled"
                type="email"
                value={email}
                disabled
                className="bg-zinc-900/50 text-zinc-400 cursor-not-allowed"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">{t.code}</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">{t.confirmPassword}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" loading={loading} className="w-full mt-2 cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white">
              {t.resetPasswordBtn}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-center border-t border-zinc-900 light:border-zinc-200 pt-6">
        <Link href="/login" className="text-sm text-indigo-400 hover:text-indigo-300 hover:underline transition-colors font-medium">
          {t.backToLogin}
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950/60 min-h-screen">
      <ThemeLanguageSelector />
      <Link href="/" className="flex items-center gap-2.5 mb-6 group" title="返回首頁">
        <div className="bg-indigo-600/10 p-2 rounded-2xl border border-indigo-500/20 group-hover:scale-105 transition-all shadow-md shadow-indigo-500/10">
          <img src="/icon.png" alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
        </div>
        <span className="text-2xl font-extrabold bg-gradient-to-r from-zinc-50 via-zinc-100 to-indigo-400 bg-clip-text text-transparent">
          CryptoSniper V2
        </span>
      </Link>
      <Suspense fallback={<div className="text-zinc-500 text-sm">載入中...</div>}>
        <ForgotPasswordContent />
      </Suspense>
    </main>
  );
}
