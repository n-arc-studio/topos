import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LogoutButton } from "@/components/LogoutButton";
import { currentUser } from "@/lib/session/identity";
import { isPlatformAdmin } from "@/lib/infra/store";
import packageJson from "../../package.json";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Topos — 場の重力をつくるSNS",
  description:
    "フォロワー数ではなく、場への寄与で評価される実験的SNS。匿名と記名を切り替え、澱む発言は重力で沈み、流れを作る発言が浮かぶ。",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await currentUser();
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version;

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--border)] bg-[var(--panel)]/70 backdrop-blur sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-wide">
              <span className="text-[var(--accent)]">●</span> Topos
            </Link>
            <div className="text-xs text-[var(--muted)] flex items-center gap-3">
              <Link
                href="/about"
                className="hover:text-[var(--accent)] transition"
              >
                思想
              </Link>
              {me ? (
                <>
                  {isPlatformAdmin(me.id) && (
                    <Link
                      href="/admin"
                      className="text-[var(--accent)] hover:underline"
                    >
                      全体管理
                    </Link>
                  )}
                  {me.isAdminOf.length > 0 && (
                    <Link
                      href="/admin/spaces"
                      className="text-[var(--accent)] hover:underline"
                    >
                      場管理
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    className="hover:text-[var(--accent)] transition"
                  >
                    {me.displayName}
                  </Link>{" "}
                  <span className="opacity-60">
                    / 公=
                    <span className="text-[var(--foreground)]">{me.publicMass}</span>{" "}
                    匿=
                    <span className="text-[var(--foreground)]">{me.anonymousMass}</span>
                  </span>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="hover:text-[var(--accent)] transition"
                  >
                    ログイン
                  </Link>
                  <Link
                    href="/signup"
                    className="hover:text-[var(--accent)] transition"
                  >
                    登録
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</main>
        <footer className="border-t border-[var(--border)] text-xs text-[var(--muted)]">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <span>場の重力を測るSNS · MVP</span>
            <span className="font-mono opacity-80">v{appVersion}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
