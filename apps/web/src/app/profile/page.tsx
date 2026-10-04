"use client";

import * as React from "react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useApp } from "@/components/AppProviders";
import { translations } from "@/lib/i18n";
import { ThemeLanguageSelector } from "@/components/ThemeLanguageSelector";

interface UserProfile {
  id: string;
  nickname: string;
  email: string | null;
  role: string;
  googleId: string | null;
  telegramId: string | null;
  telegramChatId: string | null;
  discordId: string | null;
  createdAt: string;
  hasPassword: boolean;
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useApp();
  const t = translations[locale];

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Telegram bot state
  const [botLoading, setBotLoading] = useState(false);
  const [botLink, setBotLink] = useState<{ token: string; botUrl: string } | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "CryptoSniper_MLvip_Bot";

  // Email Form State
  const [emailInput, setEmailInput] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Password Form State
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Re-bind Confirmation Modal State
  const [confirmRebindData, setConfirmRebindData] = useState<{ provider: string; rebindToken: string } | null>(null);
  const [submittingRebind, setSubmittingRebind] = useState(false);

  useEffect(() => {
    if (user) {
      setEmailInput(user.email || "");
    }
  }, [user]);

  // Countdown timer for resending verification code
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendVerificationCode = async () => {
    if (!emailInput) {
      setError(t.enterEmailFirst);
      return;
    }
    setError(null);
    setSuccess(null);
    setSendingCode(true);

    try {
      const res = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "發送驗證碼失敗");
      }

