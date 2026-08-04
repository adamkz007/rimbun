"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type PrintButtonProps = {
  label?: string;
};

export function PrintButton({ label = "Print" }: PrintButtonProps) {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
