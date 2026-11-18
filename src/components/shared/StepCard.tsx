import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StepCardProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  /** Primary action(s) shown at the bottom right. */
  actions?: ReactNode;
  busy?: boolean;
}

/** Common frame for every workflow step: title, content, Back + primary actions. */
export const StepCard = ({
  title,
  description,
  children,
  onBack,
  actions,
  busy,
}: StepCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      {children}
      {(onBack || actions) && (
        <div className="flex items-center gap-3 border-t pt-4">
          {onBack && (
            <Button variant="ghost" onClick={onBack} disabled={busy}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <div className="ml-auto flex gap-2">{actions}</div>
        </div>
      )}
    </CardContent>
  </Card>
);
