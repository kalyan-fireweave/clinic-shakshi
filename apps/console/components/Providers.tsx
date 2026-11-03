"use client";

import type { ReactNode } from "react";
import { CountsProvider } from "../lib/counts";
import { TickProvider } from "../lib/tick";
import { FireweaveIdentity } from "./FireweaveIdentity";
import { ToastProvider } from "./Toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TickProvider>
      <ToastProvider>
        <FireweaveIdentity />
        <CountsProvider>{children}</CountsProvider>
      </ToastProvider>
    </TickProvider>
  );
}
