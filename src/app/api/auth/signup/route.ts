import { NextResponse } from "next/server";
import { createAuthUser, getOrCreateDomainUserIdForAuthUser } from "@/lib/auth/storage";
import { ensureUser } from "@/lib/infra/store";

type SignupBody = {
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SignupBody | null;
  if (!body?.email || !body.password) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const created = await createAuthUser({
    email: body.email,
    password: body.password,
  });
  if ("error" in created) {
    const status = created.error === "email_already_used" ? 409 : 400;
    return NextResponse.json(created, { status });
  }

  const mapping = await getOrCreateDomainUserIdForAuthUser({
    authUserId: created.id,
    email: created.email,
  });
  ensureUser(mapping.domainUserId, mapping.displayName);

  return NextResponse.json({ ok: true, email: created.email }, { status: 201 });
}