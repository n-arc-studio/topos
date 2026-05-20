import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session/identity";

export async function GET() {
  const me = await currentUser();
  return NextResponse.json(me);
}
