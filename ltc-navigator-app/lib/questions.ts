export type QuestionOption = { v: string; t: string };

export type Question = {
  id: keyof import("./types").Answers;
  text: string;
  type?: "select";
  options: QuestionOption[];
};

export const COUNTIES = [
  "臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市", "新竹市", "新竹縣",
  "苗栗縣", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣",
  "臺東縣", "澎湖縣", "金門縣", "連江市",
];

export const QUESTIONS: Question[] = [
  {
    id: "age",
    text: "需要照顧的家人，目前年齡是？",
    options: [
      { v: "under65", t: "未滿 65 歲" },
      { v: "65to79", t: "65～79 歲" },
      { v: "80plus", t: "80 歲以上" },
      { v: "unknown", t: "不確定" },
    ],
  },
  {
    id: "dementia",
    text: "這位家人是否有醫師診斷的失智症？嚴重程度大約是？",
    options: [
      { v: "none", t: "沒有失智症診斷" },
      { v: "mild", t: "有診斷，程度較輕（CDR 0.5～1 或不確定嚴重度）" },
      { v: "moderate_severe", t: "有診斷，中度以上（CDR 2 以上）" },
      { v: "unclear", t: "不確定 / 尚未診斷" },
    ],
  },
  {
    id: "cms",
    text: "這位家人是否已到「長期照顧管理中心」做過評估，並取得 CMS 等級（2～8 級）？",
    options: [
      { v: "yes", t: "是，已有 CMS 2～8 級評估紀錄" },
      { v: "no", t: "否，還沒做過評估" },
      { v: "unclear", t: "不確定" },
    ],
  },
  {
    id: "disability",
    text: "這位家人是否領有「身心障礙證明」或「重大傷病卡」？",
    options: [
      { v: "cert", t: "有身心障礙證明" },
      { v: "illness_card", t: "有重大傷病卡" },
      { v: "none", t: "都沒有" },
      { v: "unclear", t: "不確定" },
    ],
  },
  {
    id: "adl",
    text: "日常生活自理能力大致是？（進食、移位、如廁、穿脫衣物、大小便控制等）",
    options: [
      { v: "full_dependent", t: "完全依賴他人協助，幾乎所有活動都需要人幫忙" },
      { v: "partial_dependent", t: "部分依賴，例如移位、如廁需要協助" },
      { v: "mostly_independent", t: "大致可自理，僅需少量協助或監督" },
      { v: "independent", t: "完全可自理" },
    ],
  },
  {
    id: "caregiver",
    text: "目前主要照顧者的狀況？",
    options: [
      { v: "no_fulltime", t: "沒有家人可以全天照顧，需要有人全天在家協助" },
      { v: "family_can", t: "家人可以照顧，但希望減輕負擔" },
      { v: "undecided", t: "尚未確定照顧方式" },
    ],
  },
  {
    id: "economic",
    text: "家庭經濟狀況大致屬於？",
    options: [
      { v: "low_income", t: "低收入戶" },
      { v: "mid_low_income", t: "中低收入戶" },
      { v: "general", t: "一般戶" },
      { v: "unclear", t: "不確定" },
    ],
  },
  {
    id: "preference",
    text: "比較傾向的照顧方式？",
    options: [
      { v: "foreign_caregiver", t: "聘僱外籍家庭看護工，在家照顧" },
      { v: "institution", t: "送至住宿式長照機構（護理之家 / 長照機構）" },
      { v: "both", t: "還在考慮，兩者都想了解" },
      { v: "community", t: "想先了解長照 2.0 居家 / 社區服務" },
    ],
  },
  {
    id: "priorExperience",
    text: "是否曾聘僱本國看護，或申請過長照相關服務？",
    options: [
      { v: "never", t: "從未申請過任何長照或看護服務" },
      { v: "ltc2", t: "曾申請長照 2.0 服務（如居家服務、日間照顧）" },
      { v: "local_caregiver", t: "曾聘僱本國籍看護" },
      { v: "unclear", t: "不確定" },
    ],
  },
  {
    id: "county",
    text: "受照顧家人目前設籍 / 居住縣市？",
    type: "select",
    options: COUNTIES.map((c) => ({ v: c, t: c })),
  },
];
