import type { Answers, CategoryResult, DocItem, RouteStep, RuleResults } from "./types";

export function computeResults(a: Answers): RuleResults {
  const isDependent = a.adl === "full_dependent" || a.adl === "partial_dependent";
  const isIndependent = a.adl === "independent";
  const wantsForeign = a.preference === "foreign_caregiver" || a.preference === "both";
  const wantsInstitution = a.preference === "institution" || a.preference === "both";

  let caregiverResult: CategoryResult;
  if (isIndependent) {
    caregiverResult = { status: "unlikely", label: "可能不符合", text: "家人目前日常生活大致可自理，一般較不易通過「需長期照顧之身心失能者」認定。建議先考慮長照 2.0 居家或社區式服務，若未來自理能力下降可再重新評估。" };
  } else if (a.age === "80plus" && isDependent) {
    caregiverResult = { status: "likely", label: "可能符合", text: "80 歲以上且有照顧需求，可能免經醫療機構專業評估，可直接經照管中心評估後提出申請，建議儘速洽詢照管中心確認。" };
  } else if (a.dementia === "moderate_severe" && isDependent) {
    caregiverResult = { status: "likely", label: "可能符合", text: "中度以上失智症（CDR 2 以上）合併照顧需求，可能符合免另作巴氏量表的條件，經專科醫師開立診斷證明後即可申請。" };
  } else if (a.cms === "yes" && isDependent) {
    caregiverResult = { status: "likely", label: "可能符合", text: "已有照管中心 CMS 2～8 級評估紀錄，可能可透過長照與外籍看護工「雙軌銜接」機制申請，免重新做巴氏量表。" };
  } else if (isDependent) {
    caregiverResult = { status: "needs", label: "需進一步評估", text: "一般情況下需先至醫院由專科醫師進行巴氏量表評估，總分 35 分（含）以下並開立診斷證明後，才符合申請資格。" };
  } else {
    caregiverResult = { status: "needs", label: "需進一步評估", text: "目前資訊尚不足以判斷照顧需求程度，建議先至照管中心或醫院評估。" };
  }

  let barthelResult: CategoryResult;
  if (isIndependent) {
    barthelResult = { status: "unlikely", label: "暫不適用", text: "家人目前大致可自理，暫無巴氏量表評估之適用情境。" };
  } else if (a.age === "80plus" && isDependent) {
    barthelResult = { status: "likely", label: "可能免評估", text: "80 歲以上且有照顧需求者，可能符合免經醫療機構專業評估（含巴氏量表）之條件。" };
  } else if (a.dementia === "moderate_severe" && isDependent) {
    barthelResult = { status: "likely", label: "可能免評估", text: "中度以上失智症者，可能可憑專科醫師診斷證明取代巴氏量表評估。" };
  } else if (a.cms === "yes" && isDependent) {
    barthelResult = { status: "likely", label: "可能免評估", text: "已有照管中心 CMS 評估紀錄，可能可作為巴氏量表以外的替代評估依據。" };
  } else {
    barthelResult = { status: "needs", label: "可能需要評估", text: "較可能仍需至醫院由專科醫師進行巴氏量表評估，作為申請外籍看護工的資格依據。" };
  }

  let ltc2Result: CategoryResult;
  if (isDependent || a.cms === "yes") {
    ltc2Result = { status: "likely", label: "可能符合", text: "有照顧需求或已有 CMS 評估紀錄，可能可申請長照 2.0 居家服務、日間照顧、喘息服務等，自付比例依家庭經濟身分而定。" };
  } else if (a.adl === "mostly_independent") {
    ltc2Result = { status: "needs", label: "需進一步評估", text: "目前大致可自理但偶需協助，建議洽照管中心評估是否符合預防性 / 輕度長照服務資格。" };
  } else {
    ltc2Result = { status: "unlikely", label: "可能不符合", text: "目前照顧需求尚不明確，長照 2.0 服務較不適用，如狀況改變可再重新評估。" };
  }

  let disabilityResult: CategoryResult;
  if (a.disability === "cert" || a.disability === "illness_card") {
    disabilityResult = { status: "likely", label: "已持有證明", text: "已持有身心障礙證明或重大傷病卡，通常免重新鑑定，但請留意證明效期及複檢（重新鑑定）時間。" };
  } else if (isDependent) {
    disabilityResult = { status: "likely", label: "可能符合申請資格", text: "生活自理能力已受影響，可能符合申請身心障礙鑑定資格，建議洽戶籍地公所社會局（處）諮詢鑑定流程。" };
  } else if (a.adl === "mostly_independent") {
    disabilityResult = { status: "needs", label: "需進一步評估", text: "目前狀況尚不明確是否達鑑定標準，建議先諮詢醫療院所或社會局評估必要性。" };
  } else {
    disabilityResult = { status: "unlikely", label: "暫不適用", text: "目前生活大致可自理，暫無申請身心障礙鑑定之明顯需求。" };
  }

  let assistiveResult: CategoryResult;
  if (isDependent || a.disability === "cert" || a.disability === "illness_card" || a.cms === "yes") {
    assistiveResult = { status: "likely", label: "可能符合", text: "可能符合輔具（如輪椅、氣墊床、助行器等）及居家無障礙環境改善補助資格，需經照管中心或輔具資源中心評估後核定項目與額度。" };
  } else if (a.adl === "mostly_independent") {
    assistiveResult = { status: "needs", label: "需進一步評估", text: "如有特定行動不便情形，建議洽輔具資源中心評估是否符合補助資格。" };
  } else {
    assistiveResult = { status: "unlikely", label: "暫不適用", text: "目前行動及生活能力大致良好，暫無明顯輔具或無障礙改善需求。" };
  }

  let institutionResult: CategoryResult;
  if (a.economic === "low_income") {
    institutionResult = { status: "likely", label: "可能性較高", text: "屬低收入戶者，入住住宿式長照機構時，符合公費安置或全額 / 高額補助的可能性較高，建議洽戶籍地公所社會局（處）及長照中心確認可申請項目。" };
  } else if (a.economic === "mid_low_income") {
    institutionResult = { status: "likely", label: "可能性中高", text: "屬中低收入戶者，通常有機會取得一定比例補助，實際額度依當年度地方政府公告方案而定。" };
  } else if (a.economic === "general" && (isDependent || a.cms === "yes")) {
    institutionResult = { status: "needs", label: "需視地方方案而定", text: "一般戶但有照顧需求或 CMS 評估紀錄，部分縣市對特定 CMS 等級提供床位費或服務費補助，但多數費用仍需自付，且各縣市方案每年可能調整。" };
  } else if (a.economic === "general") {
    institutionResult = { status: "unlikely", label: "可能性較低", text: "一般戶且照顧需求尚未明確，符合機構補助的可能性較低，機構費用可能需全額自付。" };
  } else {
    institutionResult = { status: "needs", label: "需先確認資格", text: "尚不確定家庭經濟身分，建議先向戶籍地公所確認是否符合低收入戶 / 中低收入戶資格。" };
  }

  return {
    caregiverResult, barthelResult, ltc2Result, disabilityResult, assistiveResult, institutionResult,
    isDependent, isIndependent, wantsForeign, wantsInstitution,
  };
}

