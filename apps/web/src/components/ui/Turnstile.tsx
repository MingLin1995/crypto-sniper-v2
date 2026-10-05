"use client";

import * as React from "react";
import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: (errorCode?: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact";
          action?: string;
          retry?: "auto" | "never";
          "retry-interval"?: number;
          "refresh-expired"?: "auto" | "manual" | "never";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export interface TurnstileRef {
  reset: () => void;
}

export interface TurnstileProps {
  siteKey?: string;
  onSuccess: (token: string) => void;
  onError?: (errorCode?: string) => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  className?: string;
}

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  (
    {
      siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      onSuccess,
      onError,
      onExpire,
      theme = "dark",
      className = "",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (e) {
            console.error("[Turnstile] 重設驗證 Widget 失敗:", e);
          }
        }
      },
    }));

    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);
    const renderedKeyRef = useRef<string | null>(null);

    useEffect(() => {
      onSuccessRef.current = onSuccess;
      onErrorRef.current = onError;
      onExpireRef.current = onExpire;
    });

    useEffect(() => {
      if (!siteKey) return;

      let isMounted = true;

      const renderWidget = () => {
        if (!isMounted || !containerRef.current || !window.turnstile) return;

        // 若當前已存在相同 siteKey 的 Widget，避免重複建立導致重新整理或閃爍
        if (widgetIdRef.current && renderedKeyRef.current === siteKey) {
          return;
        }

        try {
          if (widgetIdRef.current) {
            window.turnstile.remove(widgetIdRef.current);
            widgetIdRef.current = null;
          }

          if (containerRef.current) {
            containerRef.current.innerHTML = "";
          }

          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            callback: (token: string) => {
              if (isMounted) {
                onSuccessRef.current?.(token);
              }
            },
            "error-callback": (errorCode?: string) => {
              if (isMounted) {
                console.warn("[Turnstile] Cloudflare 驗證端點狀態碼:", errorCode);
                onErrorRef.current?.(errorCode);
              }
            },
            "expired-callback": () => {
              if (isMounted) {
                onExpireRef.current?.();
              }
            },
            retry: "auto",
            "retry-interval": 4000,
            "refresh-expired": "auto",
          });

          widgetIdRef.current = id;
          renderedKeyRef.current = siteKey;
        } catch (e) {
          console.error("[Turnstile] 渲染 Widget 失敗:", e);
        }
      };

      if (window.turnstile) {
        renderWidget();
      } else {
        const scriptId = "cf-turnstile-script";
        let script = document.getElementById(scriptId) as HTMLScriptElement | null;

        if (!script) {
          script = document.createElement("script");
          script.id = scriptId;
          script.src =
            "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit";
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
        }

        const prevCallback = window.onloadTurnstileCallback;
        window.onloadTurnstileCallback = () => {
          if (prevCallback) prevCallback();
          renderWidget();
        };

        // 輪詢保護：防範腳本在回呼掛載前已非同步載入完成
        const checkInterval = setInterval(() => {
          if (window.turnstile) {
            clearInterval(checkInterval);
            renderWidget();
          }
        }, 100);

        setTimeout(() => clearInterval(checkInterval), 6000);
      }

      return () => {
        isMounted = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
          renderedKeyRef.current = null;
        }
      };
    }, [siteKey, theme]);

    if (!siteKey) {
      return null;
    }

    return (
      <div
        ref={containerRef}
        data-testid="turnstile-container"
        className={`flex justify-center my-2 min-h-[65px] ${className}`}
      />
    );
  }
);

Turnstile.displayName = "Turnstile";
