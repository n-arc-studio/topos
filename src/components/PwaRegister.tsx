"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "topos:pwa:install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// PWA の Service Worker 登録と、ホーム画面追加の誘導をまとめて担当する。
export function PwaRegister() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [env, setEnv] = useState({
    isIOS: false,
    isStandalone: false,
    dismissed: true,
  });

  // Service Worker を登録する。
  useEffect(() => {
    // 開発環境では SW を無効化する。
    // Turbopack の開発バンドルは URL が固定的なことがあり、
    // stale キャッシュされた旧JSが hydration mismatch を誘発しやすい。
    if (process.env.NODE_ENV !== "production") {
      if (!("serviceWorker" in navigator)) return;
      (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(
              keys
                .filter((key) => key.startsWith("topos-pwa-"))
                .map((key) => caches.delete(key))
            );
          }
        } catch {
          // SW の解除失敗時も通常の Web として動作するため握りつぶす。
        }
      })();
      return;
    }

    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // 登録失敗時も通常の Web として動作するため握りつぶす。
        });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // インストール誘導の状態を判定する。
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari 独自プロパティ。
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;

    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }

    setEnv({ isIOS: ios, isStandalone: standalone, dismissed });

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    const onInstalled = () =>
      setEnv((prev) => ({ ...prev, isStandalone: true }));
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setEnv((prev) => ({ ...prev, dismissed: true }));
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // no-op
    }
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  // インストール済み・閉じた後・対象外の場合は何も出さない。
  if (env.isStandalone || env.dismissed) return null;

  const canPromptAndroid = !!installEvent;
  if (!canPromptAndroid && !env.isIOS) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Topos をホーム画面に追加</p>
            {canPromptAndroid ? (
              <p className="text-xs text-[var(--muted)]">
                アプリのように起動でき、再訪時の表示も速くなります。
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                共有メニュー <span aria-hidden>⎋</span> から「ホーム画面に追加」を選んでください。
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="閉じる"
          >
            閉じる
          </button>
        </div>
        {canPromptAndroid && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={install}
              className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-black font-medium"
            >
              追加する
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