export function buildRoute(a: Answers, r: RuleResults): RouteStep[] {
  const steps: RouteStep[] = [];
  steps.push({ short: "撥打 1966 聯繫照管中心", title: "聯繫戶籍地「長期照顧管理中心」（照管中心）", detail: `撥打長照專線 1966，或至${a.county || "所在"}長期照顧管理中心，安排 CMS 需求評估與長照服務諮詢，這通常是後續申請的第一步。` });

  if (a.cms !== "yes") {
    steps.push({ short: "申請長照需求評估（CMS）", title: "申請長期照顧需求評估", detail: "由照管中心安排照顧管理專員到宅或到院評估，核定 CMS 等級，作為後續各項長照服務與補助的依據。" });
  }

  if (r.barthelResult.status === "needs") {
    steps.push({ short: "準備巴氏量表診斷證明", title: "至醫院安排巴氏量表評估", detail: "攜帶健保卡及相關病歷資料，至醫院由專科醫師進行巴氏量表評估及開立診斷證明書。" });
  } else if (a.dementia === "moderate_severe") {
    steps.push({ short: "準備失智症診斷證明", title: "取得失智症診斷證明書", detail: "由專科醫師開立診斷證明書並載明 CDR 分數或嚴重程度，作為免評估申請的佐證文件。" });
  } else if (a.age === "80plus") {
    steps.push({ short: "免醫療評估，逕行送件", title: "確認免專業評估資格", detail: "80 歲以上且有照顧需求者，可能免經醫療機構專業評估，向照管中心確認後即可準備送件。" });
  }

  if (r.wantsForeign) {
    steps.push({ short: "向勞動部辦理外籍看護工申請", title: "洽勞動部勞動力發展署辦理外籍看護工申請", detail: "取得資格文件後，向勞動部勞動力發展署所屬各分署提出申請，並委託合法仲介或自行辦理跨國聘僱作業。" });
  }
  if (r.wantsInstitution) {
    steps.push({ short: "洽住宿式機構及社會局", title: "洽詢住宿式長照機構及地方社會局", detail: "選定合法立案之住宿式長照機構，並向地方政府社會局（處）確認當年度可申請之床位費或服務費補助方案。" });
  }
  if (a.preference === "community") {
    steps.push({ short: "由照管中心安排長照2.0服務", title: "安排長照 2.0 居家 / 社區式服務", detail: "由照管中心依 CMS 等級擬定照顧計畫，安排居家服務、日間照顧或喘息服務等資源。" });
  }
  if (a.economic === "low_income" || a.economic === "mid_low_income") {
    steps.push({ short: "向公所申請低收/中低收證明", title: "向戶籍地公所確認低收 / 中低收入戶資格", detail: "備妥財力證明文件，向戶籍地公所申請低收入戶或中低收入戶證明，作為補助申請依據。" });
  }

  steps.push({ short: "送件並保留文件副本", title: "備齊文件並向指定單位送件", detail: "依上述各單位指示送件，建議保留所有文件掃描副本，並記錄各單位承辦人聯絡方式以利追蹤進度。" });

  return steps;
}

