/** 將每個參數的候選數值網格展開成所有組合（卡氏積），供 walk-forward 與參數自動優化共用。 */
export function cartesianProduct(paramGrid: Record<string, number[]>): Record<string, number>[] {
  const keys = Object.keys(paramGrid);
  if (keys.length === 0) return [{}];
  let combos: Record<string, number>[] = [{}];
  for (const key of keys) {
    const values = paramGrid[key]!;
    const next: Record<string, number>[] = [];
    for (const combo of combos) {
      for (const v of values) next.push({ ...combo, [key]: v });
    }
    combos = next;
  }
  return combos;
}
