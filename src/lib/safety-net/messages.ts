import type { PatientLanguage } from "../care-loop/catalogue.ts";
import type { Protocol } from "./protocols.ts";

// Patient-facing WhatsApp text for safety-net check-ins. All fixed and written
// in advance: nothing here is generated per patient, and nothing here is
// clinical advice beyond "come back" or "go to emergency".

export type MessageContext = {
  clinicName: string;
  patientFirstName: string;
  /** Visit date, already formatted for display. */
  visitDate: string;
};

export function openerText(protocol: Pick<Protocol, "subject">, language: PatientLanguage, ctx: MessageContext) {
  const { clinicName: clinic, patientFirstName: name, visitDate: date } = ctx;
  if (protocol.subject === "child") {
    return language === "ms"
      ? `Salam, ini ${clinic} ingin bertanya khabar tentang ${name} selepas lawatan pada ${date}. Bagaimana keadaan ${name} sekarang?`
      : `Hello, this is ${clinic} checking on ${name} after the visit on ${date}. How is ${name} now?`;
  }
  return language === "ms"
    ? `Salam ${name}, ini ${clinic} ingin bertanya khabar selepas lawatan anda pada ${date}. Bagaimana keadaan anda sekarang?`
    : `Hello ${name}, this is ${clinic} checking on you after your visit on ${date}. How are you feeling now?`;
}

const COPY = {
  intro: {
    en: "Thank you. A few quick questions so the doctor knows how things are going.",
    ms: "Terima kasih. Beberapa soalan ringkas supaya doktor tahu perkembangan anda.",
  },
  red: {
    en: (clinic: string) =>
      `Some of these answers can be warning signs. Please go to the nearest emergency department now, or call 999. We have alerted the doctor at ${clinic}.`,
    ms: (clinic: string) =>
      `Beberapa jawapan ini mungkin tanda amaran. Sila pergi ke jabatan kecemasan terdekat sekarang, atau hubungi 999. Kami telah memaklumkan doktor di ${clinic}.`,
  },
  amber: {
    en: (clinic: string) =>
      `Thank you. A nurse from ${clinic} will call you to check, during clinic opening hours. If things get worse before then, go to the nearest emergency department or call 999.`,
    ms: (clinic: string) =>
      `Terima kasih. Jururawat dari ${clinic} akan menghubungi anda pada waktu klinik dibuka. Jika keadaan bertambah teruk sebelum itu, pergi ke jabatan kecemasan terdekat atau hubungi 999.`,
  },
  green: {
    en: "Good to hear things are improving. If anything changes or new symptoms appear, come back to the clinic, or go to the nearest emergency department if it feels serious.",
    ms: "Baguslah keadaan semakin baik. Jika ada perubahan atau gejala baru, datang semula ke klinik, atau pergi ke jabatan kecemasan terdekat jika ia serius.",
  },
  freeText: {
    en: "Thank you, your message has been passed to the clinic team, who will read it during opening hours. If you feel very unwell, go to the nearest emergency department or call 999.",
    ms: "Terima kasih, mesej anda telah diserahkan kepada pasukan klinik dan akan dibaca pada waktu klinik dibuka. Jika anda berasa sangat tidak sihat, pergi ke jabatan kecemasan terdekat atau hubungi 999.",
  },
} as const;

export function introText(language: PatientLanguage) {
  return COPY.intro[language];
}

export function redFlagText(language: PatientLanguage, clinicName: string) {
  return COPY.red[language](clinicName);
}

export function amberText(language: PatientLanguage, clinicName: string) {
  return COPY.amber[language](clinicName);
}

export function greenText(language: PatientLanguage) {
  return COPY.green[language];
}

export function freeTextAck(language: PatientLanguage) {
  return COPY.freeText[language];
}
