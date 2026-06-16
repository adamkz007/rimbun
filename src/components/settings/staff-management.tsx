"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ROLES } from "@/lib/constants";
import {
  inviteStaffMember,
  setStaffMemberActive,
  updateStaffMember,
} from "@/lib/actions/staff-actions";
import { toast } from "@/lib/toast";
import type { StaffRole } from "@/types/database";

type StaffListItem = {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  mmc_number: string | null;
  is_active: boolean;
  created_at: string;
};

type StaffManagementProps = {
  currentStaffId: string;
  staffMembers: StaffListItem[];
};

export function StaffManagement({
  currentStaffId,
  staffMembers,
}: StaffManagementProps) {
  const router = useRouter();
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function handleInvite(formData: FormData) {
    const payload = {
      fullName: String(formData.get("full_name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "") as StaffRole,
      mmcNumber: String(formData.get("mmc_number") ?? ""),
    };

    setInviteMessage(null);
    setTemporaryPassword(null);

    startTransition(async () => {
      const result = await inviteStaffMember(payload);
      setInviteMessage(result.message);
      setTemporaryPassword(result.success ? result.temporaryPassword ?? null : null);

      if (result.success) {
        toast.success("Staff member invited", result.message);
        router.refresh();
      } else if (result.message) {
        toast.error("Invite failed", result.message);
      }
    });
  }

  function handleUpdate(staffId: string, formData: FormData) {
    const payload = {
      staffId,
      fullName: String(formData.get("full_name") ?? ""),
      role: String(formData.get("role") ?? "") as StaffRole,
      mmcNumber: String(formData.get("mmc_number") ?? ""),
    };

    setRowMessage((current) => ({ ...current, [staffId]: "" }));

    startTransition(async () => {
      const result = await updateStaffMember(payload);
      setRowMessage((current) => ({ ...current, [staffId]: result.message }));

      if (result.success) {
        toast.success("Staff member updated", result.message);
        router.refresh();
      } else if (result.message) {
        toast.error("Update failed", result.message);
      }
    });
  }

  function handleSetActive(staffId: string, isActive: boolean) {
    setRowMessage((current) => ({ ...current, [staffId]: "" }));

    startTransition(async () => {
      const result = await setStaffMemberActive({ staffId, isActive });
      setRowMessage((current) => ({ ...current, [staffId]: result.message }));

      if (result.success) {
        toast.success(
          isActive ? "Staff member activated" : "Staff member deactivated",
          result.message
        );
        router.refresh();
      } else if (result.message) {
        toast.error("Status update failed", result.message);
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Invite Staff</CardTitle>
          <CardDescription>
            Create a clinic staff login and assign the initial role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleInvite(new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="invite-full-name">Full Name</Label>
              <Input id="invite-full-name" name="full_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                name="role"
                defaultValue="doctor"
                className="h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-mmc-number">MMC Number</Label>
              <Input id="invite-mmc-number" name="mmc_number" />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Creating..." : "Invite Staff Member"}
            </Button>
          </form>

          {inviteMessage ? (
            <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm">
              <p>{inviteMessage}</p>
              {temporaryPassword ? (
                <p className="mt-2 font-medium">
                  Temporary password: <span className="font-mono">{temporaryPassword}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff Directory</CardTitle>
          <CardDescription>
            Update staff roles, maintain clinician details, and activate or
            deactivate access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {staffMembers.map((staffMember) => {
            const isCurrentUser = staffMember.id === currentStaffId;

            return (
              <div key={staffMember.id} className="space-y-4 rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{staffMember.full_name}</p>
                  <Badge variant={staffMember.is_active ? "secondary" : "outline"}>
                    {staffMember.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {staffMember.role}
                  </Badge>
                  {isCurrentUser ? <Badge variant="ghost">You</Badge> : null}
                </div>

                <form
                  className="grid gap-4 md:grid-cols-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleUpdate(staffMember.id, new FormData(event.currentTarget));
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor={`staff-name-${staffMember.id}`}>Full Name</Label>
                    <Input
                      id={`staff-name-${staffMember.id}`}
                      name="full_name"
                      defaultValue={staffMember.full_name}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`staff-email-${staffMember.id}`}>Email</Label>
                    <Input
                      id={`staff-email-${staffMember.id}`}
                      value={staffMember.email}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`staff-role-${staffMember.id}`}>Role</Label>
                    <select
                      id={`staff-role-${staffMember.id}`}
                      name="role"
                      defaultValue={staffMember.role}
                      className="h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
                      disabled={isCurrentUser}
                    >
                      {ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`staff-mmc-${staffMember.id}`}>MMC Number</Label>
                    <Input
                      id={`staff-mmc-${staffMember.id}`}
                      name="mmc_number"
                      defaultValue={staffMember.mmc_number ?? ""}
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <Button type="submit" variant="outline" disabled={isPending}>
                      Save Changes
                    </Button>
                  </div>
                </form>

                <Separator />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {staffMember.email}
                  </div>
                  <Button
                    variant={staffMember.is_active ? "destructive" : "secondary"}
                    disabled={isPending || isCurrentUser}
                    onClick={() => handleSetActive(staffMember.id, !staffMember.is_active)}
                  >
                    {staffMember.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>

                {rowMessage[staffMember.id] ? (
                  <p className="text-sm text-muted-foreground">{rowMessage[staffMember.id]}</p>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
