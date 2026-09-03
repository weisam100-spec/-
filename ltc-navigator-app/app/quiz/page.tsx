"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { QUESTIONS } from "@/lib/questions";
import type { Answers } from "@/lib/types";

export default function QuizPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = QUESTIONS[index];
  const value = (answers as Record<string, string | undefined>)[question.id];
  const isLast = index === QUESTIONS.length - 1;

  function setAnswer(v: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: v }));
  }

  async function goNext() {
    if (!value) return;
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("建立報告失敗");
      const data = await res.json();
      router.push(`/report/${data.id}`);
    } catch {
      setError("送出失敗，請檢查網路連線後再試一次。");
      setSubmitting(false);
    }
  }

  function goBack() {
    if (index === 0) {
      router.push("/");
      return;
    }
    setIndex((i) => i - 1);
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <Link href="/" className="brand">
          <div className="brand-mark">安</div>
          <div>
            <div className="brand-name">安心長照導航</div>
            <div className="brand-sub">長照・外籍看護申請資格快速試算</div>
          </div>
        </Link>
        <ThemeToggle />
      </div>

      <div className="panel">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.round((index / QUESTIONS.length) * 100)}%` }} />
        </div>
        <div className="q-step">問題 {index + 1} / {QUESTIONS.length}</div>
        <div className="q-text">{question.text}</div>

        {question.type === "select" ? (
          <select
            className="county-select"
            value={value ?? ""}
            onChange={(e) => setAnswer(e.target.value)}
          >
            <option value="" disabled>請選擇縣市</option>
            {question.options.map((opt) => (
              <option key={opt.v} value={opt.v}>{opt.t}</option>
            ))}
          </select>
        ) : (
          <div className="options">
            {question.options.map((opt) => (
              <label key={opt.v} className={"option" + (value === opt.v ? " selected" : "")}>
                <input
                  type="radio"
                  name={question.id}
                  value={opt.v}
                  checked={value === opt.v}
                  onChange={() => setAnswer(opt.v)}
                />
                <span>{opt.t}</span>
              </label>
            ))}
          </div>
        )}

        {error && <p style={{ color: "var(--warn-ink)", fontSize: 13, marginTop: 12 }}>{error}</p>}

        <div className="btn-row" style={{ marginTop: 22 }}>
          <button className="btn-ghost" onClick={goBack} disabled={submitting}>← 上一題</button>
          <button className="btn-primary" onClick={goNext} disabled={!value || submitting}>
            {submitting ? "送出中…" : isLast ? "查看結果 →" : "下一題 →"}
          </button>
        </div>
      </div>
    </div>
  );
}
