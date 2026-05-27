import { getServerSession } from "next-auth";
import { getOrCreateDomainUserIdForAuthUser } from "@/lib/auth/storage";
import { authOptions } from "@/lib/auth/options";
import { ensureUser } from "@/lib/infra/store";
import type { User } from "@/lib/domain/types";

export async function currentUser(): Promise<User | null> {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    // Stale or undecryptable auth cookies should behave as signed-out, not crash the app.
    console.warn("[topos] session resolution failed", error);
    return null;
  }
  const authUserId = session?.user?.id;
  const email = session?.user?.email;
  if (!authUserId || !email) return null;

  const mapping = await getOrCreateDomainUserIdForAuthUser({
    authUserId,
    email,
  });
  return ensureUser(mapping.domainUserId, mapping.displayName);
}
