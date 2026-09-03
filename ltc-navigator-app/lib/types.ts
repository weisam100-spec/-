export type Answers = {
  age?: "under65" | "65to79" | "80plus" | "unknown";
  dementia?: "none" | "mild" | "moderate_severe" | "unclear";
  cms?: "yes" | "no" | "unclear";
  disability?: "cert" | "illness_card" | "none" | "unclear";
  adl?: "full_dependent" | "partial_dependent" | "mostly_independent" | "independent";
  caregiver?: "no_fulltime" | "family_can" | "undecided";
  economic?: "low_income" | "mid_low_income" | "general" | "unclear";
  preference?: "foreign_caregiver" | "institution" | "both" | "community";
  priorExperience?: "never" | "ltc2" | "local_caregiver" | "unclear";
  county?: string;
};

export type ResultStatus = "likely" | "needs" | "unlikely";

export type CategoryResult = {
  status: ResultStatus;
  label: string;
  text: string;
};

export type RuleResults = {
  caregiverResult: CategoryResult;
  barthelResult: CategoryResult;
  ltc2Result: CategoryResult;
  disabilityResult: CategoryResult;
  assistiveResult: CategoryResult;
  institutionResult: CategoryResult;
  isDependent: boolean;
  isIndependent: boolean;
  wantsForeign: boolean;
  wantsInstitution: boolean;
};

export type RouteStep = {
  short: string;
  title: string;
  detail: string;
};

export type DocItem = {
  id: string;
  label: string;
  agency: string;
  validity?: string;
};

export type ChecklistState = Record<string, boolean>;

export type ReportRecord = {
  id: string;
  email: string | null;
  answers: Answers;
  isPaid: boolean;
  createdAt: string;
  paidAt: string | null;
  docState: ChecklistState;
  presubmitState: ChecklistState;
  progressState: ChecklistState;
  cmsLevel: number;
};

export type OrderRecord = {
  id: string;
  reportId: string;
  amountTwd: number;
  status: "pending" | "paid" | "failed";
  merchantTradeNo: string;
  ecpayTradeNo: string | null;
  createdAt: string;
  updatedAt: string;
};
