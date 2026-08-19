import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoonCard({ feature }: { feature: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
        <Sparkles className="size-6" />
        <p className="text-sm">
          「{feature}」將於 Phase 2 推出，敬請期待。
        </p>
      </CardContent>
    </Card>
  );
}
