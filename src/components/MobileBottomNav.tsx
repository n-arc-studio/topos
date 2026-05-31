"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isThreadPath(pathname: string): boolean {
  return /^\/spaces\/[^/]+\/threads\/[^/]+$/.test(pathname);
}

function isSpacePath(pathname: string): boolean {
  return /^\/spaces\/[^/]+$/.test(pathname);
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
      active: pathname === "/",
      compose: false,
    },
    {
      key: "spaces",
      href: "/#spaces",
      label: "場",
      active: pathname === "/" || pathname.startsWith("/spaces/"),
      compose: false,
    },
    {
      key: "compose",
      href: composeHref,
      label: "投稿",
      active: false,
      compose: true,
    },
    {
      key: "activity",
      href: "/#hot-topics",
      label: "通知",
      active: pathname === "/",
      compose: false,
    },
    {
      key: "profile",
      href: "/profile",
      label: "プロフィール",
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
            className={`flex min-h-12 items-center justify-center rounded-md px-2 text-[11px] transition ${
              link.compose
                ? "bg-[var(--accent)] font-semibold text-black"
                : link.active
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}