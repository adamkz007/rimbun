import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const srcPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../src",
      specifier.slice(2)
    );

    for (const extension of ["", ".ts", ".tsx", ".js", ".mjs"]) {
      const candidate =
        extension && !srcPath.endsWith(extension) ? `${srcPath}${extension}` : srcPath;
      if (fs.existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  if (specifier.startsWith(".")) {
    const parentPath = fileURLToPath(context.parentURL);
    const candidate = path.resolve(path.dirname(parentPath), specifier);

    if (!path.extname(candidate)) {
      for (const extension of [".ts", ".tsx", ".js", ".mjs"]) {
        const withExtension = `${candidate}${extension}`;
        if (fs.existsSync(withExtension)) {
          return nextResolve(pathToFileURL(withExtension).href, context);
        }
      }
    }
  }

  return nextResolve(specifier, context);
}
