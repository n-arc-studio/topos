import { getServerSession } from "next-auth";
import { getOrCreateDomainUserIdForAuthUser } from "@/lib/auth/storage";
import { authOptions } from "@/lib/auth/options";
import { ensureUser } from "@/lib/infra/store";
import type { User } from "@/lib/domain/types";

function isExpectedDynamicServerError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { digest?: unknown; message?: unknown; description?: unknown };
  if (e.digest === "DYNAMIC_SERVER_USAGE") return true;
  const msg = typeof e.message === "string" ? e.message : "";
  const desc = typeof e.description === "string" ? e.description : "";
  return msg.includes("Dynamic server usage") || desc.includes("Dynamic server usage");
}

export async function currentUser(): Promise<User | null> {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    // Static prerender may intentionally fail for request-bound APIs. Treat as signed-out.
    if (isExpectedDynamicServerError(error)) {
      return null;
    }
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
