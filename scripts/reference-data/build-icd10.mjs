import { downloadToTempFile, titleCase, unzipTextFile } from "./lib.mjs";

export const ICD10_SOURCE_URL =
  "https://ftp.cdc.gov/pub/health_statistics/nchs/publications/ICD10CM/2026/icd10cm-Code%20Descriptions-2026.zip";

const ICD10_CHAPTERS = [
  ["A00", "B99", "Certain infectious and parasitic diseases"],
  ["C00", "D49", "Neoplasms"],
  ["D50", "D89", "Diseases of the blood and immune mechanism"],
  ["E00", "E89", "Endocrine, nutritional and metabolic diseases"],
  ["F01", "F99", "Mental, behavioral and neurodevelopmental disorders"],
  ["G00", "G99", "Diseases of the nervous system"],
  ["H00", "H59", "Diseases of the eye and adnexa"],
  ["H60", "H95", "Diseases of the ear and mastoid process"],
  ["I00", "I99", "Diseases of the circulatory system"],
  ["J00", "J99", "Diseases of the respiratory system"],
  ["K00", "K95", "Diseases of the digestive system"],
  ["L00", "L99", "Diseases of the skin and subcutaneous tissue"],
  ["M00", "M99", "Diseases of the musculoskeletal system and connective tissue"],
  ["N00", "N99", "Diseases of the genitourinary system"],
  ["O00", "O9A", "Pregnancy, childbirth and the puerperium"],
  ["P00", "P96", "Certain conditions originating in the perinatal period"],
  ["Q00", "Q99", "Congenital malformations and chromosomal abnormalities"],
  ["R00", "R99", "Symptoms, signs and abnormal clinical findings"],
  ["S00", "T88", "Injury, poisoning and other external causes"],
  ["V00", "Y99", "External causes of morbidity"],
  ["Z00", "Z99", "Factors influencing health status and contact with health services"],
];

function normalizeChapterCode(code) {
  return code.replace(".", "").slice(0, 3).padEnd(3, "0");
}

function resolveIcd10Chapter(code) {
  const normalizedCode = normalizeChapterCode(code);

  for (const [start, end, chapter] of ICD10_CHAPTERS) {
    if (normalizedCode >= start && normalizedCode <= end) {
      return chapter;
    }
  }

  return "Other";
}

function formatIcd10Code(code) {
  const normalizedCode = code.replace(".", "");
  return normalizedCode.length > 3
    ? `${normalizedCode.slice(0, 3)}.${normalizedCode.slice(3)}`
    : normalizedCode;
}

function parseIcd10OrderLine(line) {
  const code = formatIcd10Code(line.slice(6, 13).trim());
  const headerFlag = line.slice(14, 15).trim();
  const longDescription = line.slice(77).trim();

  if (!code || headerFlag !== "1" || !longDescription) {
    return null;
  }

  return {
    code,
    description: titleCase(longDescription),
    category: resolveIcd10Chapter(code),
  };
}

export async function buildIcd10Rows() {
  const zipPath = await downloadToTempFile(ICD10_SOURCE_URL, "rimbun-icd10cm-2026.zip");
  const rawText = await unzipTextFile(zipPath, /icd10cm-order-\d{4}\.txt$/i);
  const rows = [];
  const seenCodes = new Set();

  for (const line of rawText.split("\n")) {
    const parsedRow = parseIcd10OrderLine(line);

    if (!parsedRow || seenCodes.has(parsedRow.code)) {
      continue;
    }

    seenCodes.add(parsedRow.code);
    rows.push(parsedRow);
  }

  rows.sort((left, right) => left.code.localeCompare(right.code));
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await buildIcd10Rows();
  process.stdout.write(`${JSON.stringify({ sourceUrl: ICD10_SOURCE_URL, rowCount: rows.length })}\n`);
}
