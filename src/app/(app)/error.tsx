"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            The page could not be loaded. Try again or return to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" render={<Link href="/dashboard" />}>
            Go to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
