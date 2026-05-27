import { NextResponse } from "next/server";
import { createPost } from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";
import type { IdentityMode } from "@/lib/domain/types";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    threadId?: string;
    body?: string;
    identityMode?: IdentityMode;
    replyTo?: string;
  } | null;
  if (!body?.threadId || !body?.body || !body?.identityMode) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const result = createPost({
    threadId: body.threadId,
    authorId: me.id,
    identityMode: body.identityMode,
    body: body.body,
    replyTo: body.replyTo,
  });
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
