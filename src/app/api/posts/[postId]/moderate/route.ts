import { NextResponse } from "next/server";
import {
  moderatePost,
  persistStoreNow,
  refreshStoreFromPersistence,
} from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

const ALLOWED = ["sink", "unsink", "pin", "unpin"] as const;
type Action = (typeof ALLOWED)[number];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    action?: Action;
  } | null;
  if (!body?.action || !ALLOWED.includes(body.action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  await refreshStoreFromPersistence();
  const result = moderatePost({
    postId,
    byUserId: me.id,
    action: body.action,
  });
  if ("error" in result) {
    const status = result.error === "not_authorized" ? 403 : 400;
    return NextResponse.json(result, { status });
  }
  void persistStoreNow();
  return NextResponse.json({
    isPinned: result.isPinned,
    isSunk: result.isSunk,
  });
}