export function buildDocuments(a: Answers, r: RuleResults): DocItem[] {
  const docs: DocItem[] = [
    { id: "id_card", label: "受照顧者身分證正反面影本", agency: "自備" },
    { id: "applicant_id", label: "申請人（家屬）身分證正反面影本及與受照顧者之關係證明（如戶口名簿）", agency: "自備" },
  ];
  if (a.cms !== "yes") {
    docs.push({ id: "cms_form", label: "長期照顧管理中心 CMS 需求評估申請表", agency: "長期照顧管理中心", validity: "長照需求評估結果通常有一定效期，如已超過一段時間，建議洽照管中心確認是否需複評。" });
  }
  if (r.barthelResult.status === "needs") {
    docs.push({ id: "barthel", label: "醫院開立之巴氏量表評估表及專科醫師診斷證明書", agency: "醫院／診所", validity: "請留意開立日期，受理單位多要求為近期開立之證明，實際效期請以受理單位公告為準。" });
  }
  if (a.dementia === "moderate_severe") {
    docs.push({ id: "dementia_cert", label: "失智症診斷證明書（載明 CDR 分數或嚴重程度）", agency: "醫院／診所" });
  }
  if (a.disability === "cert") docs.push({ id: "disability_cert", label: "身心障礙證明影本", agency: "自備", validity: "請留意證明有效期限及複檢（重新鑑定）時間。" });
  if (a.disability === "illness_card") docs.push({ id: "illness_card", label: "重大傷病卡影本", agency: "自備", validity: "請留意卡片有效期限，屆期前需辦理更換。" });
  if (r.disabilityResult.status === "likely" && a.disability !== "cert" && a.disability !== "illness_card") {
    docs.push({ id: "disability_apply", label: "身心障礙鑑定申請表（如尚未持有身心障礙證明）", agency: "戶籍地公所社會局" });
  }
  if (r.assistiveResult.status === "likely") {
    docs.push({ id: "assistive_form", label: "輔具評估及居家無障礙改善補助申請表", agency: "照管中心／輔具資源中心" });
  }
  if (a.economic === "low_income" || a.economic === "mid_low_income") {
    docs.push({ id: "income_proof", label: "低收入戶 / 中低收入戶證明", agency: "戶籍地公所", validity: "通常為當年度證明，次年度需重新申請。" });
  }
  if (r.wantsForeign) {
    docs.push({ id: "hire_permit", label: "外國人聘僱許可申請書", agency: "勞動部勞動力發展署", validity: "核准後之聘僱許可有一定效期，屆期前需辦理展延，請留意到期時間。" });
    docs.push({ id: "hire_contract", label: "聘僱看護工切結書及相關聘僱契約文件", agency: "勞動部勞動力發展署／合法仲介" });
  }
  if (r.wantsInstitution) {
    docs.push({ id: "institution_form", label: "擬入住機構之評估與入住申請表", agency: "擬入住機構" });
  }
  docs.push({ id: "photo", label: "近期一吋照片數張（依各申請項目規定備用）", agency: "自備" });
  return docs;
}

