import { NextResponse } from "next/server";
import {
  persistStoreNow,
  refreshStoreFromPersistence,
  revokeAdminRole,
} from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await ctx.params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { targetUserId?: string }
    | null;
  const targetUserId = body?.targetUserId?.trim();
  if (!targetUserId) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  await refreshStoreFromPersistence();

  const result = revokeAdminRole(spaceId, me.id, targetUserId);
  if ("error" in result) {
    const status = result.error === "forbidden" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  await persistStoreNow();

  return NextResponse.json({
    spaceId: result.id,
    adminIds: result.adminIds,
  });
}
