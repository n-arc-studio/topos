"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function isThreadPath(pathname: string): boolean {
  return /^\/spaces\/[^/]+\/threads\/[^/]+$/.test(pathname);
}

function isSpacePath(pathname: string): boolean {
  return /^\/spaces\/[^/]+$/.test(pathname);
}

export function MobileComposeCta({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const onThread = isThreadPath(pathname);
  const onSpace = isSpacePath(pathname);
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  const composeHref = !isLoggedIn
    ? loginHref
    : onThread
      ? `${pathname}#composer`
      : onSpace
        ? `${pathname}#new-thread`
        : "/#spaces";

  const replyHref = !isLoggedIn
    ? loginHref
    : onThread
      ? `${pathname}#reply-latest`
      : composeHref;

  const bottomPx = 80 + keyboardOffset;

  return (
    <div
      className="fixed right-4 z-20 sm:hidden"
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${bottomPx}px)` }}
    >
      {onThread ? (
        <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-2)] p-1.5 shadow-lg backdrop-blur">
          <Link
            href={replyHref}
            className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--foreground)]"
          >
            返信
          </Link>
          <Link
            href={composeHref}
            className="rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black"
          >
            投稿
          </Link>
        </div>
      ) : (
        <Link
          href={composeHref}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-black shadow-lg"
        >
          投稿する
        </Link>
      )}
    </div>
  );
}
