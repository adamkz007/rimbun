"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Users, ClipboardPen, LayoutDashboard, Repeat2, Settings } from "lucide-react";
import { hasAccess } from "@/lib/rbac";
import type { ClinicSettings, StaffRole } from "@/types/database";

type SearchResult = {
  id: string;
  full_name: string;
  mrn: string;
};

type CommandPaletteProps = {
  role: StaffRole;
  clinicSettings?: ClinicSettings | null;
};

export function CommandPalette({
  role,
  clinicSettings,
}: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<SearchResult[]>([]);

  const pages = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, visible: true },
    {
      path: "/clerking",
      label: "Clerking",
      icon: ClipboardPen,
      visible: hasAccess({
        role,
        clinicSettings,
        access: {
          roles: ["doctor", "nurse"],
          module: "clerking",
        },
      }),
    },
    { path: "/patients", label: "Patients", icon: Users, visible: true },
    {
      path: "/cases",
      label: "Care Loop",
      icon: Repeat2,
      visible: hasAccess({
        role,
        clinicSettings,
        access: {
          module: "loop",
        },
      }),
    },
    {
      path: "/settings",
      label: "Settings",
      icon: Settings,
      visible: hasAccess({
        role,
        clinicSettings,
        access: {
          roles: ["admin"],
        },
      }),
    },
  ].filter((page) => page.visible);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchPatients = useCallback(async (q: string) => {
    if (q.length < 2) {
      setPatients([]);
      return;
    }
    const res = await fetch(`/api/search/patients?q=${encodeURIComponent(q)}&limit=5`);
    if (res.ok) {
      setPatients(await res.json());
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchPatients(query), 200);
    return () => clearTimeout(timer);
  }, [query, searchPatients]);

  function navigate(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search patients, navigate..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {patients.length > 0 && (
          <CommandGroup heading="Patients">
            {patients.map((p) => (
              <CommandItem key={p.id} onSelect={() => navigate(`/patients/${p.id}`)}>
                <Users className="mr-2 h-4 w-4" />
                <span>{p.full_name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{p.mrn}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem key={page.path} onSelect={() => navigate(page.path)}>
              <page.icon className="mr-2 h-4 w-4" />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
