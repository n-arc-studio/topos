import { NextResponse } from "next/server";
import {
  deletePost,
  persistStoreNow,
  refreshStoreFromPersistence,
  updatePost,
} from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ postId: string }> }
) {
  const { postId } = await ctx.params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        body?: string;
      }
    | null;
  if (typeof body?.body !== "string") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  await refreshStoreFromPersistence();

  const result = updatePost({ postId, byUserId: me.id, body: body.body });
  if ("error" in result) {
    const status = result.error === "forbidden" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  await persistStoreNow();
  return NextResponse.json(result);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ postId: string }> }
) {
  const { postId } = await ctx.params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await refreshStoreFromPersistence();

  const result = deletePost(postId, me.id);
  if ("error" in result) {
    const status = result.error === "forbidden" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  await persistStoreNow();

  return NextResponse.json(result);
}
