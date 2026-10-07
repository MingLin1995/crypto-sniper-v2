"use client";

import * as React from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProviders";
import { ThemeLanguageSelector } from "@/components/ThemeLanguageSelector";
import { Shield, ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  const { locale } = useApp();
  const isZh = locale === "zh-TW";

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950/60 min-h-screen py-12">
      <ThemeLanguageSelector />
      
      <Link href="/" className="flex items-center gap-2.5 mb-4 group" title="返回首頁">
        <div className="bg-indigo-600/10 p-2 rounded-2xl border border-indigo-500/20 group-hover:scale-105 transition-all shadow-md shadow-indigo-500/10">
          <img src="/icon.png" alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
        </div>
        <span className="text-2xl font-extrabold bg-gradient-to-r from-zinc-900 via-slate-800 to-indigo-600 dark:from-zinc-50 dark:via-zinc-100 dark:to-indigo-400 bg-clip-text text-transparent">
          CryptoSniper V2
        </span>
      </Link>

      <div className="w-full max-w-3xl border border-indigo-500/20 glass-indigo rounded-xl p-8 md:p-12 shadow-2xl relative mt-2">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-8 border-b border-indigo-500/10 pb-6">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {isZh ? "隱私權政策" : "Privacy Policy"}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              {isZh ? "最後更新日期：2026 年 7 月 9 日" : "Last updated: July 9, 2026"}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm md:text-base text-zinc-300 leading-relaxed font-normal">
          {isZh ? (
            <>
              <p>
                歡迎使用 <strong>CryptoSniper V2</strong>（以下簡稱「本平台」）。本平台致力於保護您的個人隱私與數據安全。本隱私權政策旨在說明我們如何收集、使用、披露及保護您在使用本平台（網址為 <a href="https://crypto-sniper.minglin.net/" className="text-indigo-400 hover:underline">https://crypto-sniper.minglin.net/</a>）時提供的個人資料。
              </p>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">1. 資訊收集與使用範圍</h2>
                <p className="mb-2">當您註冊、登入或使用本平台服務時，我們可能會收集並處理以下類別的個人資料：</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>基本帳戶資訊：</strong> 若您使用電子郵件註冊，我們將收集您的 Email 信箱與暱稱。</li>
                  <li><strong>第三方快速登入（Google OAuth 等）：</strong> 當您使用 Google 帳號登入時，我們會在取得您的明確同意後，從 Google 獲取您的<strong>基本公開資料（例如：電子郵件地址、姓名、公開個人資料圖片、不重複標識符）</strong>。此類資訊僅用於建立您的個人帳戶與驗證您的登入狀態。我們絕不會要求或收集您在第三方服務中的密碼，亦不會在未授權的情況下訪問其他非必要資料。</li>
                  <li><strong>通知管道與設定：</strong> 為了提供到價通知服務，我們會記錄您設定的交易對警報參數、Discord Webhook 網址以及 Telegram 帳號綁定識別碼。</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">2. 資訊使用目的與方式</h2>
                <p>我們所收集的個人資料主要用於以下合法目的：</p>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>提供、運作及維護本平台的核心服務（如即時價格篩選與監控）。</li>
                  <li>管理您的用戶帳戶、提供身份驗證並提升帳戶安全性。</li>
                  <li>發送交易對警報通知（經由 Email、Discord 機器人或 Telegram 機器人，取決於您的設定）。</li>
                  <li>回應您的客戶服務請求與技術支援。</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">3. 數據共享與第三方服務</h2>
                <p>
                  我們不會將您的個人隱私資料出售、交易或轉讓給任何無關的第三方。我們的服務包含第三方集成（例如 Google OAuth 登入、Discord Webhook、Telegram Bot 通知）。當您使用這些功能時，相關的資料傳輸與處理將同時受該等第三方平台各自隱私權政策的約束。
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">4. 您的數據權利（包括解除帳號綁定）</h2>
                <p className="mb-2">您對我們所保存的個人資料擁有完整的控制權：</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>隨時解除綁定：</strong> 您可以在本平台的「帳號設定中心」內，隨時點擊「解除綁定」按鈕，立即斷開本平台與 Google、Discord 或 Telegram 帳號的連結。一旦解綁，我們將不再保留或讀取任何新的第三方 API 資料。</li>
                  <li><strong>刪除帳戶：</strong> 若您希望完全刪除您的 CryptoSniper 帳戶及其關聯的所有警報設定與歷史記錄，請聯繫我們，我們將依法於合理期限內為您刪除或進行去識別化處理。</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">5. 資訊安全保障</h2>
                <p>
                  我們採用符合行業標準的安全技術（例如 TLS 加密傳輸、密碼單向雜湊雜湊儲存、內部資料庫訪問權限嚴格控管）來保護您的個人資料免遭未經授權的訪問、篡改、披露或毀損。
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">6. 政策更新</h2>
                <p>
                  我們可能會不時更新本隱私權政策。任何修改都將發布於本頁面上，並更新頁首的「最後更新日期」。建議您定期閱讀本政策以掌握最新資訊。
                </p>
              </div>
            </>
          ) : (
            <>
              <p>
                Welcome to <strong>CryptoSniper V2</strong> (referred to as &quot;the Platform&quot;). We are committed to protecting your personal privacy and data security. This Privacy Policy describes how we collect, use, disclose, and protect your personal information when you use our services at <a href="https://crypto-sniper.minglin.net/" className="text-indigo-400 hover:underline">https://crypto-sniper.minglin.net/</a>.
              </p>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">1. Information Collection and Scope</h2>
                <p className="mb-2">When you register, log in, or use the Platform, we may collect and process the following categories of personal data:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Basic Account Information:</strong> If you register via email, we will collect your email address and nickname.</li>
                  <li><strong>Third-Party Social Login (Google OAuth, etc.):</strong> When you log in using your Google Account, with your explicit authorization, we will retrieve your <strong>basic public profile information (such as your email address, name, profile picture, and a unique identifier)</strong> from Google. This information is used strictly to set up your account and authenticate your session. We never request or store your passwords from third-party services.</li>
                  <li><strong>Alert and Notification Settings:</strong> To deliver price alert services, we record your target symbols, alert conditions, Discord Webhook URLs, and Telegram account IDs.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">2. How We Use Your Information</h2>
                <p>We use the collected personal information for the following legitimate purposes:</p>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>To provide, operate, and maintain core Platform features (such as real-time price monitoring and filtering).</li>
                  <li>To manage user accounts, authenticate logins, and protect account security.</li>
                  <li>To dispatch price alerts (via Email, Discord webhook, or Telegram bot based on your configuration).</li>
                  <li>To respond to customer support requests and technical inquiries.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">3. Data Sharing and Third-Party Integrations</h2>
                <p>
                  We do not sell, trade, or transfer your personal privacy data to outside parties. Our services incorporate third-party integrations (e.g. Google OAuth, Discord Webhook, Telegram Bot). Your interactions with these integrations are subject to the respective privacy policies of those third-party platforms.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">4. Your Data Rights (Including Unlinking)</h2>
                <p className="mb-2">You maintain full control over your personal data:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Unlink Anytime:</strong> You can disconnect your Google, Discord, or Telegram account at any time via the User Profile page by clicking the &quot;Unlink&quot; button. Once disconnected, we will immediately stop accessing or updating any third-party API data.</li>
                  <li><strong>Account Deletion:</strong> If you wish to permanently delete your CryptoSniper account and all associated configuration/alert records, please contact us. We will handle and purge your data within a reasonable timeframe.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">5. Data Security</h2>
                <p>
                  We employ industry-standard security techniques (including TLS encryption, password hashing, and restricted internal database access controls) to guard your personal data from unauthorized access, alteration, disclosure, or destruction.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">6. Changes to this Policy</h2>
                <p>
                  We may update our Privacy Policy from time to time. Any modifications will be posted directly on this page with an updated &quot;Last updated&quot; date. We encourage you to review this policy periodically.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-12 pt-6 border-t border-indigo-500/10 flex justify-between items-center">
          <Link href="/" className="flex items-center text-sm text-indigo-400 hover:text-indigo-300 hover:underline transition-colors font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isZh ? "返回首頁" : "Back to Home"}
          </Link>
          <Link href="/terms" className="text-sm text-indigo-400 hover:text-indigo-300 hover:underline transition-colors font-medium">
            {isZh ? "服務條款" : "Terms of Service"}
          </Link>
        </div>
      </div>
    </main>
  );
}
