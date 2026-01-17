"use client";

import { useEffect } from "react";

export default function HydrationProbe() {
  useEffect(() => {
    // Intentionally empty: this component exists to force hydration on client.
  }, []);

  return null;
}

