import { NextResponse } from "next/server";
import { deletePost } from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ postId: string }> }
) {
  const { postId } = await ctx.params;
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = deletePost(postId, me.id);
  if ("error" in result) {
    const status = result.error === "forbidden" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
