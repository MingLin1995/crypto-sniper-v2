"use client";

import * as React from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProviders";
import { ThemeLanguageSelector } from "@/components/ThemeLanguageSelector";
import { Scale, ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
  const { locale } = useApp();
  const isZh = locale === "zh-TW";

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950/60 min-h-screen py-12">
      <ThemeLanguageSelector />
      
      <div className="w-full max-w-3xl border border-indigo-500/20 glass-indigo rounded-xl p-8 md:p-12 shadow-2xl relative mt-8">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-8 border-b border-indigo-500/10 pb-6">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {isZh ? "服務條款" : "Terms of Service"}
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
                歡迎使用 <strong>CryptoSniper V2</strong>（以下簡稱「本平台」）。請在註冊或使用我們的價格監控、到價通知及相關服務（以下簡稱「本服務」）前，仔細閱讀本服務條款。當您訪問或使用本平台時，即代表您已閱讀、理解並同意接受本服務條款之所有內容。
              </p>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">1. 服務內容與不提供金融/投資建議聲明</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>本平台所提供的所有數據、篩選指標、圖表分析、警報以及即時到價通知（透過 Email、Discord、Telegram 等管道），<strong>僅供參考與學術研究用途，絕不構成任何形式的投資建議、金融產品推薦或交易誘導。</strong></li>
                  <li>加密貨幣價格極具波動性，交易存在極高的市場風險。<strong>您所做出的任何買賣決策均由您自行評估並承擔全部風險。</strong> 本平台不對您的任何交易結果或資金虧損負擔任何責任。</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">2. 帳戶註冊與安全責任</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>註冊時您應提供真實、準確的資料。您有責任妥善保管您的帳戶登入憑證與關聯的第三方 OAuth 綁定授權。</li>
                  <li>若發現任何未經授權的帳戶登入或安全漏洞，您應立即通知我們。因您個人保管不當導致的任何損失，本平台概不負責。</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">3. 免責聲明與服務可用性限制</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>本平台係依「現狀」及「現有」基礎提供。我們將盡最大努力確保數據的準確性與即時性，但<strong>不保證所有行情數據、通知推送 100% 無延遲、無遺漏或無中斷。</strong></li>
                  <li>本平台不對因網絡延遲、伺服器故障、第三方 API 限制（例如交易所 API、Discord Webhook 速率限制、Telegram 網路壅塞等）或不可抗力事件所導致的通知延遲或失效承擔任何法律責任。</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">4. 使用限制與禁止行為</h2>
                <p className="mb-2">使用本服務時，您同意遵守以下規範：</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>不得利用任何自動化指令碼（如惡意爬蟲、DDoS 攻擊等）過度請求本平台 API，從而損害系統性能。</li>
                  <li>不得進行任何逆向工程、反向編譯或試圖竊取本平台核心代碼之行為。</li>
                  <li>不得假冒他人或利用本服務從事任何違反當地法律法規的非法勾當。</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">5. 條款修改權</h2>
                <p>
                  我們保留隨時修改或更換本服務條款的權利。修改後的內容將發布於本網頁上。若您在條款修改後繼續使用本平台，即視為您已接受該等修改。
                </p>
              </div>
            </>
          ) : (
            <>
              <p>
                Welcome to <strong>CryptoSniper V2</strong> (referred to as &quot;the Platform&quot;). Please read these Terms of Service carefully before registering or using our crypto-screening and alert systems (referred to as &quot;the Services&quot;). By accessing or using the Platform, you acknowledge that you have read, understood, and agreed to be bound by these terms.
              </p>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">1. Nature of Service &amp; No Investment Advice</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>All market screeners, metrics, signals, and notifications (via Email, Discord webhooks, or Telegram bots) provided by the Platform are <strong>for educational and informational purposes only. They do not constitute financial, investment, or trading advice.</strong></li>
                  <li>Cryptocurrency trading involves substantial risk and volatility. <strong>Any trading decisions you make are entirely your own responsibility.</strong> We are not liable for any financial losses or damages resulting from your use of the Platform.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">2. User Account Security</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>You must provide accurate account information during registration. You are solely responsible for maintaining the confidentiality of your credentials and connected social accounts.</li>
                  <li>You must notify us immediately of any unauthorized access or security breaches. We are not responsible for losses caused by poor credential protection.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">3. Disclaimer of Warranties and Reliability</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>The Services are provided on an &quot;as is&quot; and &quot;as available&quot; basis. <strong>We do not guarantee that the alerts and data feeds will be 100% accurate, error-free, or delivered without delay.</strong></li>
                  <li>We are not responsible for delayed or missed notifications caused by network outages, server maintenance, or external platform API rate limits (e.g. Discord, Telegram, or Exchange API limitations).</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">4. Prohibited Uses</h2>
                <p className="mb-2">You agree not to engage in any of the following activities:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Using automated scripts, bots, or scrapers that place an excessive load on our database or API servers.</li>
                  <li>Reverse engineering, decompiling, or attempting to extract the Platform source code.</li>
                  <li>Impersonating others or using our Services for illegal transactions or fraudulent activities.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">5. Modifications of Terms</h2>
                <p>
                  We reserve the right to update or modify these Terms of Service at any time. Changes will be posted on this page with an updated &quot;Last updated&quot; date. Continued use of the Services after revisions constitutes acceptance of the new terms.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-12 pt-6 border-t border-indigo-500/10 flex justify-between items-center">
          <Link href="/login" className="flex items-center text-sm text-indigo-400 hover:text-indigo-300 hover:underline transition-colors font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isZh ? "返回登入" : "Back to Login"}
          </Link>
          <Link href="/privacy" className="text-sm text-indigo-400 hover:text-indigo-300 hover:underline transition-colors font-medium">
            {isZh ? "隱私權政策" : "Privacy Policy"}
          </Link>
        </div>
      </div>
    </main>
  );
}
