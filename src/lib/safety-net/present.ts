import type { PatientLanguage } from "../care-loop/catalogue.ts";
import {
  CAUSE_LEVEL_LABELS,
  getQuestion,
  OPENER_LABELS,
  OPENER_VALUES,
  type CauseLevel,
  type OpenerValue,
  type Protocol,
  type Route,
} from "./protocols.ts";
import { CONFIDENCE_ID, OPENER_ID, type DifferentialEntry } from "./workflow.ts";

// How a follow-up's answers are shown to staff (and described to Claude):
// each question as the patient saw it, their answer, and an English gloss when
// they answered in Malay. Button answers only: typed messages are shown as written.

const OPENER_TEXT: Record<PatientLanguage, string> = {
  en: "How are you feeling since the visit?",
  ms: "Bagaimana keadaan anda sejak lawatan?",
};

export type AnswerRow = {
  questionId: string;
  asked: string;
  answer: string;
  /** English version when the patient answered in Malay. */
  gloss: { asked: string; answer: string } | null;
  route: Route | null;
};

/**
 * Answers in the order the patient gave them. Stored answers are a JSON object
 * whose key order the database doesn't keep, so the order comes from the
 * conversation (the patient's button replies, oldest first).
 */
export function orderedAnswers(answers: Record<string, string>, order: string[] = []): Array<[string, string]> {
  const rank = (id: string) => {
    const index = order.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return Object.entries(answers).sort(([left], [right]) => rank(left) - rank(right));
}

export function answerRows(
  protocol: Protocol,
  answers: Record<string, string>,
  language: PatientLanguage,
  order: string[] = []
): AnswerRow[] {
  return orderedAnswers(answers, order).map(([questionId, value]) => {
    if (questionId === OPENER_ID) {
      const known = (OPENER_VALUES as readonly string[]).includes(value);
      const label = known ? OPENER_LABELS[value as OpenerValue] : { en: value, ms: value };
      return {
        questionId,
        asked: OPENER_TEXT[language],
        answer: label[language],
        gloss: language === "en" ? null : { asked: OPENER_TEXT.en, answer: label.en },
        route: known ? protocol.openerRoutes[value as OpenerValue] : null,
      };
    }
    const question = getQuestion(protocol, questionId);
    const option = question?.options.find((item) => item.value === value);
    return {
      questionId,
      asked: question?.text[language] ?? questionId,
      answer: option?.label[language] ?? value,
      gloss: language === "en" || !question ? null : { asked: question.text.en, answer: option?.label.en ?? value },
      route: option?.route ?? null,
    };
  });
}

export type CauseRow = {
  cause: string;
  label: string;
  initial: CauseLevel;
  level: CauseLevel;
  /** The question that tested this cause and the answer, in English. */
  tested: { question: string; answer: string; order: number } | null;
  /** Why it wasn't tested, when it wasn't. */
  untested: "skipped" | "not_reached" | null;
};

/** The "how the answers narrowed it" rows: one per possible cause. */
export function causeRows(
  protocol: Protocol,
  differential: DifferentialEntry[],
  pool: string[],
  answers: Record<string, string>,
  complete: boolean,
  order: string[] = []
): CauseRow[] {
  const answerOrder = orderedAnswers(answers, order)
    .map(([id]) => id)
    .filter((id) => id !== OPENER_ID && id !== CONFIDENCE_ID);
  return differential.map((entry) => {
    const cause = protocol.causes.find((item) => item.id === entry.cause);
    const question = entry.questionId ? getQuestion(protocol, entry.questionId) : null;
    const option = question?.options.find((item) => item.value === entry.value);
    const testable = pool.some((id) => !!getQuestion(protocol, id)?.tests?.[entry.cause]);
    return {
      cause: entry.cause,
      label: cause?.label ?? entry.cause,
      initial: entry.initial,
      level: entry.level,
      tested: question
        ? {
            question: question.text.en,
            answer: option?.label.en ?? entry.value ?? "",
            order: answerOrder.indexOf(question.id) + 1,
          }
        : null,
      untested: question ? null : complete || !testable ? "skipped" : "not_reached",
    };
  });
}

/** Questions in the pool the patient was never asked (they wouldn't have changed the plan). */
export function skippedQuestions(protocol: Protocol, pool: string[], answers: Record<string, string>) {
  return pool
    .filter((id) => !(id in answers))
    .map((id) => getQuestion(protocol, id)?.text.en ?? id);
}

export function levelLabel(level: CauseLevel) {
  return CAUSE_LEVEL_LABELS[level];
}
