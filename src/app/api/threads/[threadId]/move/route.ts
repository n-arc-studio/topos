import { NextResponse } from "next/server";
import {
  moveThread,
  persistStoreNow,
  refreshStoreFromPersistence,
} from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await ctx.params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    targetSpaceId?: string;
  } | null;
  if (!body?.targetSpaceId) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  await refreshStoreFromPersistence();

  const result = moveThread(threadId, body.targetSpaceId, me.id);
  if ("error" in result) {
    const status = result.error === "forbidden" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  await persistStoreNow();

  return NextResponse.json(result);
}