// 顯示用格式化工具：計算一律使用完整精度（number），僅在畫面呈現時四捨五入。

export function formatUsdt(value: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? (Math.abs(value) < 1 ? 4 : Math.abs(value) < 100 ? 2 : 2);
  return `${value.toLocaleString("zh-TW", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} USDT`;
}

export function formatTwd(value: number): string {
  return `NT$${Math.round(value).toLocaleString("zh-TW")}`;
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString("zh-TW", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("zh-TW", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

const TAIPEI_TZ = "Asia/Taipei";

export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TAIPEI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TAIPEI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} 小時`;
  const days = hours / 24;
  return `${days.toFixed(1)} 天`;
}

export function signClass(value: number): string {
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "";
}

export function signPrefix(value: number): "▲" | "▼" | "—" {
  if (value > 0) return "▲";
  if (value < 0) return "▼";
  return "—";
}
