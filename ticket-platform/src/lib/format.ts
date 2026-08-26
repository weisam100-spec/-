export function formatCents(cents: number) {
  return `NT$${(cents / 100).toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
