import { NextResponse } from "next/server";
import {
  persistStoreNow,
  refreshStoreFromPersistence,
  updateSpaceGravityConfig,
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const config =
    body && typeof body === "object" && "gravityConfig" in body
      ? (body as { gravityConfig: unknown }).gravityConfig
      : null;

  await refreshStoreFromPersistence();

  const result = updateSpaceGravityConfig(
    spaceId,
    me.id,
    config === null
      ? null
      : (config as Parameters<typeof updateSpaceGravityConfig>[2])
  );
  if ("error" in result) {
    const status = result.error === "forbidden" ? 403 : 400;
    return NextResponse.json(result, { status });
  }
  await persistStoreNow();
  return NextResponse.json({
    spaceId: result.id,
    gravityConfig: result.gravityConfig ?? null,
  });
}
