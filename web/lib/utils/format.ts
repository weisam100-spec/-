export function formatNumber(n: number, fractionDigits = 0): string {
  return n.toLocaleString("zh-Hant-TW", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatPercent(n: number, fractionDigits = 2): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(fractionDigits)}%`;
}

export function formatSigned(n: number, fractionDigits = 2): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatNumber(n, fractionDigits)}`;
}

export function formatCompactAmount(amount: number): string {
  // amount is in NTD; display as 億 (100M) when large.
  if (Math.abs(amount) >= 1_0000_0000) {
    return `${(amount / 1_0000_0000).toFixed(1)}億`;
  }
  if (Math.abs(amount) >= 1_0000) {
    return `${(amount / 1_0000).toFixed(1)}萬`;
  }
  return formatNumber(amount);
}
