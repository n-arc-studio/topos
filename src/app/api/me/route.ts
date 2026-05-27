import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session/identity";

export async function GET() {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json(me);
}