      setSuccess(t.codeSent);
      setCountdown(60); // 60s cooldown
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!emailInput) {
      setError(t.enterAllFields);
      return;
    }

    const isEmailChanged = emailInput !== (user?.email || "");
    if (!isEmailChanged) {
      return;
    }

    if (!verificationCode) {
      setError(t.enterCode);
      return;
    }

    setSavingEmail(true);
    try {
      const payload = {
        email: emailInput,
        code: verificationCode,
      };

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (locale === "zh-TW" ? "更新信箱失敗" : "Failed to update email"));
      }

      setSuccess(t.changeEmailSuccess);
      setVerificationCode("");
      fetchProfile(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!passwordInput || !confirmPasswordInput) {
      setError(t.enterAllFields);
      return;
    }

    if (user?.hasPassword && !currentPasswordInput) {
      setError(t.enterAllFields);
      return;
    }

    if (passwordInput !== confirmPasswordInput) {
      setError(t.passwordsDoNotMatch);
      return;
    }

    setSavingPassword(true);
    try {
      const payload: any = {
        password: passwordInput,
      };
      if (user?.hasPassword) {
        payload.currentPassword = currentPasswordInput;
      }

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (locale === "zh-TW" ? "更新密碼失敗" : "Failed to update password"));
      }

      setSuccess(t.changePasswordSuccess);
      setCurrentPasswordInput("");
      setPasswordInput("");
      setConfirmPasswordInput("");
      fetchProfile(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  // 1. Fetch user profile
  const fetchProfile = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/users/me");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error(t.errorMsg.replace("{msg}", "無法取得個人資料"));
      }
      const data = await res.json();
      setUser(data.data);
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [router, t.errorMsg]);

  useEffect(() => {
    fetchProfile();
  }, []);

  // 2. Read query parameters for status messages (OAuth callbacks)
  useEffect(() => {
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const msg = searchParams.get("message");
    const rebindToken = searchParams.get("rebindToken");

    if (status === "success") {
      setSuccess(t.linkedMsg.replace("{provider}", provider === "google" ? "Google" : "Discord"));
      router.replace("/profile");
    } else if (status === "error" && msg) {
      setError(decodeURIComponent(msg));
      router.replace("/profile");
    } else if (status === "confirm_rebind" && provider && rebindToken) {
      setConfirmRebindData({ provider, rebindToken });
      router.replace("/profile");
    }
  }, [searchParams, router, t]);

  // Handle Telegram link callback
  const handleTelegramLink = React.useCallback(async (telegramUser: any) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auth/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(telegramUser),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.rebindToken) {
          setConfirmRebindData({ provider: "telegram", rebindToken: data.rebindToken });
          return;
        }
        throw new Error(data.message || "Telegram 綁定失敗");
      }
      setSuccess(t.linkedMsg.replace("{provider}", "Telegram"));
      fetchProfile(true);
    } catch (err: any) {
      setError(err.message);
    }
  }, [fetchProfile, t.linkedMsg]);

  // Handle confirming forced social rebind
  const handleConfirmRebind = async () => {
    if (!confirmRebindData) return;
    setError(null);
    setSuccess(null);
    setSubmittingRebind(true);
    try {
      const res = await fetch("/api/auth/rebind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rebindToken: confirmRebindData.rebindToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "帳號合併綁定失敗");
      }
      setSuccess(locale === "zh-TW" ? "社交帳號已成功轉移並綁定至此帳戶！" : "Social account successfully transferred and linked!");
      setConfirmRebindData(null);
      fetchProfile(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingRebind(false);
    }
  };

  // 3. Dynamic loading of Telegram Widget for link action
  useEffect(() => {
    if (user && !user.telegramId) {
      window.onTelegramAuth = (telegramUser: any) => {
        handleTelegramLink(telegramUser);
      };

      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      script.setAttribute("data-telegram-login", botUsername);
      script.setAttribute("data-size", "medium");
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
      script.setAttribute("data-request-access", "write");

      const container = document.getElementById("telegram-link-container");
      if (container) {
        container.appendChild(script);
      }

      return () => {
        if (container) {
          container.replaceChildren();
        }
        delete window.onTelegramAuth;
      };
    }
  }, [user, handleTelegramLink]);

  // 4. Polling for Telegram Bot link status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPolling) {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/users/me");
          if (res.ok) {
            const resJson = await res.json();
            const data: UserProfile = resJson.data;
            if (data.telegramChatId) {
              setUser(data);
              setIsPolling(false);
              setBotLink(null);
              setSuccess("已成功透過 Telegram Bot 綁定！");
            }
          }
        } catch (err) {
          console.error("Polling profile failed", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isPolling]);



  // Get Telegram Bot Link Token
  const getTelegramBotToken = async () => {
    setBotLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/telegram/link-token");
      if (!res.ok) throw new Error("取得 Bot 連結失敗");
      const data = await res.json();
      setBotLink(data.data);
      setIsPolling(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBotLoading(false);
    }
  };

  // Unlink account
  const handleUnlink = async (provider: "google" | "discord" | "telegram") => {
    const providerName = provider === "google" ? "Google" : provider === "discord" ? "Discord" : "Telegram";
    const confirmMsg = locale === "zh-TW"
      ? `確定要解除與 ${providerName} 的連結嗎？`
      : `Are you sure you want to unlink your ${providerName} account?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/auth/${provider}/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "解綁失敗");
      }

      setSuccess(t.unlinkedMsg.replace("{provider}", providerName));
      fetchProfile(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("登出失敗", err);
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-zinc-400 animate-pulse text-lg">
          {locale === "zh-TW" ? "載入個人資料中..." : "Loading profile..."}
        </div>
      </div>
    );
  }

  if (!user) return null;

  const avatarLetter = (user.nickname || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Page Header with Avatar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-indigo-500/10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg shadow-indigo-500/30 border border-indigo-400/20 shrink-0">
            {avatarLetter}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {t.profileTitle}
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">{t.profileDesc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/screener")} className="cursor-pointer border-indigo-500/30 hover:bg-indigo-500/10">
            {locale === "zh-TW" ? "返回篩選器" : "Back to Screener"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/backtest")} className="cursor-pointer border-indigo-500/30 hover:bg-indigo-500/10">
            {locale === "zh-TW" ? "策略回測" : "Strategy Backtesting"}
          </Button>
          <Button data-testid="profile-logout-btn" variant="outline" onClick={handleLogout} className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer">
            {t.logoutBtn}
          </Button>
        </div>
      </div>

      {/* Error & Success Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Row 1: Profile Info + Account Security (2-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Info Card */}
        <Card data-testid="profile-info-card" className="border-indigo-500/15 glass-indigo animate-fade-in-up hover-premium">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-base">{t.basicTitle}</CardTitle>
                <CardDescription className="text-xs">{t.basicDesc}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="divide-y divide-zinc-800/40">
              <div className="flex justify-between items-center py-3">
                <span className="text-xs text-zinc-400 font-semibold">{t.nicknameLabel}</span>
                <span className="text-sm text-zinc-200 font-medium">{user.nickname}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-xs text-zinc-400 font-semibold">{t.emailLabel}</span>
                <span className="text-sm text-zinc-200 select-all max-w-[200px] truncate" title={user.email || ""}>
                  {user.email || (locale === "zh-TW" ? "未設定" : "Not set")}
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-xs text-zinc-400 font-semibold">
                  {locale === "zh-TW" ? "角色" : "Role"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase">
                  {user.role}
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-xs text-zinc-400 font-semibold">{t.createdAtLabel}</span>
                <span className="text-sm text-zinc-200">
                  {new Date(user.createdAt).toLocaleDateString(locale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Email Card */}
        <Card className="border-indigo-500/15 glass-indigo flex flex-col animate-fade-in-up delay-100 hover-premium">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-base">{t.changeEmailTitle}</CardTitle>
                <CardDescription className="text-xs">{t.changeEmailDesc}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            <form onSubmit={handleUpdateEmail} className="space-y-4 flex flex-col h-full justify-between">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="emailInput">{t.email}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="emailInput"
                      type="email"
                      placeholder="name@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                      className="flex-1"
                    />
                    {emailInput !== (user?.email || "") && (
                      <Button
                        type="button"
                        onClick={handleSendVerificationCode}
                        loading={sendingCode}
                        disabled={countdown > 0}
                        className="cursor-pointer shrink-0 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/25"
                        variant="outline"
                      >
                        {countdown > 0 ? `${countdown}s` : t.sendCode}
                      </Button>
                    )}
                  </div>
                </div>
                {emailInput !== (user?.email || "") && (
                  <div className="grid gap-2">
                    <Label htmlFor="verificationCodeInput">{t.code}</Label>
                    <Input
                      id="verificationCodeInput"
                      type="text"
                      placeholder="123456"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
              <Button type="submit" loading={savingEmail} disabled={emailInput === (user?.email || "")} className="w-full cursor-pointer mt-4 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                {t.saveBtn}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Change Password (full width) */}
      <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up delay-200 hover-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-base">{t.changePasswordTitle}</CardTitle>
              <CardDescription className="text-xs">{t.changePasswordDesc}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {user.hasPassword && (
                <div className="grid gap-2">
                  <Label htmlFor="currentPasswordInput">{t.currentPassword}</Label>
                  <Input
                    id="currentPasswordInput"
                    type="password"
                    placeholder="••••••••"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="passwordInput">{user.hasPassword ? t.newPassword : t.password}</Label>
                <Input
                  id="passwordInput"
                  type="password"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPasswordInput">{t.confirmPassword}</Label>
                <Input
                  id="confirmPasswordInput"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={savingPassword} className="cursor-pointer px-8 bg-indigo-600 hover:bg-indigo-500 text-white">
                {t.saveBtn}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Row 3: Linked Services */}
      <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up delay-300 hover-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-base">{t.oauthTitle}</CardTitle>
              <CardDescription className="text-xs">{t.oauthDesc}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Google Connection Tile */}
            <div className="flex flex-col justify-between p-5 rounded-xl bg-zinc-900/40 light:bg-slate-100/40 border border-zinc-800/80 light:border-zinc-200/80 hover:border-indigo-500/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-lg bg-zinc-800/80 light:bg-zinc-200 text-zinc-100 light:text-zinc-800 shrink-0">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.113-5.136 4.113-3.472 0-6.285-2.813-6.285-6.285A6.29 6.29 0 0 1 14 5.943c1.498 0 2.866.525 3.945 1.543l3.12-3.12C19.185 2.597 16.79 1.5 14 1.5c-5.79 0-10.5 4.71-10.5 10.5S8.21 22.5 14 22.5c5.78 0 10.5-4.71 10.5-10.5 0-.64-.075-1.285-.2-1.915h-12.06Z" />
                    </svg>
                  </div>
                  <div>
                    {user.googleId ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {locale === "zh-TW" ? "已連結" : "Linked"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                        {locale === "zh-TW" ? "未連結" : "Not Linked"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-zinc-200">{t.googleAccount}</h4>
                  <p className="text-xs text-zinc-400 overflow-hidden break-all min-h-8">
                    {user.googleId
                      ? t.googleBoundDesc.replace("{id}", user.googleId)
                      : (locale === "zh-TW" ? "連結 Google 帳戶快速登入" : "Link Google Account for fast login")}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                {user.googleId ? (
                  <Button variant="outline" size="sm" onClick={() => handleUnlink("google")} className="w-full border-red-500/25 text-red-400 hover:bg-red-500/10 cursor-pointer">
                    {t.unlinkBtn}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => {
                    window.location.href = "/api/auth/google?action=link";
                  }} className="w-full cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white">
                    {t.linkBtn}
                  </Button>
                )}
              </div>
            </div>

            {/* Discord Connection Tile */}
            <div className="flex flex-col justify-between p-5 rounded-xl bg-zinc-900/40 light:bg-slate-100/40 border border-zinc-800/80 light:border-zinc-200/80 hover:border-indigo-500/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-lg bg-zinc-800/80 light:bg-zinc-200 text-zinc-100 light:text-zinc-800 shrink-0">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
                    </svg>
                  </div>
                  <div>
                    {user.discordId ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {locale === "zh-TW" ? "已連結" : "Linked"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                        {locale === "zh-TW" ? "未連結" : "Not Linked"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-zinc-200">{t.discordAccount}</h4>
                  <p className="text-xs text-zinc-400 overflow-hidden break-all min-h-8">
                    {user.discordId
                      ? t.discordBoundDesc.replace("{id}", user.discordId)
                      : (locale === "zh-TW" ? "連結 Discord 帳戶快速登入以及接收到價通知" : "Link Discord Account for fast login and price notifications")}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                {user.discordId ? (
                  <Button variant="outline" size="sm" onClick={() => handleUnlink("discord")} className="w-full border-red-500/25 text-red-400 hover:bg-red-500/10 cursor-pointer">
                    {t.unlinkBtn}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => {
                    window.location.href = "/api/auth/discord?action=link";
                  }} className="w-full cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white">
                    {t.linkBtn}
                  </Button>
                )}
              </div>
            </div>

            {/* Telegram Connection Tile */}
            <div className="flex flex-col justify-between p-5 rounded-xl bg-zinc-900/40 light:bg-slate-100/40 border border-zinc-800/80 light:border-zinc-200/80 hover:border-indigo-500/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-lg bg-zinc-800/80 light:bg-zinc-200 text-zinc-100 light:text-zinc-800 shrink-0">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.35-.49.97-.74 3.79-1.65 6.32-2.73 7.59-3.25 3.61-1.48 4.36-1.74 4.85-1.75.11 0 .35.03.51.16.13.1.17.25.19.35.02.1.02.24.01.37z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {user.telegramId ? (
                      <>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {locale === "zh-TW" ? "已連結" : "Linked"}
                        </span>
                        {user.telegramChatId ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {locale === "zh-TW" ? "到價通知已啟用" : "Price Alerts Enabled"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {locale === "zh-TW" ? "到價通知未啟用" : "Price Alerts Disabled"}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                        {locale === "zh-TW" ? "未連結" : "Not Linked"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-zinc-200">{t.telegramAccount}</h4>
                  <p className="text-xs text-zinc-400 overflow-hidden break-all min-h-8">
                    {user.telegramId
                      ? t.tgBoundDesc.replace("{id}", user.telegramId)
                      : (locale === "zh-TW" ? "連結 Telegram 帳戶快速登入以及接收到價通知" : "Link Telegram Account for fast login and price notifications")}
                  </p>
                </div>
              </div>
              
              <div className="mt-4">
                {user.telegramId ? (
                  <div className="space-y-3">
                    {/* 機器人啟用通知按鈕 */}
                    {!user.telegramChatId && (
                      <div className="space-y-1.5">
                        {!botLink ? (
                          <Button size="sm" onClick={getTelegramBotToken} loading={botLoading} className="cursor-pointer w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">
                            {locale === "zh-TW" ? "啟用到價通知" : "Enable Price Notifications"}
                          </Button>
                        ) : (
                          <div className="space-y-1.5">
                            <Button size="sm" onClick={() => window.open(botLink.botUrl, "_blank")} className="cursor-pointer w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                              {t.openBot}
                            </Button>
                            <p className="text-[10px] text-indigo-400 leading-tight text-center">
                              {t.botGuidance}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* 解除綁定按鈕 */}
                    <Button variant="outline" size="sm" onClick={() => handleUnlink("telegram")} className="w-full border-red-500/25 text-red-400 hover:bg-red-500/10 cursor-pointer text-xs">
                      {t.unlinkBtn}
                    </Button>
                  </div>
                ) : (
                  <div className="group relative overflow-hidden h-[34px] w-full rounded-md">
                    <Button
                      size="sm"
                      className="w-full h-full flex items-center justify-center cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                    >
                      {t.linkBtn}
                    </Button>
                    <div
                      id="telegram-link-container"
                      className="absolute inset-0 z-10 cursor-pointer"
                      style={{ filter: "opacity(0)" }}
                    />
                    <style>{`
                      #telegram-link-container iframe {
                        width: 100% !important;
                        height: 100% !important;
                        min-width: 100% !important;
                        filter: opacity(0) !important;
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        transform: scale(3) !important;
                        transform-origin: center center !important;
                        cursor: pointer !important;
                        z-index: 10 !important;
                      }
                    `}</style>
                  </div>
                )}
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {confirmRebindData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-indigo-500/20 glass-indigo shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader>
              <div className="flex items-center gap-2 text-amber-400">
                <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <CardTitle className="text-lg">
                  {locale === "zh-TW" ? "社交帳號已被其他用戶綁定" : "Social Account Already Bound"}
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                {locale === "zh-TW"
                  ? `您正試圖綁定的 ${confirmRebindData.provider.toUpperCase()} 帳戶已被另一個帳戶連結。`
                  : `The ${confirmRebindData.provider.toUpperCase()} account you are trying to link is already connected to another profile.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-300 leading-relaxed">
                {locale === "zh-TW"
                  ? "是否要強制將該社交帳號「轉移並綁定」到此帳戶？"
                  : "Do you want to force transfer and link this social account to your current profile?"}
              </p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 leading-tight">
                <strong>{locale === "zh-TW" ? "⚠️ 注意：" : "⚠️ Warning:"}</strong>{" "}
                {locale === "zh-TW"
                  ? "轉移後，另一個臨時帳戶中的設定（如策略、最愛清單）將會被合併到此帳戶，且該臨時帳戶將會被軟刪除並登出。"
                  : "Once transferred, any settings (like strategies and watchlists) on the other account will be merged into this one, and the other temporary account will be soft-deleted."}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmRebindData(null)}
                disabled={submittingRebind}
                className="cursor-pointer border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              >
                {locale === "zh-TW" ? "取消" : "Cancel"}
              </Button>
              <Button
                onClick={handleConfirmRebind}
                loading={submittingRebind}
                className="cursor-pointer bg-amber-600 hover:bg-amber-500 text-white font-bold"
              >
                {locale === "zh-TW" ? "確認轉移並合併" : "Confirm Transfer & Merge"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-start p-6 md:p-12 bg-zinc-950/60 min-h-screen">
      <ThemeLanguageSelector />
      <Suspense fallback={<div className="text-zinc-500 text-sm">載入中...</div>}>
        <ProfileContent />
      </Suspense>
    </main>
  );
}
