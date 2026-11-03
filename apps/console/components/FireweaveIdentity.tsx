"use client";

import { fw } from "@fireweaveai/web-sdk/start";
import { useEffect } from "react";

/**
 * Binds FireWeave cohort identity on session restore.
 * Never gate this behind a control point — identity is the precondition for reads.
 */
export function FireweaveIdentity() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/auth/get-session");
      if (!res.ok || cancelled) return;
      const body = (await res.json().catch(() => null)) as {
        user?: { id?: string; email?: string };
      } | null;
      if (!body?.user?.id || cancelled) return;
      await fw.identify(body.user.id, { email: body.user.email });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
