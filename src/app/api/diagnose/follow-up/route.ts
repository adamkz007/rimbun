import { handleDiagnoseRequest } from "@/lib/diagnose/handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleDiagnoseRequest(request, "follow_up");
}
