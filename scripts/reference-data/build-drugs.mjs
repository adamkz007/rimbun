import fs from "node:fs/promises";
import { downloadToTempFile, normalizeWhitespace, parseCsv, titleCase } from "./lib.mjs";

export const DRUG_SOURCE_URL =
  "https://storage.data.gov.my/healthcare/pharmaceutical_products.csv";

const HUMAN_DRUG_DESCRIPTIONS = new Set([
  "PRESCRIPTION",
  "NON PRESCRIPTION",
  "NEW CHEMICAL ENTITY",
  "BIOLOGICS",
]);

const FORMULATION_PATTERNS = [
  "Extended Release Tablet",
  "Modified Release Tablet",
  "Film Coated Tablet",
  "Enteric Coated Tablet",
  "Dispersible Tablet",
  "Chewable Tablet",
  "Effervescent Tablet",
  "Prolonged Release Capsule",
  "Hard Capsule",
  "Soft Capsule",
  "Powder For Injection",
  "Solution For Injection",
  "Suspension For Injection",
  "Eye Drops",
  "Ear Drops",
  "Nasal Spray",
  "Metered Dose Inhaler",
  "Nebuliser Solution",
  "Oral Suspension",
  "Oral Solution",
  "Oral Liquid",
  "Tablet",
  "Capsule",
  "Caplet",
  "Syrup",
  "Injection",
  "Suspension",
  "Solution",
  "Cream",
  "Ointment",
  "Lotion",
  "Gel",
  "Patch",
  "Suppository",
  "Drops",
  "Inhaler",
  "Spray",
  "Sachet",
  "Powder",
  "Lozenge",
  "Granules",
];

const CONTROLLED_SUBSTANCE_KEYWORDS = [
  "alprazolam",
  "buprenorphine",
  "clonazepam",
  "codeine",
  "diazepam",
  "fentanyl",
  "lorazepam",
  "methadone",
  "methylphenidate",
  "midazolam",
  "morphine",
  "oxycodone",
  "pethidine",
  "tapentadol",
  "tramadol",
  "zolpidem",
];

function extractStrength(product, activeIngredient) {
  const strengthPattern =
    /\b\d+(?:\.\d+)?\s?(?:mcg|mg|g|kg|iu|units|unit|mmol|mol|ml|l|%)(?:\s*\/\s*\d+(?:\.\d+)?\s?(?:ml|l|g|dose|tab|tablet|capsule|cap|sachet))?\b/gi;

  const productMatch = product.match(strengthPattern);

  if (productMatch?.length) {
    return normalizeWhitespace(productMatch[0].replace(/\s*\/\s*/g, "/"));
  }

  const ingredientMatch = activeIngredient.match(/\[([^\]]+)\]/);

  if (!ingredientMatch) {
    return null;
  }

  const candidate = ingredientMatch[1]
    .split(/[;,]/)
    .map((segment) => normalizeWhitespace(segment))
    .find((segment) => /\d/.test(segment) && /(mcg|mg|g|ml|%|iu|units?)/i.test(segment));

  return candidate ? candidate.replace(/\s*\/\s*/g, "/") : null;
}

function extractFormulation(product) {
  const normalizedProduct = titleCase(product);
  return FORMULATION_PATTERNS.find((pattern) =>
    normalizedProduct.toLowerCase().includes(pattern.toLowerCase())
  ) ?? null;
}

function normalizeBaseProductName(product, formulation, strength) {
  let result = titleCase(product)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ");

  if (strength) {
    result = result.replace(new RegExp(strength.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  }

  if (formulation) {
    result = result.replace(new RegExp(formulation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  }

  result = result.replace(/\b\d+(?:\.\d+)?\b/g, " ");
  result = result.replace(/\b(?:For|And|With)\b\s*$/gi, " ");
  return normalizeWhitespace(result);
}

function deriveGenericName(row, productName) {
  const directGenericName = normalizeWhitespace(row.generic_name || "");

  if (directGenericName) {
    return titleCase(directGenericName);
  }

  const ingredientNames = (row.active_ingredient || "")
    .split(",")
    .map((ingredient) => ingredient.replace(/\[[^\]]*\]/g, " "))
    .map((ingredient) => titleCase(normalizeWhitespace(ingredient)))
    .filter(Boolean);

  if (ingredientNames.length === 0) {
    return null;
  }

  const uniqueIngredients = Array.from(new Set(ingredientNames));
  const combined = uniqueIngredients.slice(0, 3).join(" / ");

  return combined && combined.toLowerCase() !== productName.toLowerCase() ? combined : null;
}

function detectControlledSubstance(text) {
  const normalizedText = text.toLowerCase();
  return CONTROLLED_SUBSTANCE_KEYWORDS.some((keyword) => normalizedText.includes(keyword));
}

function scoreDrugCandidate(row) {
  let score = 0;

  if (row.generic_name) {
    score += 30;
  }

  if (row.description === "PRESCRIPTION" || row.description === "NEW CHEMICAL ENTITY") {
    score += 20;
  }

  if (row.manufacturer) {
    score += 5;
  }

  return score;
}

function toDrugRecord(row) {
  const formulation = extractFormulation(row.product || "");
  const strength = extractStrength(row.product || "", row.active_ingredient || "");
  const productName = normalizeBaseProductName(row.product || "", formulation, strength);
  const genericName = deriveGenericName(row, productName);
  const displayName = genericName ?? productName;

  if (!displayName) {
    return null;
  }

  return {
    name: displayName,
    generic_name: genericName,
    formulation,
    strength,
    manufacturer: normalizeWhitespace(row.manufacturer || "") || null,
    is_controlled: detectControlledSubstance(
      [displayName, genericName, row.active_ingredient || ""].filter(Boolean).join(" ")
    ),
    _score: scoreDrugCandidate(row),
  };
}

export async function buildDrugRows() {
  const csvPath = await downloadToTempFile(DRUG_SOURCE_URL, "rimbun-pharmaceutical-products.csv");
  const rawCsv = await fs.readFile(csvPath, "utf8");
  const sourceRows = parseCsv(rawCsv);
  const dedupedRows = new Map();

  for (const row of sourceRows) {
    if (row.status !== "PRODUCT APPROVED") {
      continue;
    }

    if (!HUMAN_DRUG_DESCRIPTIONS.has(row.description)) {
      continue;
    }

    const candidate = toDrugRecord(row);

    if (!candidate) {
      continue;
    }

    const key = [
      candidate.name.toLowerCase(),
      (candidate.generic_name || "").toLowerCase(),
      (candidate.formulation || "").toLowerCase(),
      (candidate.strength || "").toLowerCase(),
    ].join("|");

    const existing = dedupedRows.get(key);

    if (!existing || candidate._score > existing._score) {
      dedupedRows.set(key, candidate);
    }
  }

  const rows = Array.from(dedupedRows.values())
    .map(({ _score, ...row }) => row)
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name);
      return byName !== 0 ? byName : (left.strength || "").localeCompare(right.strength || "");
    });

  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await buildDrugRows();
  process.stdout.write(`${JSON.stringify({ sourceUrl: DRUG_SOURCE_URL, rowCount: rows.length })}\n`);
}
