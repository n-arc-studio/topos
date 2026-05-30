import { NextResponse } from "next/server";
import {
  persistStoreNow,
  refreshStoreFromPersistence,
  updateUserDisplayName,
} from "@/lib/infra/store";
import { updateDomainUserDisplayName } from "@/lib/auth/storage";
import { currentUser } from "@/lib/session/identity";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    displayName?: string;
  } | null;
  if (typeof body?.displayName !== "string") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  await refreshStoreFromPersistence();
  const result = updateUserDisplayName(me.id, body.displayName);
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  await updateDomainUserDisplayName(me.id, result.displayName);
  await persistStoreNow();
  return NextResponse.json(result);
}
