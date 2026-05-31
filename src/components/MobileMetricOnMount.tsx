"use client";

import { useEffect } from "react";
import type { MobileMetricEventName } from "@/lib/domain/types";
import { trackMobileMetric } from "@/lib/ui/mobile-metrics";

export function MobileMetricOnMount({
  name,
  threadId,
  spaceId,
  composeKind,
  ref,
}: {
  name: MobileMetricEventName;
  threadId?: string;
  spaceId?: string;
  composeKind?: "post" | "reply";
  ref?: string;
}) {
  useEffect(() => {
    void trackMobileMetric({ name, threadId, spaceId, composeKind, ref });
  }, [name, threadId, spaceId, composeKind, ref]);

  return null;
}
