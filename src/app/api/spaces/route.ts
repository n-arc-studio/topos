import { NextResponse } from "next/server";
import { createSpace } from "@/lib/infra/store";
import { currentUser } from "@/lib/session/identity";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { name?: string; charter?: string }
    | null;
  const name = body?.name?.trim();
  const charter = body?.charter?.trim();
  if (!name || !charter) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = createSpace({
    name,
    charter,
    createdBy: me.id,
  });
  if ("error" in result) {
    const status = result.error === "forbidden" ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
