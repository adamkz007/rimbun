import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  phase: number;
};

export function ModulePlaceholder({
  title,
  description,
  phase,
}: ModulePlaceholderProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          This module is enabled for your clinic but not available yet.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-muted p-2">
              <Construction className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>Coming in Phase {phase}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