export const PRESUBMIT_ITEMS = [
  "所有文件皆為正本，或已加蓋核章之有效影本",
  "身分證、戶口名簿等基本資料與受照顧者一致，無過期或損毀",
  "診斷證明／評估表之開立日期在受理單位要求的效期內",
  "申請表格簽名、蓋章及日期均已填妥",
  "如需保證人或切結書，已備妥並完成簽署",
  "已確認送件單位、送件方式（現場／郵寄／線上）及應備份數",
];

export const PROGRESS_STAGES = ["已預約評估", "已取得診斷證明", "已送件", "等待審查", "需要補件", "已核准"];

/* ---------- Cost comparison (market-rate estimates, not official figures) ---------- */
export const CMS_MONTHLY_ALLOWANCE: Record<number, number> = { 2: 10020, 3: 15460, 4: 18580, 5: 24100, 6: 28070, 7: 32090, 8: 36180 };
export const SELF_PAY_RATIO: Record<string, number> = { low_income: 0, mid_low_income: 0.05, general: 0.16, unclear: 0.16 };
export const FOREIGN_CAREGIVER_MONTHLY = { wage: 20000, stabilizationFee: 2000, healthInsurance: 1428, laborInjuryInsurance: 56 };
export const INSTITUTION_MONTHLY_RANGE = { low: 30000, high: 60000 };

export function defaultCmsLevel(a: Answers): number {
  if (a.adl === "full_dependent") return 7;
  if (a.adl === "partial_dependent") return 4;
  if (a.adl === "mostly_independent") return 2;
  return 4;
}

export function fmtNT(n: number): string {
  return "NT$" + Math.round(n).toLocaleString("en-US");
}

export type CompareRow = { name: string; amount: number; amountLabel: string; note: string };

export function computeComparison(a: Answers, cmsLevel: number): CompareRow[] {
  const ratio = SELF_PAY_RATIO[a.economic ?? "unclear"] ?? 0.16;
  const allowance = CMS_MONTHLY_ALLOWANCE[cmsLevel] || 0;
  const homeCareSelfPay = allowance * ratio;
  const dayCareSelfPay = allowance * ratio;
  const foreignTotal = FOREIGN_CAREGIVER_MONTHLY.wage + FOREIGN_CAREGIVER_MONTHLY.stabilizationFee + FOREIGN_CAREGIVER_MONTHLY.healthInsurance + FOREIGN_CAREGIVER_MONTHLY.laborInjuryInsurance;
  const institutionMid = (INSTITUTION_MONTHLY_RANGE.low + INSTITUTION_MONTHLY_RANGE.high) / 2;

  return [
    { name: "自己照顧（家人親自照顧）", amount: 0, amountLabel: "無直接現金支出", note: "沒有服務費用，但需考量家庭照顧者的時間、體力、心理負荷，以及可能減少的工作收入（機會成本），長期而言仍是一種實質成本。" },
    { name: "長照 2.0 居家服務（居服員到宅）", amount: homeCareSelfPay, amountLabel: fmtNT(homeCareSelfPay) + " / 月起", note: `政府月給付額度約 ${fmtNT(allowance)}（依 CMS ${cmsLevel} 級），依經濟身分自付約 ${Math.round(ratio * 100)}%；超出額度部分需全額自付。` },
    { name: "長照 2.0 日間照顧中心", amount: dayCareSelfPay, amountLabel: fmtNT(dayCareSelfPay) + " / 月起", note: "自付比例與居家服務相同，另需考量交通接送費用，如無法使用長照交通接送資源，可能需自費。" },
    { name: "聘僱外籍家庭看護工", amount: foreignTotal, amountLabel: fmtNT(foreignTotal) + " / 月起", note: `雇主每月概估負擔，含薪資 ${fmtNT(FOREIGN_CAREGIVER_MONTHLY.wage)}、就業安定費 ${fmtNT(FOREIGN_CAREGIVER_MONTHLY.stabilizationFee)}、健保及職災保險雇主負擔部分；不含仲介服務費、膳宿及每年續約相關成本。` },
    { name: "住宿式長照機構（護理之家／長照機構）", amount: institutionMid, amountLabel: `${fmtNT(INSTITUTION_MONTHLY_RANGE.low)} ～ ${fmtNT(INSTITUTION_MONTHLY_RANGE.high)} / 月`, note: "依地區、房型及照護等級差異甚大；符合低收入戶／中低收入戶等資格者，另有機構補助方案可折抵部分費用，額度依當年度公告及地方政府方案而定。" },
  ];
}
