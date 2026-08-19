"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useStockAnalysis } from "@/hooks/useStockAnalysis";
import { StockHeader } from "@/components/stock/StockHeader";
import { KLineSection } from "@/components/stock/KLineSection";
import { QuickIndicatorCards } from "@/components/stock/QuickIndicatorCards";
import { TechnicalAnalysisPanel } from "@/components/stock/TechnicalAnalysisPanel";
import { AIScoreCard } from "@/components/stock/AIScoreCard";
import { AIAnalysisCard } from "@/components/stock/AIAnalysisCard";
import { ComingSoonCard } from "@/components/common/ComingSoonCard";
import { MockDataBanner } from "@/components/common/MockDataBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StockAnalysisPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = use(params);
  const { data, isLoading, isError, error } = useStockAnalysis(symbol);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        返回
      </Link>

      <MockDataBanner />

      {isLoading && (
        <div className="flex flex-col gap-4">
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : "找不到這檔股票"}
          ，請確認代號是否正確，或回首頁重新搜尋。
        </div>
      )}

      {data && (
        <>
          <StockHeader quote={data.quote} />

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">總覽</TabsTrigger>
              <TabsTrigger value="technical">技術面</TabsTrigger>
              <TabsTrigger value="fundamental">基本面</TabsTrigger>
              <TabsTrigger value="chip">籌碼面</TabsTrigger>
              <TabsTrigger value="ai">AI分析</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex flex-col gap-4">
              <KLineSection symbol={symbol} />
              <QuickIndicatorCards
                technical={data.technical}
                technicalAnalysis={data.technicalAnalysis}
              />
            </TabsContent>

            <TabsContent value="technical">
              <TechnicalAnalysisPanel
                technical={data.technical}
                technicalAnalysis={data.technicalAnalysis}
              />
            </TabsContent>

            <TabsContent value="fundamental">
              <ComingSoonCard feature="基本面分析" />
            </TabsContent>

            <TabsContent value="chip">
              <ComingSoonCard feature="籌碼分析" />
            </TabsContent>

            <TabsContent value="ai" className="flex flex-col gap-4">
              <AIScoreCard score={data.score} />
              <AIAnalysisCard analysis={data.analysis} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
