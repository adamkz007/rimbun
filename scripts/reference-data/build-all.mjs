import { buildIcd10Rows, ICD10_SOURCE_URL } from "./build-icd10.mjs";
import { buildDrugRows, DRUG_SOURCE_URL } from "./build-drugs.mjs";
import { writeManifestFile, writeReferenceSeedFile } from "./lib.mjs";

async function main() {
  const [icd10Rows, drugRows] = await Promise.all([buildIcd10Rows(), buildDrugRows()]);

  const manifest = {
    generatedAt: new Date().toISOString(),
    icd10: {
      sourceUrl: ICD10_SOURCE_URL,
      rowCount: icd10Rows.length,
    },
    drugs: {
      sourceUrl: DRUG_SOURCE_URL,
      rowCount: drugRows.length,
    },
  };

  await writeReferenceSeedFile({
    icd10Rows,
    drugRows,
    metadata: manifest,
  });
  await writeManifestFile(manifest);

  process.stdout.write(
    `Generated reference-data seed with ${icd10Rows.length} ICD-10 rows and ${drugRows.length} drug rows.\n`
  );
}

await main();
