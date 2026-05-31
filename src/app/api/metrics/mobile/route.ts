import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session/identity";
import {
  persistStoreNow,
  recordMobileMetricEvent,
  refreshStoreFromPersistence,
} from "@/lib/infra/store";
import type { MobileMetricEventName } from "@/lib/domain/types";

const ALLOWED_NAMES: MobileMetricEventName[] = [
  "home_view",
  "compose_started",
  "post_submitted",
  "reply_submitted",
  "auth_required",
  "auth_resumed",
];

function isName(value: unknown): value is MobileMetricEventName {
  return typeof value === "string" && ALLOWED_NAMES.includes(value as MobileMetricEventName);
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as {
    name?: unknown;
    sessionId?: unknown;
    path?: unknown;
    threadId?: unknown;
    spaceId?: unknown;
    composeKind?: unknown;
    ref?: unknown;
    at?: unknown;
  } | null;

  if (!payload || !isName(payload.name) || typeof payload.sessionId !== "string") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const at =
    typeof payload.at === "number" && Number.isFinite(payload.at)
      ? Math.floor(payload.at)
      : Date.now();
  const me = await currentUser();

  await refreshStoreFromPersistence();
  const event = recordMobileMetricEvent({
    name: payload.name,
    sessionId: payload.sessionId,
    at,
    userId: me?.id,
    path: typeof payload.path === "string" ? payload.path : undefined,
    threadId: typeof payload.threadId === "string" ? payload.threadId : undefined,
    spaceId: typeof payload.spaceId === "string" ? payload.spaceId : undefined,
    composeKind:
      payload.composeKind === "post" || payload.composeKind === "reply"
        ? payload.composeKind
        : undefined,
    ref: typeof payload.ref === "string" ? payload.ref : undefined,
  });
  await persistStoreNow();

  return NextResponse.json({ ok: true, id: event.id }, { status: 201 });
}
