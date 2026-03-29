"use client";

import { useEffect } from "react";
import { initTracking, cleanup } from "@/lib/tracking";

export function TrackerInit() {
  useEffect(() => {
    initTracking();
    return cleanup;
  }, []);

  return null;
}
