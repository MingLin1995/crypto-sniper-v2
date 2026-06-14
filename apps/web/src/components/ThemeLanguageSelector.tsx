"use client";

import React from "react";
import { useApp } from "./AppProviders";

export function ThemeLanguageSelector() {
  const { theme, toggleTheme, locale, setLocale } = useApp();

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-zinc-900/60 light:bg-white/60 backdrop-blur-md border border-zinc-800 light:border-zinc-200 px-3 py-1.5 rounded-full shadow-lg transition-all duration-300">
      {/* Language Toggle Button */}
      <button
        onClick={() => setLocale(locale === "zh-TW" ? "en-US" : "zh-TW")}
        className="text-xs font-semibold text-zinc-300 light:text-zinc-700 hover:text-indigo-400 light:hover:text-indigo-600 transition-colors flex items-center gap-1 px-2 py-1 rounded-full hover:bg-zinc-800/50 light:hover:bg-zinc-100 cursor-pointer"
      >
        <span className="text-sm">🌐</span>
        <span>{locale === "zh-TW" ? "English" : "中文"}</span>
      </button>

      {/* Divider */}
      <div className="w-[1px] h-4 bg-zinc-800 light:bg-zinc-200" />

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="text-sm p-1.5 rounded-full hover:bg-zinc-800/50 light:hover:bg-zinc-100 text-zinc-300 light:text-zinc-700 hover:text-indigo-400 light:hover:text-indigo-600 transition-all duration-300 transform hover:scale-110 cursor-pointer"
        aria-label="Toggle Theme"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </div>
  );
}
