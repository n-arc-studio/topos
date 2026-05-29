import { NextResponse } from "next/server";
import { deleteSpace, updateSpaceCharter } from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await ctx.params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { charter?: string }
    | null;
  const charter = body?.charter;
  if (typeof charter !== "string") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = updateSpaceCharter(spaceId, me.id, charter);
  if ("error" in result) {
    const status = result.error === "forbidden" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({
    spaceId: result.id,
    charter: result.charter,
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await ctx.params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = deleteSpace(spaceId, me.id);
  if ("error" in result) {
    const status = result.error === "forbidden" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
