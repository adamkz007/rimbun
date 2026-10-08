import { getRegion } from "./anatomy.ts";
import type { Assessment, FollowUps, ValidAnswers } from "./schema.ts";

// Canned responses for local development (DIAGNOSE_FAKE_AI=1, never in
// production) so the UI can be exercised without spending API credit.

export function fakeFollowUps(answers: ValidAnswers): FollowUps {
  return {
    questions: [
      {
        id: "previous_episodes",
        text: `Have you had this kind of ${getRegion(answers.region)?.label.toLowerCase()} pain before?`,
        options: ["Never", "Once or twice", "Often"],
        allowFreeText: false,
      },
      {
        id: "medicine_tried",
        text: "Have you taken anything for it yet?",
        options: ["Nothing", "Paracetamol", "Ibuprofen", "Something else"],
        allowFreeText: true,
      },
    ],
  };
}

export function fakeAssessment(answers: ValidAnswers): Assessment {
  const region = getRegion(answers.region);
  const structures = region?.structures.slice(0, 2) ?? [];
  return {
    urgency: answers.severity >= 8 ? "urgent" : "see_gp",
    urgencyReason: "This is placeholder output from the development stub.",
    summary: `You described ${answers.severity}/10 pain in your ${region?.label.toLowerCase()}. (Development stub, not real AI output.)`,
    differentials: [
      { condition: "Muscle strain", likelihood: "more_likely", why: "Stub reasoning based on your answers." },
      { condition: "Inflammation of the area", likelihood: "possible", why: "Stub reasoning based on your answers." },
    ],
    painExplanation: {
      source: "Pain receptors (nociceptors) in the irritated tissue react to inflammation chemicals.",
      signal: "Their signal travels along a nerve into the spinal cord, then crosses over and heads upward.",
      brain: "The thalamus relays it to the sensory cortex, which tells you where it hurts and how much.",
      referred: answers.region === "chest" ? "Heart and arm nerves share spinal segments, so heart pain can be felt in the left arm." : "",
    },
    focusStructures: structures,
    referredTo: answers.region === "chest" ? ["left_arm", "jaw"] : [],
    medications: [
      { name: "Paracetamol", kind: "otc", purpose: "Eases mild to moderate pain.", cautions: "Don't exceed the label dose; avoid with liver disease." },
      { name: "Stronger anti-inflammatories", kind: "doctor_may_prescribe", purpose: "For persistent inflammation.", cautions: "Needs a doctor's review first." },
    ],
    selfCare: ["Rest the area", "Apply a cold pack for 15 minutes at a time"],
    seeDoctorIf: ["The pain gets worse", "You develop a fever"],
  };
}
