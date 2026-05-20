import { NextResponse } from "next/server";
import { updateSpaceGravityConfig } from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await ctx.params;
  const me = await currentUser();
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
  return NextResponse.json({
    spaceId: result.id,
    gravityConfig: result.gravityConfig ?? null,
  });
}
