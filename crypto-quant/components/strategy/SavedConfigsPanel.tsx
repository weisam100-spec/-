"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import {
  useDeleteStrategyConfig,
  useDuplicateStrategyConfig,
  useStrategyConfigs,
  useUpdateStrategyConfig,
} from "@/lib/client/hooks";
import { strategyRegistry } from "@/lib/strategies/registry";
import type { StrategyConfigRecord } from "@/lib/storage/strategyConfigRepo";
import { formatDateTime } from "@/lib/format";

export function SavedConfigsPanel({ onLoad }: { onLoad: (config: StrategyConfigRecord) => void }) {
  const { data, isLoading } = useStrategyConfigs();
  const deleteMutation = useDeleteStrategyConfig();
  const duplicateMutation = useDuplicateStrategyConfig();
  const updateMutation = useUpdateStrategyConfig();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (isLoading) return <p className="text-xs text-[var(--color-text-muted)]">載入已儲存設定…</p>;
  const configs = data?.configs ?? [];
  if (configs.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)]">尚無已儲存的策略設定，設定完成後可點選下方「儲存設定」。</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {configs.map((c) => (
        <li key={c.id} className="rounded-md border border-[var(--color-border)] p-2 text-xs">
          {renamingId === c.id ? (
            <div className="flex items-center gap-1">
              <TextInput value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="flex-1" />
              <Button
                variant="secondary"
                className="!px-2 !py-1"
                onClick={() => {
                  updateMutation.mutate({ id: c.id, patch: { name: renameValue } });
                  setRenamingId(null);
                }}
              >
                儲存
              </Button>
              <Button variant="ghost" className="!px-2 !py-1" onClick={() => setRenamingId(null)}>
                取消
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--color-text)]">{c.name}</span>
                <span className="text-[var(--color-text-muted)]">{strategyRegistry[c.strategyId].name}</span>
              </div>
              <p className="mt-0.5 text-[var(--color-text-muted)]">
                {c.symbol} · {c.interval} · 更新於 {formatDateTime(c.updatedAt)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button variant="secondary" className="!px-2 !py-1" onClick={() => onLoad(c)}>
                  載入
                </Button>
                <Button
                  variant="ghost"
                  className="!px-2 !py-1"
                  onClick={() => {
                    setRenamingId(c.id);
                    setRenameValue(c.name);
                  }}
                >
                  重新命名
                </Button>
                <Button variant="ghost" className="!px-2 !py-1" onClick={() => duplicateMutation.mutate(c.id)}>
                  複製
                </Button>
                {confirmDeleteId === c.id ? (
                  <>
                    <Button
                      variant="danger"
                      className="!px-2 !py-1"
                      onClick={() => {
                        deleteMutation.mutate(c.id);
                        setConfirmDeleteId(null);
                      }}
                    >
                      確定刪除？
                    </Button>
                    <Button variant="ghost" className="!px-2 !py-1" onClick={() => setConfirmDeleteId(null)}>
                      取消
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" className="!px-2 !py-1 text-[var(--color-down)]" onClick={() => setConfirmDeleteId(c.id)}>
                    刪除
                  </Button>
                )}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
