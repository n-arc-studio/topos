import { NextResponse } from "next/server";
import {
  persistStoreNow,
  refreshStoreFromPersistence,
  reportPost,
} from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

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
    reason?: string;
  } | null;
  await refreshStoreFromPersistence();
  const result = reportPost({
    postId,
    byUserId: me.id,
    reason: body?.reason,
  });
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  void persistStoreNow();
  return NextResponse.json({
    reportCount: result.reportCount,
    isSunk: result.isSunk,
  });
}
