"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnquiryBoard, type EnquiryBoardItem } from "@/components/enquiry/enquiry-board";
import { EnquiryReport, type EnquiryReportItem } from "@/components/enquiry/enquiry-report";
import { ReminderPanel, type ReminderPanelItem } from "@/components/enquiry/reminder-panel";

type StaffSummary = {
  id: string;
  full_name: string;
};

type EnquiryWorkspaceProps = {
  enquiries: EnquiryBoardItem[];
  reminders: ReminderPanelItem[];
  staffOptions: StaffSummary[];
  initialTab?: "enquiries" | "reminders" | "reports";
  initialStatus?: EnquiryBoardItem["status"] | "all";
  initialSource?: EnquiryBoardItem["source"] | "all";
  initialQuery?: string;
};

export function EnquiryWorkspace({
  enquiries,
  reminders,
  staffOptions,
  initialTab = "enquiries",
  initialStatus = "all",
  initialSource = "all",
  initialQuery = "",
}: EnquiryWorkspaceProps) {
  const reportItems: EnquiryReportItem[] = enquiries.map((enquiry) => ({
    status: enquiry.status,
    source: enquiry.source,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enquiries</h1>
        <p className="text-sm text-muted-foreground">
          Capture leads, schedule follow-ups, and convert enquiries into registered patients.
        </p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="enquiries">Enquiries</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="enquiries" className="mt-4">
          <EnquiryBoard
            enquiries={enquiries}
            staffOptions={staffOptions}
            initialStatus={initialStatus}
            initialSource={initialSource}
            initialQuery={initialQuery}
          />
        </TabsContent>

        <TabsContent value="reminders" className="mt-4">
          <ReminderPanel reminders={reminders} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <EnquiryReport enquiries={reportItems} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
