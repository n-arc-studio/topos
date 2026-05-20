import { NextResponse } from "next/server";
import { react } from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";
import type { ReactionKind } from "@/lib/domain/types";

const ALLOWED: ReactionKind[] = ["kusa", "useful", "patch", "debug"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const me = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    kind?: ReactionKind;
  } | null;
  if (!body?.kind || !ALLOWED.includes(body.kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  const result = react({ postId, byUserId: me.id, kind: body.kind });
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
