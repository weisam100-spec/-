"use client";

import { useState } from "react";
import type { ChecklistState } from "@/lib/types";

type Item = { id: string; label: React.ReactNode; meta?: React.ReactNode };

export default function CheckList({
  reportId,
  kind,
  items,
  initialState,
  onChange,
}: {
  reportId: string;
  kind: "doc" | "presubmit" | "progress";
  items: Item[];
  initialState: ChecklistState;
  onChange?: (state: ChecklistState) => void;
}) {
  const [state, setState] = useState<ChecklistState>(initialState);

  async function toggle(id: string) {
    const next = { ...state, [id]: !state[id] };
    setState(next);
    onChange?.(next);
    try {
      await fetch(`/api/reports/${reportId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, state: next }),
      });
    } catch {
      // Best-effort persistence — a failed save just means the checkbox
      // resets on next reload; not worth surfacing an error for this.
    }
  }

  return (
    <ul className="check-list">
      {items.map((item) => (
        <li key={item.id} className={state[item.id] ? "checked" : undefined}>
          <input
            type="checkbox"
            id={`${kind}-${item.id}`}
            checked={!!state[item.id]}
            onChange={() => toggle(item.id)}
          />
          <label htmlFor={`${kind}-${item.id}`}>
            <span className="doc-label">{item.label}</span>
            {item.meta && <div className="doc-meta">{item.meta}</div>}
          </label>
        </li>
      ))}
    </ul>
  );
}
