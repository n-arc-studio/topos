"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isThreadPath(pathname: string): boolean {
  return /^\/spaces\/[^/]+\/threads\/[^/]+$/.test(pathname);
}

function isSpacePath(pathname: string): boolean {
  return /^\/spaces\/[^/]+$/.test(pathname);
}

function NavIcon({ kind }: { kind: "home" | "spaces" | "compose" | "activity" | "profile" }) {
  switch (kind) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M6.5 10.5V20h11V10.5" />
        </svg>
      );
    case "spaces":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 6h7v5H4zM13 6h7v5h-7zM4 13h7v5H4zM13 13h7v5h-7z" />
        </svg>
      );
    case "compose":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m4 16.5 9.5-9.5 3.5 3.5-9.5 9.5L4 20z" />
          <path d="M12.5 8 16 11.5" />
        </svg>
      );
    case "activity":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 4a6 6 0 0 0-6 6v3.8L4.8 16a1 1 0 0 0 .8 1.6h12.8a1 1 0 0 0 .8-1.6L18 13.8V10a6 6 0 0 0-6-6Z" />
          <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19a7 7 0 0 1 14 0" />
        </svg>
      );
  }
}

export function MobileBottomNav() {
  const pathname = usePathname();

  let composeHref = "/#spaces";
  if (isThreadPath(pathname)) composeHref = `${pathname}#composer`;
  else if (isSpacePath(pathname)) composeHref = `${pathname}#new-thread`;

  const links = [
    {
      key: "home",
      href: "/",
      label: "ホーム",
      icon: "home" as const,
      active: pathname === "/",
      compose: false,
    },
    {
      key: "spaces",
      href: "/#spaces",
      label: "場",
      icon: "spaces" as const,
      active: pathname.startsWith("/spaces/"),
      compose: false,
    },
    {
      key: "compose",
      href: composeHref,
      label: "投稿",
      icon: "compose" as const,
      active: false,
      compose: true,
    },
    {
      key: "activity",
      href: "/#your-threads",
      label: "参加中",
      icon: "activity" as const,
      active: false,
      compose: false,
    },
    {
      key: "profile",
      href: "/profile",
      label: "プロフィール",
      icon: "profile" as const,
      active: pathname.startsWith("/profile"),
      compose: false,
    },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--panel)]/95 backdrop-blur sm:hidden"
      aria-label="モバイルナビゲーション"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
        {links.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            aria-current={link.active ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[11px] transition ${
              link.compose
                ? "bg-[var(--accent)] font-semibold text-black"
                : link.active
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <NavIcon kind={link.icon} />
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}