import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { ASSESS_SYSTEM, describeAnswers, FOLLOW_UP_SYSTEM } from "./prompts.ts";
import {
  assessmentSchema,
  followUpsSchema,
  trimAssessment,
  trimFollowUps,
  type Assessment,
  type FollowUps,
  type ValidAnswers,
} from "./schema.ts";
import { fakeAssessment, fakeFollowUps } from "./fake-ai.ts";

export const DIAGNOSE_MODEL = "claude-sonnet-5-5";

export class DiagnoseAiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new DiagnoseAiError("The AI service is not configured.", 503);
  }
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
  return client;
}

export function isFakeAiEnabled() {
  return process.env.DIAGNOSE_FAKE_AI === "1" && process.env.NODE_ENV !== "production";
}

async function generate<T>(
  system: string,
  answers: ValidAnswers,
  schema: z.ZodType<T>,
  effort: "low" | "medium",
  maxTokens: number
): Promise<T> {
  try {
    const response = await getClient().beta.messages.parse({
      model: DIAGNOSE_MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      output_config: { effort, format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: describeAnswers(answers) }],
    });

    if (response.stop_reason === "refusal") {
      throw new DiagnoseAiError("The AI could not answer this one. Please speak to a doctor or pharmacist.", 422);
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      throw new DiagnoseAiError("The AI response was incomplete. Please try again.", 502);
    }
    return response.parsed_output as T;
  } catch (error) {
    if (error instanceof DiagnoseAiError) throw error;
    if (error instanceof Anthropic.RateLimitError) {
      throw new DiagnoseAiError("The AI service is busy right now. Please try again in a minute.", 503);
    }
    if (error instanceof Anthropic.APIError) {
      console.error("diagnose: Anthropic API error", error.status, error.message);
      throw new DiagnoseAiError("The AI service is unavailable right now. Please try again later.", 502);
    }
    console.error("diagnose: unexpected AI error", error);
    throw new DiagnoseAiError("Something went wrong while generating the answer.", 500);
  }
}

export async function generateFollowUps(answers: ValidAnswers): Promise<FollowUps> {
  if (isFakeAiEnabled()) return fakeFollowUps(answers);
  const result = await generate(FOLLOW_UP_SYSTEM, answers, followUpsSchema, "low", 4000);
  return trimFollowUps(result);
}

export async function generateAssessment(answers: ValidAnswers): Promise<Assessment> {
  if (isFakeAiEnabled()) return fakeAssessment(answers);
  const result = await generate(ASSESS_SYSTEM, answers, assessmentSchema, "medium", 12000);
  return trimAssessment(result);
}
