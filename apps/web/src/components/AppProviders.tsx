"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Locale } from "@/lib/i18n";

type Theme = "light" | "dark";

interface AppContextProps {
  theme: Theme;
  toggleTheme: () => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [locale, setLocale] = useState<Locale>("zh-TW");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Retrieve stored settings
    const storedTheme = localStorage.getItem("theme") as Theme || "dark";
    const storedLocale = localStorage.getItem("locale") as Locale || "zh-TW";
    
    setTheme(storedTheme);
    setLocale(storedLocale);
    
    // Apply theme to DOM
    const root = document.documentElement;
    if (storedTheme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
    
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    
    const root = document.documentElement;
    if (newTheme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
  };

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("locale", newLocale);
  };

  return (
    <AppContext.Provider value={{ theme, toggleTheme, locale, setLocale: changeLocale }}>
      <div style={{ visibility: mounted ? "visible" : "hidden" }}>
        {children}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProviders");
  }
  return context;
}
