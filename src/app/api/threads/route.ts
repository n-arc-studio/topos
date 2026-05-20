import { NextResponse } from "next/server";
import { createThread } from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

export async function POST(req: Request) {
  const me = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    spaceId?: string;
    title?: string;
  } | null;
  if (!body?.spaceId || !body?.title) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const result = createThread({
    spaceId: body.spaceId,
    title: body.title,
    createdBy: me.id,
  });
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
