"use client";

import type { MobileMetricEventName } from "@/lib/domain/types";

const SESSION_KEY = "topos:mobile:session";
const PENDING_AUTH_KEY = "topos:mobile:auth-pending";

type ComposeKind = "post" | "reply";

function isLikelyMobile(): boolean {
  if (typeof window === "undefined") return false;
  const byWidth = window.matchMedia?.("(max-width: 768px)")?.matches ?? false;
  const byTouch = (navigator.maxTouchPoints ?? 0) > 0;
  const ua = navigator.userAgent.toLowerCase();
  const byUa = /iphone|ipad|ipod|android|mobile/.test(ua);
  return byWidth || (byTouch && byUa);
}

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = `ms_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return `ms_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export async function trackMobileMetric(input: {
  name: MobileMetricEventName;
  threadId?: string;
  spaceId?: string;
  composeKind?: ComposeKind;
  ref?: string;
}): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isLikelyMobile()) return;

  const body = JSON.stringify({
    name: input.name,
    sessionId: getSessionId(),
    path: `${window.location.pathname}${window.location.search}`,
    threadId: input.threadId,
    spaceId: input.spaceId,
    composeKind: input.composeKind,
    ref: input.ref,
    at: Date.now(),
  });

  try {
    await fetch("/api/metrics/mobile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // 計測失敗でユーザー操作は阻害しない。
  }
}

export function markPendingAuthResume(input: {
  callbackUrl: string;
  threadId?: string;
  composeKind?: ComposeKind;
}): void {
  if (typeof window === "undefined") return;
  if (!isLikelyMobile()) return;

  try {
    const payload = {
      callbackUrl: input.callbackUrl,
      threadId: input.threadId,
      composeKind: input.composeKind,
      at: Date.now(),
    };
    window.sessionStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
}

export async function trackAuthResumedIfPending(callbackUrl: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isLikelyMobile()) return;

  try {
    const raw = window.sessionStorage.getItem(PENDING_AUTH_KEY);
    if (!raw) return;
    const pending = JSON.parse(raw) as {
      callbackUrl?: string;
      threadId?: string;
      composeKind?: ComposeKind;
      at?: number;
    };
    if (!pending.callbackUrl || pending.callbackUrl !== callbackUrl) return;
    if (typeof pending.at !== "number") return;
    if (Date.now() - pending.at > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(PENDING_AUTH_KEY);
      return;
    }

    await trackMobileMetric({
      name: "auth_resumed",
      threadId: pending.threadId,
      composeKind: pending.composeKind,
      ref: "login_success",
    });
    window.sessionStorage.removeItem(PENDING_AUTH_KEY);
  } catch {
    // no-op
  }
}
