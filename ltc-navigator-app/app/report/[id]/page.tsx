import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import ReportView from "@/components/ReportView";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getStore().getReport(id);
  if (!report) notFound();
  return <ReportView report={report} />;
}
