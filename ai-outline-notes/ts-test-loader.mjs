import { readFile } from "node:fs/promises";
import ts from "typescript";

const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  jsx: ts.JsxEmit.ReactJSX,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
};

export async function load(url, context, defaultLoad) {
  if (!url.startsWith("file:") || !url.endsWith(".ts")) {
    return defaultLoad(url, context, defaultLoad);
  }

  const fileUrl = new URL(url);
  const source = await readFile(fileUrl, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions,
    fileName: fileUrl.pathname,
  });

  return {
    format: "module",
    source: transpiled.outputText,
    shortCircuit: true,
  };
}

export async function resolve(specifier, context, defaultResolve) {
  if (
    specifier.startsWith("node:") ||
    specifier.startsWith("data:") ||
    specifier.startsWith("file:")
  ) {
    return defaultResolve(specifier, context, defaultResolve);
  }

  if (specifier.endsWith(".ts")) {
    const resolved = await defaultResolve(specifier, context, defaultResolve);
    return { ...resolved, url: resolved.url }; // ensure URL returned
  }

  if (
    (specifier.startsWith(".") || specifier.startsWith("/")) &&
    !specifier.endsWith(".js") &&
    !specifier.endsWith(".json")
  ) {
    try {
      const tsSpecifier = `${specifier}.ts`;
      const resolved = await defaultResolve(
        tsSpecifier,
        context,
        defaultResolve,
      );
      return resolved;
    } catch {
      // fallback to default resolution
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
