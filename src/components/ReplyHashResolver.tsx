"use client";

import { useEffect } from "react";

export function ReplyHashResolver({ latestPostId }: { latestPostId: string | null }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#reply-latest") return;

    if (latestPostId) {
      window.location.hash = `reply-${latestPostId}`;
      return;
    }

    window.location.hash = "composer";
  }, [latestPostId]);

  return null;
}
