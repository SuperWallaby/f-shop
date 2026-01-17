"use client";

import { useEffect } from "react";

export default function HydrationProbe() {
  useEffect(() => {
    const bodyAttrs = {
      czShortcutListen: document.body.getAttribute("cz-shortcut-listen"),
      dataGrammarly: document.body.getAttribute("data-gr-ext-installed"),
    };
    const htmlAttrs = {
      czShortcutListen: document.documentElement.getAttribute("cz-shortcut-listen"),
    };
  }, []);

  return null;
}

