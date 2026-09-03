"use client";

import { useEffect } from "react";

export default function ThemeToggle() {
  useEffect(() => {
    const saved = localStorage.getItem("ltc-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function toggle() {
    const root = document.documentElement;
    const isDark =
      root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("ltc-theme", next);
  }

  return (
    <button className="theme-btn no-print" onClick={toggle} aria-label="切換深色/淺色模式" title="切換深色/淺色模式">
      🌓
    </button>
  );
}
