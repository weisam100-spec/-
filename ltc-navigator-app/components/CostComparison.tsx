"use client";

import { useMemo, useState } from "react";
import { computeComparison } from "@/lib/rules";
import type { Answers } from "@/lib/types";

export default function CostComparison({
  reportId,
  answers,
  initialLevel,
  dataDate,
}: {
  reportId: string;
  answers: Answers;
  initialLevel: number;
  dataDate: string;
}) {
  const [level, setLevel] = useState(initialLevel);
  const rows = useMemo(() => computeComparison(answers, level), [answers, level]);
  const maxAmount = Math.max(...rows.map((r) => r.amount));

  async function handleChange(next: number) {
    setLevel(next);
    try {
      await fetch(`/api/reports/${reportId}/cms-level`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: next }),
      });
    } catch {
      // best-effort; the select still reflects the chosen level locally
    }
  }

  return (
    <>
      <div className="compare-controls">
        <label htmlFor="cmsLevelSelect">試算用 CMS 長照需要等級</label>
        <select id="cmsLevelSelect" value={level} onChange={(e) => handleChange(Number(e.target.value))}>
          {[2, 3, 4, 5, 6, 7, 8].map((lvl) => (
            <option key={lvl} value={lvl}>第 {lvl} 級</option>
          ))}
        </select>
        <span className="compare-note" style={{ margin: 0 }}>
          {answers.cms === "yes"
            ? "已依您填答的自理能力概略帶入，建議改填實際核定等級以提高準確度。"
            : "已依您填答的自理能力概略帶入，實際等級需經照管中心評估核定。"}
        </span>
      </div>

      <div className="compare-list">
        {rows.map((row) => {
          const pct = maxAmount > 0 ? Math.max(2, Math.round((row.amount / maxAmount) * 100)) : 2;
          return (
            <div className="compare-row" key={row.name}>
              <div className="compare-head">
                <span className="compare-name">{row.name}</span>
                <span className="compare-amount">{row.amountLabel}</span>
              </div>
              <div className="compare-bar-track">
                <div className="compare-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="compare-note">{row.note}</div>
            </div>
          );
        })}
      </div>
      <p className="compare-disclaimer">
        ⚠️ 以上金額為市場行情概估（資料整理日：{dataDate}），非官方公告數據，僅供初步規劃參考。實際費用因個案、機構、地區及議價結果而異，
        長照給付額度與自付比例請以衛生福利部及照管中心最新公告為準，外籍看護工相關費用請以勞動部及仲介公司報價為準。
      </p>
    </>
  );
}
