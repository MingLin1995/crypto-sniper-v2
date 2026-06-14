"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useApp } from "@/components/AppProviders";
import { translations } from "@/lib/i18n";
import { ThemeLanguageSelector } from "@/components/ThemeLanguageSelector";

export default function RegisterPage() {
  const router = useRouter();
  const { locale } = useApp();
  const t = translations[locale];

  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Handle countdown timer for sending code
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const validateEmail = (emailStr: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  const handleSendCode = async () => {
    setError(null);
    setSuccess(null);

    if (!email) {
      setError(t.enterEmailFirst);
      return;
    }

    if (!validateEmail(email)) {
      setError(t.invalidEmail);
      return;
    }

    setSendingCode(true);

    try {
      const res = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || t.errorMsg.replace("{msg}", "發送失敗"));
      }

      setSuccess(t.codeSent);
      setCountdown(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 1. Email Format Verification
    if (!validateEmail(email)) {
      setError(t.invalidEmail);
      return;
    }

    // 2. Nickname validation
    if (!nickname.trim()) {
      setError(t.enterNickname);
      return;
    }

    // 3. Verification code validation
    if (!code || code.length !== 6) {
      setError(t.enterCode);
      return;
    }

    // 4. Password Format Verification
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      setError(t.invalidPassword);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nickname, password, code }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || t.errorMsg.replace("{msg}", "註冊失敗"));
      }

      setSuccess(t.registerSuccess);
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950/60 min-h-screen">
      <ThemeLanguageSelector />
      <Card className="w-full max-w-md border-indigo-500/20 glass-indigo">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {t.registerTitle}
          </CardTitle>
          <CardDescription>
            {t.registerDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
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

          <form onSubmit={handleRegister} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">{t.email}</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={countdown > 0 || sendingCode}
                  onClick={handleSendCode}
                  className="min-w-[100px] cursor-pointer"
                >
                  {countdown > 0 ? `${countdown}s` : sendingCode ? t.sending : t.sendCode}
                </Button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nickname">{t.nickname}</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="例如: 交易大師"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="code">{t.code}</Label>
              <Input
                id="code"
                type="text"
                maxLength={6}
                placeholder={t.enterCode}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                placeholder="至少 8 碼，需包含英文與數字"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" loading={loading} className="w-full mt-3 cursor-pointer">
              {t.registerBtn}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-900 light:border-zinc-200 pt-6">
          <div className="text-sm text-zinc-500">
            {t.hasAccount}{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              {t.loginLink}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}
