"use client";

import * as React from "react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useApp } from "@/components/AppProviders";
import { translations } from "@/lib/i18n";
import { ThemeLanguageSelector } from "@/components/ThemeLanguageSelector";
import { Bell, Plus, Trash2, ShieldAlert, Volume2, Settings, ExternalLink, RefreshCw, CheckCircle2, XCircle, Pencil } from "lucide-react";

interface PriceAlert {
  id: string;
  symbol: string;
  condition: "ABOVE" | "BELOW";
  targetPrice: string;
  currentPrice: number | null;
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
}

interface UserProfile {
  id: string;
  nickname: string;
  telegramChatId: string | null;
  discordWebhook: string | null;
  telegramId: string | null;
}

const COMMON_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "LINKUSDT"];

function urlBase64ToUint8Array(base64String: string) {
  if (!base64String) {
    throw new Error("VAPID public key is empty or undefined");
  }
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function AlertsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useApp();
  const t = translations[locale];

  // Tabs state
  const [activeTab, setActiveTab] = useState<"active" | "history" | "channels">("active");

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "channels" || tab === "history" || tab === "active") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Data state
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New alert form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [symbolInput, setSymbolInput] = useState("");
  const [conditionInput, setConditionInput] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [priceInput, setPriceInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);

  const handleOpenCreateModal = () => {
    const hasTelegram = !!user?.telegramChatId;
    const hasDiscord = !!user?.discordWebhook;
    const hasPush = pushSubscribed;

    if (!hasTelegram && !hasDiscord && !hasPush) {
      setError(
        locale === "zh-TW"
          ? "請先設定並啟用至少一種通知管道 (瀏覽器推送、Discord Webhook 或 Telegram Bot) 才能新增通知。"
          : "Please enable at least one notification channel (Browser Push, Discord Webhook, or Telegram Bot) first before creating notifications."
      );
      setActiveTab("channels");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError(null);
    setEditingAlertId(null);
    setSymbolInput("");
    setConditionInput("ABOVE");
    setPriceInput("");
    setIsCreateOpen(true);
  };

  const handleOpenEditModal = (alert: PriceAlert) => {
    setError(null);
    setEditingAlertId(alert.id);
    setSymbolInput(alert.symbol);
    setConditionInput(alert.condition);
    setPriceInput(alert.targetPrice);
    setIsCreateOpen(true);
  };

  // Discord webhook form state
  const [discordWebhookInput, setDiscordWebhookInput] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);

  // Telegram bot state
  const [botLoading, setBotLoading] = useState(false);
  const [botLink, setBotLink] = useState<{ token: string; botUrl: string } | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Web Push state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "CryptoSniper_MLvip_Bot";

  const fetchUserAndAlerts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch user profile
      const userRes = await fetch("/api/users/me");
      if (!userRes.ok) {
        if (userRes.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error(t.errorMsg.replace("{msg}", "無法取得個人資料"));
      }
      const userData = await userRes.json();
      setUser(userData.data);
      setDiscordWebhookInput(userData.data.discordWebhook || "");

      // Fetch alerts
      const alertsRes = await fetch("/api/alerts");
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserAndAlerts();

    // Check Web Push support
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setPushSupported(true);
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.pushManager.getSubscription().then((subscription) => {
            setPushSubscribed(!!subscription);
          });
        } else {
          setPushSubscribed(false);
        }
      });
    }

    // Poll current prices for active alerts every 10 seconds
    const interval = setInterval(() => {
      fetchUserAndAlerts(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Poll Telegram Chat ID binding status
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
              setSuccess(locale === "zh-TW" ? "已成功透過 Telegram Bot 綁定！" : "Successfully bound via Telegram Bot!");
            }
          }
        } catch (err) {
          console.error("Polling profile failed", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isPolling, locale]);

  // Handle Telegram linking
  const getTelegramBotToken = async () => {
    setBotLoading(true);
    setError(null);
    setSuccess(null);
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

  // Handle Discord Webhook saving
  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingWebhook(true);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordWebhook: discordWebhookInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "儲存 Discord Webhook 失敗");
      }

      setSuccess(t.successMsg);
      if (user) {
        setUser({ ...user, discordWebhook: discordWebhookInput });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingWebhook(false);
    }
  };

  // Handle Discord Webhook clearing (disabling channel)
  const handleClearWebhook = async () => {
    setError(null);
    setSuccess(null);
    setSavingWebhook(true);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordWebhook: null }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "停用 Discord Webhook 失敗");
      }

      setSuccess(locale === "zh-TW" ? "已成功停用 Discord 通知管道！" : "Discord notification channel disabled successfully!");
      setDiscordWebhookInput("");
      if (user) {
        setUser({ ...user, discordWebhook: null });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingWebhook(false);
    }
  };

  // Handle Telegram Bot disconnection (disabling channel)
  const handleDisconnectTelegram = async () => {
    setError(null);
    setSuccess(null);
    setBotLoading(true);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramChatId: null }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "停用 Telegram 失敗");
      }

      setSuccess(locale === "zh-TW" ? "已成功停用 Telegram 通知管道！" : "Telegram notification channel disabled successfully!");
      if (user) {
        setUser({ ...user, telegramChatId: null });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBotLoading(false);
    }
  };

  // Web Push Subscription toggling
  const handleToggleWebPush = async () => {
    if (!pushSupported) return;
    setError(null);
    setSuccess(null);
    setPushLoading(true);

    try {
      if (pushSubscribed) {
        // Unsubscribe
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
            await fetch("/api/notifications/web-push/unsubscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: subscription.endpoint }),
            });
          }
        }
        setPushSubscribed(false);
        setSuccess(t.webPushUnsubscribed);
      } else {
        // Subscribe
        // Request browser permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error(locale === "zh-TW" ? "瀏覽器拒絕了通知權限" : "Notification permission denied");
        }

        // Register Service Worker if not registered
        let registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          registration = await navigator.serviceWorker.register("/sw.js");
        }

        const publicKeyRes = await fetch("/api/notifications/web-push/public-key");
        if (!publicKeyRes.ok) {
          throw new Error("無法獲取 VAPID 公鑰");
        }
        const pubKeyData = await publicKeyRes.json();
        const publicKey = pubKeyData.data?.publicKey || pubKeyData.publicKey;

        if (!registration.active) {
          registration = await navigator.serviceWorker.ready;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const p256dh = btoa(
          Array.from(new Uint8Array(subscription.getKey("p256dh") as any))
            .map((val) => String.fromCharCode(val))
            .join("")
        );
        const auth = btoa(
          Array.from(new Uint8Array(subscription.getKey("auth") as any))
            .map((val) => String.fromCharCode(val))
            .join("")
        );

        const subscribeRes = await fetch("/api/notifications/web-push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            p256dh,
            auth,
          }),
        });

        if (!subscribeRes.ok) {
          throw new Error("向後端註冊訂閱失敗");
        }

        setPushSubscribed(true);
        setSuccess(t.webPushSubscribed);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPushLoading(false);
    }
  };

  // Toggle alert active status
  const handleToggleAlert = async (id: string) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/alerts/${id}/toggle`, {
        method: "PATCH",
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === id
              ? {
                  ...alert,
                  isActive: !alert.isActive,
                  isTriggered: !alert.isActive ? false : alert.isTriggered,
                  triggeredAt: !alert.isActive ? null : alert.triggeredAt,
                }
              : alert
          )
        );
        setSuccess(t.toggleAlertSuccess);
      } else {
        const data = await res.json();
        throw new Error(data.message || "更新狀態失敗");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete Alert
  const handleDeleteAlert = async (id: string) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAlerts((prev) => prev.filter((alert) => alert.id !== id));
        setSuccess(t.deleteAlertSuccess);
      } else {
        const data = await res.json();
        throw new Error(data.message || "刪除失敗");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Submit new or updated alert
  const handleSubmitAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    const targetPrice = parseFloat(priceInput);

    if (!symbol || isNaN(targetPrice) || targetPrice <= 0) {
      setError(t.enterAllFields);
      return;
    }

    if (!/^[A-Z0-9]{1,12}USDT$/.test(symbol)) {
      setError(t.invalidSymbolError);
      return;
    }

    const hasTelegram = !!user?.telegramChatId;
    const hasDiscord = !!user?.discordWebhook;
    const hasPush = pushSubscribed;

    if (!hasTelegram && !hasDiscord && !hasPush) {
      setError(
        locale === "zh-TW"
          ? "請先設定並啟用至少一種通知管道 (瀏覽器推送、Discord Webhook 或 Telegram Bot)"
          : "Please enable at least one notification channel (Browser Push, Discord Webhook, or Telegram Bot) first."
      );
      return;
    }

    setError(null);
    setSuccess(null);
    setCreating(true);

    try {
      const url = editingAlertId ? `/api/alerts/${editingAlertId}` : "/api/alerts";
      const method = editingAlertId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          condition: conditionInput,
          targetPrice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (editingAlertId ? "修改價格通知失敗" : "新增價格通知失敗"));
      }

      setSuccess(editingAlertId ? (locale === "zh-TW" ? "已成功修改價格通知！" : "Price notification updated successfully!") : t.addAlertSuccess);
      setIsCreateOpen(false);
      setSymbolInput("");
      setPriceInput("");
      setEditingAlertId(null);
      fetchUserAndAlerts(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Separate active alerts and history
  const activeAlerts = alerts.filter((alert) => alert.isActive && !alert.isTriggered);
  const triggeredHistory = alerts.filter((alert) => !alert.isActive || alert.isTriggered);

  // Compute stats
  const totalCount = alerts.length;
  const activeCount = activeAlerts.length;
  const triggeredCount = alerts.filter((alert) => alert.isTriggered).length;

  return (
    <div className="w-full max-w-7xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-indigo-500/10 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2.5">
            <Bell className="h-7 w-7 text-indigo-400 animate-bounce" />
            {t.alertsTitle}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">{t.alertsDesc}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/screener")}
            className="cursor-pointer border-indigo-500/30 hover:bg-indigo-500/10 text-zinc-200 text-sm"
          >
            {locale === "zh-TW" ? "返回篩選器" : "Back to Screener"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/backtest")}
            className="cursor-pointer border-indigo-500/30 hover:bg-indigo-500/10 text-zinc-200 text-sm"
          >
            {locale === "zh-TW" ? "策略回測" : "Strategy Backtesting"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/profile")}
            className="cursor-pointer border-indigo-500/30 hover:bg-indigo-500/10 text-zinc-200 text-sm"
          >
            {locale === "zh-TW" ? "個人帳號設定" : "Account Settings"}
          </Button>
        </div>
      </div>

      {/* Message Renders */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-sm transition-all duration-300">
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-sm transition-all duration-300">
          ✨ {success}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up hover-premium">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
              {locale === "zh-TW" ? "總通知數量" : "Total Alerts"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-white light:text-zinc-900">{totalCount}</div>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up delay-100 hover-premium">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
              {locale === "zh-TW" ? "監控中通知" : "Active Alerts"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-indigo-400">{activeCount}</div>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up delay-200 hover-premium">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
              {locale === "zh-TW" ? "已觸發次數" : "Total Triggered"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-400">{triggeredCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Navigation Tabs (col-span-3) */}
        <div className="lg:col-span-3 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
          <button
            onClick={() => setActiveTab("active")}
            data-testid="alerts-active-tab"
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "active"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-zinc-100 text-zinc-400 light:text-zinc-600 hover:text-zinc-200 light:hover:text-zinc-900 hover:bg-zinc-800/40 light:hover:bg-zinc-200/50 border border-zinc-800/80 light:border-zinc-200"
            }`}
          >
            🔔 {t.activeAlertsTab}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            data-testid="alerts-history-tab"
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-zinc-100 text-zinc-400 light:text-zinc-600 hover:text-zinc-200 light:hover:text-zinc-900 hover:bg-zinc-800/40 light:hover:bg-zinc-200/50 border border-zinc-800/80 light:border-zinc-200"
            }`}
          >
            📜 {t.alertHistoryTab}
          </button>
          <button
            onClick={() => setActiveTab("channels")}
            data-testid="alerts-channels-tab"
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "channels"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-zinc-100 text-zinc-400 light:text-zinc-600 hover:text-zinc-200 light:hover:text-zinc-900 hover:bg-zinc-800/40 light:hover:bg-zinc-200/50 border border-zinc-800/80 light:border-zinc-200"
            }`}
          >
            ⚙️ {t.notificationSettingsTab}
          </button>
        </div>

        {/* Tab content (col-span-9) */}
        <div className="lg:col-span-9 space-y-6">
          {/* TAB 1: Active Alerts */}
          {activeTab === "active" && (
            <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up hover-premium">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-indigo-500/10">
                <div>
                  <CardTitle className="text-lg">🔔 {t.activeAlertsTab}</CardTitle>
                  <CardDescription className="text-xs text-zinc-400 mt-1">
                    {locale === "zh-TW" ? "點擊開關以啟用/停用到價通知，系統將每 10s 更新最新價格。" : "Toggle alerts or create new targets. Prices update every 10 seconds."}
                  </CardDescription>
                </div>
                <Button
                  data-testid="alerts-create-btn"
                  onClick={handleOpenCreateModal}
                  className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  {t.createAlertBtn}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {activeAlerts.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-sm">
                    {t.noActiveAlerts}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm divide-y divide-zinc-800/40">
                      <thead>
                        <tr className="text-zinc-400 light:text-zinc-500 font-semibold bg-zinc-900/20 light:bg-zinc-100/50">
                          <th className="px-6 py-4">{locale === "zh-TW" ? "交易對" : "Symbol"}</th>
                          <th className="px-6 py-4">{t.conditionLabel}</th>
                          <th className="px-6 py-4">{t.targetPriceLabel}</th>
                          <th className="px-6 py-4">{t.currentPriceLabel}</th>
                          <th className="px-6 py-4">{locale === "zh-TW" ? "目標距離" : "Price Distance"}</th>
                          <th className="px-6 py-4">{locale === "zh-TW" ? "啟用狀態" : "Active"}</th>
                          <th className="px-6 py-4 text-right">{locale === "zh-TW" ? "操作" : "Action"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/20 text-zinc-200 light:text-zinc-800">
                        {activeAlerts.map((alert) => {
                          const currentVal = alert.currentPrice;
                          const targetVal = parseFloat(alert.targetPrice);
                          let distanceStr = "-";
                          let distanceColor = "text-zinc-400";

                          if (currentVal !== null) {
                            const diffPercent = ((targetVal - currentVal) / currentVal) * 100;
                            const absPercent = Math.abs(diffPercent).toFixed(2);
                            if (alert.condition === "ABOVE") {
                              distanceStr = currentVal >= targetVal ? "0%" : `+${absPercent}%`;
                              distanceColor = currentVal >= targetVal ? "text-emerald-400" : "text-amber-400";
                            } else {
                              distanceStr = currentVal <= targetVal ? "0%" : `-${absPercent}%`;
                              distanceColor = currentVal <= targetVal ? "text-emerald-400" : "text-amber-400";
                            }
                          }

                          return (
                            <tr key={alert.id} className="hover:bg-zinc-900/30 transition-all">
                              <td className="px-6 py-4 font-bold tracking-wider">{alert.symbol}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                                  alert.condition === "ABOVE"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                                }`}>
                                  {alert.condition === "ABOVE" 
                                    ? (locale === "zh-TW" ? "▲ 高於" : "▲ ABOVE") 
                                    : (locale === "zh-TW" ? "▼ 低於" : "▼ BELOW")}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono font-bold text-zinc-300 light:text-zinc-700">{alert.targetPrice}</td>
                              <td className="px-6 py-4 font-mono">
                                {currentVal !== null ? (
                                  <span className="text-zinc-400 light:text-zinc-600">{currentVal}</span>
                                ) : (
                                  <span className="text-zinc-600 animate-pulse">Loading...</span>
                                )}
                              </td>
                              <td className={`px-6 py-4 font-mono font-bold ${distanceColor}`}>{distanceStr}</td>
                              <td className="px-6 py-4">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={alert.isActive}
                                    onChange={() => handleToggleAlert(alert.id)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                                </label>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => handleOpenEditModal(alert)}
                                    className="text-zinc-500 hover:text-indigo-400 transition-colors p-1 cursor-pointer"
                                    title={locale === "zh-TW" ? "編輯" : "Edit"}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAlert(alert.id)}
                                    className="text-zinc-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
                                    title={locale === "zh-TW" ? "刪除" : "Delete"}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 2: Trigger History */}
          {activeTab === "history" && (
            <Card data-testid="alerts-history-card" className="border-indigo-500/15 glass-indigo animate-fade-in-up hover-premium">
              <CardHeader className="pb-4 border-b border-indigo-500/10">
                <CardTitle className="text-lg">📜 {t.alertHistoryTab}</CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-1">
                  {locale === "zh-TW" ? "檢視已觸發的價格通知歷史與手動關閉的通知日誌。" : "View history of triggered notifications and manually disabled alerts."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {triggeredHistory.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-sm">
                    {t.noAlertHistory}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm divide-y divide-zinc-800/40">
                      <thead>
                        <tr className="text-zinc-400 light:text-zinc-500 font-semibold bg-zinc-900/20 light:bg-zinc-100/50">
                          <th className="px-6 py-4">{locale === "zh-TW" ? "交易對" : "Symbol"}</th>
                          <th className="px-6 py-4">{t.conditionLabel}</th>
                          <th className="px-6 py-4">{t.targetPriceLabel}</th>
                          <th className="px-6 py-4">{locale === "zh-TW" ? "觸發狀態" : "Trigger Status"}</th>
                          <th className="px-6 py-4">{locale === "zh-TW" ? "事件時間" : "Time"}</th>
                          <th className="px-6 py-4 text-right">{locale === "zh-TW" ? "操作" : "Action"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/20 text-zinc-200 light:text-zinc-800">
                        {triggeredHistory.map((alert) => (
                          <tr key={alert.id} className="hover:bg-zinc-900/30 transition-all opacity-80">
                            <td className="px-6 py-4 font-bold tracking-wider">{alert.symbol}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                alert.condition === "ABOVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                              }`}>
                                {alert.condition === "ABOVE" 
                                  ? (locale === "zh-TW" ? "▲ 高於" : "▲ ABOVE") 
                                  : (locale === "zh-TW" ? "▼ 低於" : "▼ BELOW")}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono text-zinc-300 light:text-zinc-700">{alert.targetPrice}</td>
                            <td className="px-6 py-4">
                              {alert.isTriggered ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {locale === "zh-TW" ? "已觸發" : "Triggered"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-zinc-400 light:text-zinc-600 font-bold bg-zinc-800 dark:bg-zinc-800 light:bg-zinc-200 border border-zinc-700 light:border-zinc-300 px-2 py-0.5 rounded-full">
                                  <XCircle className="h-3 w-3" />
                                  {locale === "zh-TW" ? "手動關閉" : "Disabled"}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-zinc-400 light:text-zinc-550 text-xs font-mono">
                              {alert.triggeredAt
                                ? new Date(alert.triggeredAt).toLocaleString(locale, {
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })
                                : new Date(alert.createdAt).toLocaleString(locale, {
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {!alert.isActive && (
                                  <button
                                    onClick={() => handleToggleAlert(alert.id)}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 cursor-pointer font-bold"
                                  >
                                    {locale === "zh-TW" ? "重啟" : "Restart"}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteAlert(alert.id)}
                                  className="text-zinc-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 3: Notification Channels */}
          {activeTab === "channels" && (
            <div className="space-y-6">
              {/* Web Push */}
              <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up hover-premium">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Volume2 className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t.webPushLabel}</CardTitle>
                      <CardDescription className="text-xs text-zinc-400 mt-1">
                        {locale === "zh-TW" ? "訂閱瀏覽器推送，即使不開啟網頁也能在系統工具列收到即時通知。" : "Enable system-level background notifications from your browser."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/20 dark:bg-zinc-900/20 light:bg-zinc-100/50 border border-zinc-800/40 light:border-zinc-200">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-zinc-200 light:text-zinc-800">
                        {locale === "zh-TW" ? "瀏覽器訂閱狀態" : "Push Subscription Status"}
                      </h4>
                      <p className="text-xs text-zinc-400 light:text-zinc-600">
                        {!pushSupported
                          ? t.webPushUnsupported
                          : pushSubscribed
                          ? (locale === "zh-TW" ? "已啟用 (瀏覽器背景接收)" : "Active (Receiving in background)")
                          : (locale === "zh-TW" ? "尚未啟用訂閱" : "Not enabled")}
                      </p>
                    </div>
                    <Button
                      onClick={handleToggleWebPush}
                      loading={pushLoading}
                      disabled={!pushSupported}
                      className={`cursor-pointer text-xs font-bold ${
                        pushSubscribed
                          ? "border border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/10"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white"
                      }`}
                    >
                      {pushSubscribed ? t.webPushUnsubscribeBtn : t.webPushSubscribeBtn}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Discord Webhook */}
              <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up delay-100 hover-premium">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{locale === "zh-TW" ? "Discord Webhook 管道" : "Discord Webhook Alert"}</CardTitle>
                      <CardDescription className="text-xs text-zinc-400 mt-1">
                        {locale === "zh-TW" ? "設定您的 Discord 頻道 Webhook，將行情到價通知自動分流送往指定頻道。" : "Configure custom Discord webhook to push price alerts directly to your private server."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleSaveWebhook} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="discordWebhook">{t.discordWebhookLabel}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="discordWebhook"
                          type="url"
                          placeholder="https://discord.com/api/webhooks/..."
                          value={discordWebhookInput}
                          onChange={(e) => setDiscordWebhookInput(e.target.value)}
                          className="flex-1 font-mono text-xs border-indigo-500/25 bg-zinc-950/40 light:bg-white"
                        />
                        <Button type="submit" loading={savingWebhook} className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0">
                          {t.saveSettingsBtn}
                        </Button>
                        {user?.discordWebhook && (
                          <Button
                            type="button"
                            onClick={handleClearWebhook}
                            loading={savingWebhook}
                            className="cursor-pointer border border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/10 text-xs font-bold shrink-0"
                          >
                            {locale === "zh-TW" ? "停用通知" : "Disable Notifications"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </form>

                  {/* Discord Guide (Steps) */}
                  <div className="p-4 rounded-xl bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-zinc-100/50 border border-zinc-800/80 light:border-zinc-200 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-400 tracking-wider flex items-center gap-1.5">
                      <Settings className="h-3.5 w-3.5" />
                      {t.discordGuideTitle}
                    </h4>
                    <ol className="text-xs text-zinc-400 light:text-zinc-650 space-y-2 list-decimal list-inside leading-relaxed pl-1">
                      <li>{t.discordGuideStep1}</li>
                      <li>{t.discordGuideStep2}</li>
                      <li>{t.discordGuideStep3}</li>
                      <li>{t.discordGuideStep4}</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              {/* Telegram Bot */}
              <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up delay-200 hover-premium">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t.telegramAccount}</CardTitle>
                      <CardDescription className="text-xs text-zinc-400 mt-1">
                        {locale === "zh-TW" ? "啟用 Telegram 機器人一對一私聊接收行情到價即時推送。" : "Receive one-on-one notifications using our official Telegram Bot."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/20 dark:bg-zinc-900/20 light:bg-zinc-100/50 border border-zinc-800/40 light:border-zinc-200">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-zinc-200 light:text-zinc-800">
                        {locale === "zh-TW" ? "Telegram 通知狀態" : "Telegram Alert Status"}
                      </h4>
                      <p className="text-xs text-zinc-400 light:text-zinc-600">
                        {user?.telegramChatId
                          ? (locale === "zh-TW" ? "已連線並啟用到價通知" : "Connected and active")
                          : (locale === "zh-TW" ? "尚未啟動機器人通知" : "Inactive")}
                      </p>
                    </div>

                    {user?.telegramChatId ? (
                      <div className="shrink-0 w-full sm:w-auto">
                        <Button
                          size="sm"
                          onClick={handleDisconnectTelegram}
                          loading={botLoading}
                          className="cursor-pointer w-full border border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/10 text-xs font-bold"
                        >
                          {locale === "zh-TW" ? "停用通知" : "Disable Notifications"}
                        </Button>
                      </div>
                    ) : (
                      <div className="shrink-0 w-full sm:w-auto">
                        {!botLink ? (
                          <Button
                            size="sm"
                            onClick={getTelegramBotToken}
                            loading={botLoading}
                            className="cursor-pointer w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                          >
                            {locale === "zh-TW" ? "啟用到價通知" : "Enable Alerts"}
                          </Button>
                        ) : (
                          <div className="space-y-1.5 text-center">
                            <Button
                              size="sm"
                              onClick={() => window.open(botLink.botUrl, "_blank")}
                              className="cursor-pointer w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs flex items-center justify-center gap-1"
                            >
                              {t.openBot}
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {botLink && (
                    <div className="text-[10.5px] text-amber-400/90 light:text-amber-800 leading-normal text-center bg-amber-500/5 border border-amber-500/10 light:border-amber-500/25 p-3 rounded-lg">
                      ⚠️ {t.botGuidance}
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-zinc-100/50 border border-zinc-800/80 light:border-zinc-200 space-y-2">
                    <h4 className="text-xs font-bold text-indigo-400 tracking-wider flex items-center gap-1.5">
                      <Settings className="h-3.5 w-3.5" />
                      {t.telegramGuideTitle}
                    </h4>
                    <ol className="text-xs text-zinc-400 light:text-zinc-650 space-y-2 list-decimal list-inside leading-relaxed pl-1">
                      <li>{t.telegramGuideStep1}</li>
                      <li>{t.telegramGuideStep2}</li>
                      <li>{t.telegramGuideStep3}</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* CREATE ALERT MODAL DIALOG */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-indigo-500/20 glass-indigo shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="pb-3 border-b border-indigo-500/10">
              <CardTitle className="text-lg flex items-center gap-2 text-zinc-900 dark:text-white">
                <Bell className="h-5 w-5 text-indigo-400 animate-pulse" />
                {editingAlertId
                  ? (locale === "zh-TW" ? "編輯到價通知" : "Edit Price Notification")
                  : (locale === "zh-TW" ? "自訂到價通知" : "Create Price Notification")}
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                {locale === "zh-TW" ? "僅限 USDT 永續合約。設定目標價格與大於或小於條件。" : "Only USDT futures supported. Set target price and threshold condition."}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmitAlert}>
              <CardContent className="space-y-4 pt-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs leading-relaxed transition-all duration-300 animate-in slide-in-from-top-1">
                    ⚠️ {error}
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label htmlFor="symbol">{locale === "zh-TW" ? "合約交易對" : "Symbol"}</Label>
                  <Input
                    id="symbol"
                    type="text"
                    placeholder={t.symbolPlaceholder}
                    value={symbolInput}
                    onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                    required
                    className="border-indigo-500/20 font-mono tracking-wider"
                  />
                  {/* Common suggestions */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {COMMON_SYMBOLS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSymbolInput(s)}
                        className="text-[10px] bg-zinc-900 dark:bg-zinc-900 light:bg-zinc-100 hover:bg-zinc-800 light:hover:bg-zinc-200 text-zinc-400 light:text-zinc-600 hover:text-white light:hover:text-zinc-900 px-2 py-0.5 rounded border border-zinc-800 light:border-zinc-200 transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label>{t.conditionLabel}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConditionInput("ABOVE")}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        conditionInput === "ABOVE"
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-extrabold"
                          : "bg-zinc-950 dark:bg-zinc-950 light:bg-zinc-100 border-zinc-800 light:border-zinc-200 text-zinc-400 light:text-zinc-650 hover:text-zinc-200 light:hover:text-zinc-900"
                      }`}
                    >
                      ▲ {locale === "zh-TW" ? "大於或等於" : "ABOVE (>=)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConditionInput("BELOW")}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        conditionInput === "BELOW"
                          ? "bg-red-500/15 border-red-500 text-red-400 font-extrabold"
                          : "bg-zinc-950 dark:bg-zinc-950 light:bg-zinc-100 border-zinc-800 light:border-zinc-200 text-zinc-400 light:text-zinc-650 hover:text-zinc-200 light:hover:text-zinc-900"
                      }`}
                    >
                      ▼ {locale === "zh-TW" ? "小於或等於" : "BELOW (<=)"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="targetPrice">{t.targetPriceLabel}</Label>
                  <Input
                    id="targetPrice"
                    type="number"
                    step="any"
                    placeholder="e.g. 68500"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    required
                    className="border-indigo-500/20 font-mono"
                  />
                </div>
              </CardContent>

              <CardFooter className="flex justify-end gap-3 pt-2 pb-4 border-t border-indigo-500/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setError(null);
                    setEditingAlertId(null);
                    setSymbolInput("");
                    setPriceInput("");
                  }}
                  disabled={creating}
                  className="cursor-pointer border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs"
                >
                  {locale === "zh-TW" ? "取消" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  loading={creating}
                  className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  {editingAlertId
                    ? (locale === "zh-TW" ? "確認修改" : "Save Changes")
                    : (locale === "zh-TW" ? "確認新增" : "Create")}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 bg-zinc-950/60 min-h-screen">
      <ThemeLanguageSelector />
      <div className="glow-bg" />
      <Suspense fallback={<div className="text-zinc-500 text-sm">載入中...</div>}>
        <AlertsContent />
      </Suspense>
    </main>
  );
}
