"use client";

import * as React from "react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  discordId: string | null;
  createdAt: string;
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

    if (status === "success") {
      setSuccess(t.linkedMsg.replace("{provider}", provider === "google" ? "Google" : "Discord"));
      router.replace("/profile");
    } else if (status === "error" && msg) {
      setError(decodeURIComponent(msg));
      router.replace("/profile");
    }
  }, [searchParams, router, t]);

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
      script.setAttribute("data-size", "large");
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
            if (data.telegramId) {
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
        throw new Error(data.message || "Telegram 綁定失敗");
      }
      setSuccess(t.linkedMsg.replace("{provider}", "Telegram"));
      fetchProfile(true);
    } catch (err: any) {
      setError(err.message);
    }
  }, [fetchProfile, t.linkedMsg]);

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

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Upper Navigation Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-indigo-500/10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {t.profileTitle}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">{t.profileDesc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/screener")} className="cursor-pointer border-indigo-500/30 hover:bg-indigo-500/10">
            {locale === "zh-TW" ? "返回篩選器" : "Back to Screener"}
          </Button>
          <Button variant="outline" onClick={handleLogout} className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer">
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Left Column: Profile Card */}
        <Card className="md:col-span-1 border-indigo-500/15 glass-indigo">
          <CardHeader>
            <CardTitle>{t.basicTitle}</CardTitle>
            <CardDescription>{t.basicDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{t.emailLabel}</span>
              <span className="text-sm font-medium text-zinc-200">{user.email || (locale === "zh-TW" ? "未設定" : "Not set")}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{t.nicknameLabel}</span>
              <span className="text-sm font-medium text-zinc-200">{user.nickname}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{t.roleLabel}</span>
              <span className="text-sm font-medium text-zinc-200">
                <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                  {user.role}
                </span>
              </span>
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{t.createdAtLabel}</span>
              <span className="text-sm font-medium text-zinc-200">
                {new Date(user.createdAt).toLocaleDateString(locale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Linked Services */}
        <Card className="md:col-span-2 border-indigo-500/15 glass-indigo">
          <CardHeader>
            <CardTitle>{t.oauthTitle}</CardTitle>
            <CardDescription>
              {t.oauthDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Google Bind Row */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 light:bg-slate-100/50 border border-zinc-800 light:border-zinc-200 gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 rounded bg-zinc-800/80 light:bg-zinc-200 text-zinc-100 light:text-zinc-800 shrink-0">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.113-5.136 4.113-3.472 0-6.285-2.813-6.285-6.285A6.29 6.29 0 0 1 14 5.943c1.498 0 2.866.525 3.945 1.543l3.12-3.12C19.185 2.597 16.79 1.5 14 1.5c-5.79 0-10.5 4.71-10.5 10.5S8.21 22.5 14 22.5c5.78 0 10.5-4.71 10.5-10.5 0-.64-.075-1.285-.2-1.915h-12.06Z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold">{t.googleAccount}</h4>
                  <p className="text-xs text-zinc-400 mt-0.5 break-all select-all">
                    {user.googleId
                      ? t.googleBoundDesc.replace("{id}", user.googleId)
                      : (locale === "zh-TW" ? "尚未連結 Google 帳戶" : "Not linked to Google")}
                  </p>
                </div>
              </div>
              <div>
                {user.googleId ? (
                  <Button variant="outline" size="sm" onClick={() => handleUnlink("google")} className="border-red-500/25 text-red-400 hover:bg-red-500/10 cursor-pointer">
                    {t.unlinkBtn}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => {
                    window.location.href = "/api/auth/google?action=link";
                  }} className="cursor-pointer">
                    {t.linkBtn}
                  </Button>
                )}
              </div>
            </div>

            {/* Discord Bind Row */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 light:bg-slate-100/50 border border-zinc-800 light:border-zinc-200 gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 rounded bg-zinc-800/80 light:bg-zinc-200 text-zinc-100 light:text-zinc-800 shrink-0">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold">{t.discordAccount}</h4>
                  <p className="text-xs text-zinc-400 mt-0.5 break-all select-all">
                    {user.discordId
                      ? t.discordBoundDesc.replace("{id}", user.discordId)
                      : (locale === "zh-TW" ? "尚未連結 Discord 帳戶" : "Not linked to Discord")}
                  </p>
                </div>
              </div>
              <div>
                {user.discordId ? (
                  <Button variant="outline" size="sm" onClick={() => handleUnlink("discord")} className="border-red-500/25 text-red-400 hover:bg-red-500/10 cursor-pointer">
                    {t.unlinkBtn}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => {
                    window.location.href = "/api/auth/discord?action=link";
                  }} className="cursor-pointer">
                    {t.linkBtn}
                  </Button>
                )}
              </div>
            </div>

            {/* Telegram Bind Row with two options */}
            <div className="p-4 rounded-lg bg-zinc-900/50 light:bg-slate-100/50 border border-zinc-800 light:border-zinc-200 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded bg-zinc-800/80 light:bg-zinc-200 text-zinc-100 light:text-zinc-800 shrink-0">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.35-.49.97-.74 3.79-1.65 6.32-2.73 7.59-3.25 3.61-1.48 4.36-1.74 4.85-1.75.11 0 .35.03.51.16.13.1.17.25.19.35.02.1.02.24.01.37z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold">{t.telegramAccount}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5 break-all select-all">
                      {user.telegramId
                        ? t.tgBoundDesc.replace("{id}", user.telegramId)
                        : t.tgUnboundDesc}
                    </p>
                  </div>
                </div>
                <div>
                  {user.telegramId && (
                    <Button variant="outline" size="sm" onClick={() => handleUnlink("telegram")} className="border-red-500/25 text-red-400 hover:bg-red-500/10 cursor-pointer">
                      {t.unlinkBtn}
                    </Button>
                  )}
                </div>
              </div>

              {/* Linking interfaces if not bound */}
              {!user.telegramId && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/60 light:border-zinc-200">
                  {/* Option 1: Widget */}
                  <div className="flex flex-col items-center justify-between p-3 rounded bg-zinc-950/40 light:bg-slate-200/30 border border-zinc-800/50 light:border-zinc-200">
                    <span className="text-xs font-semibold text-zinc-400 mb-2">{t.tgMethodA}</span>

                    {/* Styled Telegram Button with transparent overlay */}
                    <div className="group relative overflow-hidden h-10 w-full max-w-[200px] rounded-md">
                      <Button
                        variant="outline"
                        className="w-full h-full flex items-center justify-center cursor-pointer group-hover:bg-secondary group-hover:text-secondary-foreground group-hover:border-indigo-500/30"
                      >
                        <svg className="mr-1.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.35-.49.97-.74 3.79-1.65 6.32-2.73 7.59-3.25 3.61-1.48 4.36-1.74 4.85-1.75.11 0 .35.03.51.16.13.1.17.25.19.35.02.1.02.24.01.37z" />
                        </svg>
                        {t.tgMethodA}
                      </Button>
                      <div
                        id="telegram-link-container"
                        className="absolute inset-0 opacity-0 z-10 cursor-pointer"
                      />
                      <style>{`
                        #telegram-link-container iframe {
                          width: 100% !important;
                          height: 100% !important;
                          min-width: 100% !important;
                          opacity: 0 !important;
                          position: absolute !important;
                          top: 0 !important;
                          left: 0 !important;
                          transform: scale(2.5) !important;
                          cursor: pointer !important;
                          z-index: 10 !important;
                        }
                      `}</style>
                    </div>
                  </div>

                  {/* Option 2: Bot */}
                  <div className="flex flex-col items-center justify-between p-3 rounded bg-zinc-950/40 light:bg-slate-200/30 border border-zinc-800/50 light:border-zinc-200">
                    <span className="text-xs font-semibold text-zinc-400 mb-2">{t.tgMethodB}</span>

                    {!botLink ? (
                      <Button size="sm" variant="secondary" onClick={getTelegramBotToken} loading={botLoading} className="cursor-pointer">
                        {t.getBotLink}
                      </Button>
                    ) : (
                      <div className="flex flex-col items-center gap-2 w-full text-center">
                        <Button size="sm" onClick={() => window.open(botLink.botUrl, "_blank")} className="cursor-pointer">
                          {t.openBot}
                        </Button>
                        <p className="text-[11px] text-indigo-400 leading-tight">
                          {t.botGuidance}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </CardContent>
        </Card>

      </div>
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
