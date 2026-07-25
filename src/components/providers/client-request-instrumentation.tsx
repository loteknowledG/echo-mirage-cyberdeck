"use client";

import { useEffect } from "react";
import { installClientRequestInstrumentation } from "@/lib/client/client-request-instrumentation.client";

export function ClientRequestInstrumentation() {
  useEffect(() => {
    installClientRequestInstrumentation();
  }, []);

  return null;
}
