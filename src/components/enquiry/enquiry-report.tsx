"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ENQUIRY_SOURCES,
  ENQUIRY_STATUSES,
  getEnquirySourceLabel,
  getEnquiryStatusLabel,
  summarizeEnquiryReport,
} from "@/lib/enquiry";
import type { EnquirySource, EnquiryStatus } from "@/types/database";

export type EnquiryReportItem = {
  status: EnquiryStatus;
  source: EnquirySource;
};

type EnquiryReportProps = {
  enquiries: EnquiryReportItem[];
};

export function EnquiryReport({ enquiries }: EnquiryReportProps) {
  const report = summarizeEnquiryReport(enquiries);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total enquiries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Converted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.converted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {report.total === 0
                ? "0%"
                : `${Math.round((report.converted / report.total) * 100)}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ENQUIRY_STATUSES.map((status) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span>{getEnquiryStatusLabel(status)}</span>
                <span className="font-medium">{report.byStatus[status]}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ENQUIRY_SOURCES.map((source) => (
              <div key={source} className="flex items-center justify-between text-sm">
                <span>{getEnquirySourceLabel(source)}</span>
                <span className="font-medium">{report.bySource[source]}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
