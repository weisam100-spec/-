"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import CheckList from "@/components/CheckList";
import CostComparison from "@/components/CostComparison";
import Paywall from "@/components/Paywall";
import { buildDocuments, buildRoute, computeResults, PRESUBMIT_ITEMS, PROGRESS_STAGES } from "@/lib/rules";
import type { ReportRecord } from "@/lib/types";

function statusClass(status: string) {
  if (status === "likely") return "status-likely";
  if (status === "needs") return "status-needs";
  return "status-unlikely";
}

export default function ReportView({ report }: { report: ReportRecord }) {
  const r = computeResults(report.answers);
  const routeSteps = buildRoute(report.answers, r);
  const docs = buildDocuments(report.answers, r);
  const dataDate = new Date(report.createdAt).toISOString().slice(0, 10);

  const categories = [
    { title: "外籍家庭看護工申請資格", r: r.caregiverResult },
    { title: "巴氏量表是否可能免評估", r: r.barthelResult },
    { title: "長照 2.0 居家 / 社區服務", r: r.ltc2Result },
    { title: "住宿式機構補助可能性", r: r.institutionResult },
    { title: "身心障礙鑑定", r: r.disabilityResult },
    { title: "輔具及居家無障礙補助", r: r.assistiveResult },
  ];

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
        <span className="eyebrow">試算結果</span>
        <h1 style={{ fontSize: 24 }}>您的家庭長照申請報告</h1>
        <p className="lede" style={{ marginBottom: 20 }}>
          資料參考基準日：{dataDate}（規定內容以主管機關最新公告為準）
        </p>

        <h2 className="section-title" style={{ marginTop: 0 }}>個人化申請路線</h2>
        <p className="section-sub">依您的填答，建議依序進行以下步驟</p>
        <div className="route-strip">
          {routeSteps.map((s, idx) => (
            <span key={s.short} style={{ display: "contents" }}>
              {idx > 0 && <span className="route-arrow">→</span>}
              <span className="route-step">
                <span className="n">{idx + 1}</span>
                <span>{s.short}</span>
              </span>
            </span>
          ))}
        </div>

        <h2 className="section-title">六大資格方向</h2>
        <p className="section-sub">綠色代表可能符合、黃色代表需進一步評估、灰色代表可能不適用</p>
        <div className="cat-grid">
          {categories.map((item) => (
            <div className={`result-card ${statusClass(item.r.status)}`} key={item.title}>
              <div className="result-title">
                {item.title}
                <span className="status-pill">{item.r.label}</span>
              </div>
              <div className="result-desc">{item.r.text}</div>
            </div>
          ))}
        </div>

        {!report.isPaid && <Paywall reportId={report.id} />}

        {report.isPaid && (
          <>
            <h2 className="section-title">照護方案費用比較（試算）</h2>
            <p className="section-sub">比較「自己照顧、長照 2.0 居家服務、日間照顧、外籍看護、住宿式機構」五種方案的月支出概估</p>
            <CostComparison reportId={report.id} answers={report.answers} initialLevel={report.cmsLevel} dataDate={dataDate} />

            <h2 className="section-title">應備文件清單</h2>
            <p className="section-sub">勾選已完成項目，進度會保存在您的報告中</p>
            <CheckList
              reportId={report.id}
              kind="doc"
              initialState={report.docState}
              items={docs.map((d) => ({
                id: d.id,
                label: d.label,
                meta: (
                  <>
                    <span className="agency-tag">{d.agency}</span>
                    {d.validity ?? "應備文件"}
                  </>
                ),
              }))}
            />

            <h2 className="section-title">送件前檢查清單</h2>
            <p className="section-sub">送件前再次確認，避免文件退件或補件</p>
            <CheckList
              reportId={report.id}
              kind="presubmit"
              initialState={report.presubmitState}
              items={PRESUBMIT_ITEMS.map((t, i) => ({ id: `p${i}`, label: t }))}
            />

            <h2 className="section-title">申請進度追蹤</h2>
            <CheckList
              reportId={report.id}
              kind="progress"
              initialState={report.progressState}
              items={PROGRESS_STAGES.map((t, i) => ({ id: `s${i}`, label: t }))}
            />

            <h2 className="section-title">下一步聯繫窗口說明</h2>
            <ul className="step-list">
              {routeSteps.map((s, idx) => (
                <li key={s.title}>
                  <div className="step-num">{idx + 1}</div>
                  <div>
                    <b>{s.title}</b>
                    <br />
                    <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>{s.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="risk-note">
          ⚠️ 以上結果僅供申請準備參考，最終資格、補助金額與核定結果，仍需經醫療機構專業評估、
          長期照顧管理中心（照管中心）評估，以及勞動部勞動力發展署或地方政府主管機關實際審查後始能確認。
          文件效期請以受理單位當下公告為準。
        </div>

        {report.isPaid && (
          <div className="btn-row no-print">
            <button className="btn-primary" onClick={() => window.print()}>🖨️ 列印 / 另存 PDF</button>
            <Link href="/quiz" className="btn btn-ghost">重新測驗</Link>
          </div>
        )}
      </div>

      <div className="footer-note">
        安心長照導航 是提供一般性資訊之工具，非醫療、法律或政府機關正式服務。<br />
        長照專線：1966（長期照顧管理中心）｜外籍勞工諮詢保護專線：1955
      </div>
    </div>
  );
}
