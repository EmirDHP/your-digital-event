import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const eventsBuilder = path.join(scriptDirectory, "build-events.mjs");
const generatedRoot = path.join(projectRoot, "dist");
const outputRoot = path.join(projectRoot, "site-dist");
const temporaryRoot = path.join(projectRoot, `.site-dist-build-${process.pid}`);
const previousRoot = path.join(projectRoot, `.site-dist-previous-${process.pid}`);
const minimumNodeVersion = [18, 18, 0];

const rootPublicFiles = [
  "index.html",
  "bodas.html",
  "xv.html",
  "eventos.html",
  "catalog.json",
  "home.css",
  "home.js",
  "site.css",
  "site.js",
  "category.css",
  "category.js",
  "CNAME",
];

const publicExtensions = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".avif",
  ".ico",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".woff",
  ".woff2",
  ".ttf",
]);

const ignoredTemplateExtensions = new Set([".md"]);
const allowedExternalProtocols = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
  "data:",
  "blob:",
]);

let rewrittenDemoReferences = 0;
const omittedMissingDemoHeroImages = [];

function compareVersions(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function assertSupportedNode() {
  const current = process.versions.node.split(".").map(Number);
  if (compareVersions(current, minimumNodeVersion) < 0) {
    throw new Error(
      `Node.js ${minimumNodeVersion.join(".")} o superior es obligatorio. ` +
        `Versión detectada: ${process.versions.node}.`,
    );
  }
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertManagedPath(candidate) {
  const resolved = path.resolve(candidate);
  const allowed = new Set([
    path.resolve(outputRoot),
    path.resolve(temporaryRoot),
    path.resolve(previousRoot),
  ]);

  if (!allowed.has(resolved) || path.dirname(resolved) !== projectRoot) {
    throw new Error(`Se rechazó una operación destructiva fuera del área administrada: ${resolved}`);
  }
}

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function removeManagedDirectory(candidate) {
  assertManagedPath(candidate);
  await rm(candidate, { recursive: true, force: true });
}

async function assertNoSymlink(candidate, label) {
  const info = await lstat(candidate);
  if (info.isSymbolicLink()) {
    throw new Error(`No se permiten enlaces simbólicos en la salida pública: ${label}`);
  }
  return info;
}

function assertPublicExtension(source, mode) {
  const extension = path.extname(source).toLowerCase();
  if (publicExtensions.has(extension)) return true;
  if (mode === "templates" && ignoredTemplateExtensions.has(extension)) return false;
  throw new Error(`Tipo de archivo no permitido en la salida pública: ${path.relative(projectRoot, source)}`);
}

function rewriteDemoDependencyPaths(content) {
  const replacements = [
    ["../../../src/invitation/core/", "../../../shared/invitation/runtime/core/"],
    ["../../../src/invitation/sections/", "../../../shared/invitation/runtime/sections/"],
    ["../../../src/invitation/themes/", "../../../shared/invitation/themes/"],
  ];

  let result = content;
  for (const [source, destination] of replacements) {
    const occurrences = result.split(source).length - 1;
    if (occurrences > 0) {
      rewrittenDemoReferences += occurrences;
      result = result.split(source).join(destination);
    }
  }
  return result;
}

async function copyPublicTree(source, destination, mode) {
  const sourceInfo = await assertNoSymlink(source, path.relative(projectRoot, source));
  if (!sourceInfo.isDirectory()) {
    throw new Error(`Se esperaba un directorio: ${path.relative(projectRoot, source)}`);
  }

  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    const relativeSource = path.relative(projectRoot, sourcePath);

    if (entry.isSymbolicLink()) {
      throw new Error(`No se permiten enlaces simbólicos en la salida pública: ${relativeSource}`);
    }

    if (entry.isDirectory()) {
      await copyPublicTree(sourcePath, destinationPath, mode);
      continue;
    }

    if (!entry.isFile()) {
      throw new Error(`Tipo de entrada no compatible: ${relativeSource}`);
    }

    if (!assertPublicExtension(sourcePath, mode)) continue;

    const extension = path.extname(sourcePath).toLowerCase();
    if (mode === "templates" && (extension === ".html" || extension === ".js")) {
      const content = await readFile(sourcePath, "utf8");
      await writeFile(destinationPath, rewriteDemoDependencyPaths(content), "utf8");
    } else if (mode === "templates" && extension === ".json") {
      const content = await readFile(sourcePath, "utf8");
      const document = JSON.parse(content);
      if (
        document &&
        typeof document === "object" &&
        typeof document.heroImage === "string" &&
        document.heroImage.trim() &&
        !/^[a-z][a-z0-9+.-]*:/i.test(document.heroImage)
      ) {
        const heroPath = path.resolve(
          path.dirname(sourcePath),
          document.heroImage.replaceAll("/", path.sep),
        );
        if (!isInside(source, heroPath)) {
          throw new Error(`${relativeSource}: heroImage intenta salir de la demo.`);
        }
        if (!(await pathExists(heroPath))) {
          omittedMissingDemoHeroImages.push(
            `${relativeSource} -> ${document.heroImage}`,
          );
          document.heroImage = "";
          await writeFile(destinationPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
          continue;
        }
      }
      await copyFile(sourcePath, destinationPath);
    } else {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

async function runEventsBuild() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [eventsBuilder], {
      cwd: projectRoot,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          signal
            ? `El generador de eventos terminó por la señal ${signal}.`
            : `El generador de eventos terminó con código ${code}.`,
        ),
      );
    });
  });
}

async function copyRootPublicFiles(destination) {
  for (const relativePath of rootPublicFiles) {
    const source = path.join(projectRoot, relativePath);
    const target = path.join(destination, relativePath);
    const info = await assertNoSymlink(source, relativePath);
    if (!info.isFile()) {
      throw new Error(`Archivo público obligatorio ausente: ${relativePath}`);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
}

function extractReferences(content, extension) {
  const references = [];
  const collect = (expression) => {
    let match;
    while ((match = expression.exec(content)) !== null) {
      references.push(match[1].trim());
    }
  };

  if (extension === ".html") {
    collect(/\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi);
    let srcsetMatch;
    const srcsetExpression = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
    while ((srcsetMatch = srcsetExpression.exec(content)) !== null) {
      references.push(
        ...srcsetMatch[1]
          .split(",")
          .map((candidate) => candidate.trim().split(/\s+/)[0])
          .filter(Boolean),
      );
    }
  }

  if (extension === ".css") {
    collect(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
    collect(/@import\s+(?:url\(\s*)?["']([^"']+)["']/gi);
  }

  if (extension === ".js" || extension === ".mjs") {
    collect(/\b(?:import|fetch)\s*\(\s*["']([^"']+)["']/g);
    collect(/\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g);
  }

  return references;
}

function classifyReference(rawReference) {
  const reference = rawReference.trim();
  if (!reference || reference === "#") return { type: "skip" };

  if (reference.startsWith("#")) {
    return { type: "anchor", fragment: reference.slice(1) };
  }

  if (reference.startsWith("//")) {
    return { type: "external" };
  }

  const protocolMatch = reference.match(/^([a-z][a-z0-9+.-]*:)/i);
  if (protocolMatch) {
    const protocol = protocolMatch[1].toLowerCase();
    if (!allowedExternalProtocols.has(protocol)) {
      return { type: "error", message: `protocolo no permitido (${protocol})` };
    }
    return { type: "external" };
  }

  if (/^[a-zA-Z]:[\\/]/.test(reference) || reference.startsWith("/") || reference.startsWith("\\")) {
    return { type: "error", message: "ruta local absoluta no permitida" };
  }

  const hashIndex = reference.indexOf("#");
  const queryIndex = reference.indexOf("?");
  const cutIndexes = [hashIndex, queryIndex].filter((index) => index >= 0);
  const pathEnd = cutIndexes.length ? Math.min(...cutIndexes) : reference.length;
  const pathname = reference.slice(0, pathEnd);
  const fragment = hashIndex >= 0 ? reference.slice(hashIndex + 1) : "";

  return { type: "local", pathname, fragment };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function assertHtmlAnchor(targetPath, fragment, sourceLabel) {
  if (!fragment) return;
  let decodedFragment;
  try {
    decodedFragment = decodeURIComponent(fragment);
  } catch {
    throw new Error(`${sourceLabel}: fragmento URL inválido "${fragment}".`);
  }

  const targetInfo = await stat(targetPath);
  if (!targetInfo.isFile() || path.extname(targetPath).toLowerCase() !== ".html") return;
  const content = await readFile(targetPath, "utf8");
  const anchorExpression = new RegExp(
    `\\b(?:id|name)\\s*=\\s*["']${escapeRegExp(decodedFragment)}["']`,
    "i",
  );
  if (!anchorExpression.test(content)) {
    throw new Error(`${sourceLabel}: el ancla #${decodedFragment} no existe en la página destino.`);
  }
}

async function validateReference(reference, sourcePath, artifactRoot) {
  const sourceLabel = path.relative(artifactRoot, sourcePath);
  const classified = classifyReference(reference);

  if (classified.type === "skip" || classified.type === "external") return;
  if (classified.type === "error") {
    throw new Error(`${sourceLabel}: ${classified.message}: "${reference}".`);
  }

  if (classified.type === "anchor") {
    await assertHtmlAnchor(sourcePath, classified.fragment, sourceLabel);
    return;
  }

  if (!classified.pathname) {
    await assertHtmlAnchor(sourcePath, classified.fragment, sourceLabel);
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(classified.pathname);
  } catch {
    throw new Error(`${sourceLabel}: ruta URL inválida "${reference}".`);
  }

  const normalizedPath = decodedPath.replaceAll("/", path.sep);
  const targetPath = path.resolve(path.dirname(sourcePath), normalizedPath);
  if (!isInside(artifactRoot, targetPath)) {
    throw new Error(`${sourceLabel}: traversal fuera de la salida pública: "${reference}".`);
  }

  if (!(await pathExists(targetPath))) {
    throw new Error(
      `${sourceLabel}: recurso local inexistente "${reference}" ` +
        `(resuelto como ${path.relative(artifactRoot, targetPath)}).`,
    );
  }

  await assertNoSymlink(targetPath, path.relative(artifactRoot, targetPath));
  await assertHtmlAnchor(targetPath, classified.fragment, sourceLabel);
}

async function walkFiles(root) {
  const files = [];
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(
          `No se permiten enlaces simbólicos en la salida pública: ${path.relative(root, candidate)}`,
        );
      }
      if (entry.isDirectory()) {
        await visit(candidate);
      } else if (entry.isFile()) {
        files.push(candidate);
      } else {
        throw new Error(`Entrada no compatible: ${path.relative(root, candidate)}`);
      }
    }
  };

  await visit(root);
  return files;
}

async function validateTextReferences(artifactRoot, files) {
  const inspectableExtensions = new Set([".html", ".css", ".js", ".mjs"]);
  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (!inspectableExtensions.has(extension)) continue;
    const content = await readFile(file, "utf8");
    const references = extractReferences(content, extension);
    for (const reference of references) {
      await validateReference(reference, file, artifactRoot);
    }
  }
}

function collectJsonResourceReferences(value, output = []) {
  if (typeof value === "string") {
    if (
      /\.(?:html?|css|m?js|json|jpe?g|png|webp|gif|svg|avif|ico|mp3|wav|ogg|m4a|woff2?|ttf)(?:[?#].*)?$/i.test(
        value,
      )
    ) {
      output.push(value);
    }
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectJsonResourceReferences(item, output);
    return output;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectJsonResourceReferences(item, output);
  }
  return output;
}

async function validateJsonReferences(artifactRoot, files) {
  for (const file of files) {
    if (path.extname(file).toLowerCase() !== ".json") continue;
    let document;
    try {
      document = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      throw new Error(`${path.relative(artifactRoot, file)}: JSON inválido (${error.message}).`);
    }
    for (const reference of collectJsonResourceReferences(document)) {
      await validateReference(reference, file, artifactRoot);
    }
  }
}

async function validateCatalog(artifactRoot) {
  const catalogPath = path.join(artifactRoot, "catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const items = Array.isArray(catalog) ? catalog : catalog?.items;
  if (!Array.isArray(items)) {
    throw new Error("catalog.json debe contener una lista de templates en items.");
  }

  for (const item of items) {
    const label = item?.id || item?.name || "registro sin identificador";
    for (const field of ["cover", "demoUrl"]) {
      if (typeof item?.[field] !== "string" || !item[field].trim()) {
        throw new Error(`catalog.json: ${label} no declara ${field}.`);
      }
      await validateReference(item[field], catalogPath, artifactRoot);
    }
  }
}

async function validateEvents(artifactRoot) {
  const eventsRoot = path.join(artifactRoot, "events");
  const entries = await readdir(eventsRoot, { withFileTypes: true });
  const eventNames = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error(`Entrada inválida dentro de events/: ${entry.name}`);
    }
    const eventRoot = path.join(eventsRoot, entry.name);
    const indexPath = path.join(eventRoot, "index.html");
    if (!(await pathExists(indexPath))) {
      throw new Error(`El evento generado ${entry.name} no contiene index.html.`);
    }
    const children = await readdir(eventRoot, { withFileTypes: true });
    for (const child of children) {
      if (child.name !== "index.html" && child.name !== "assets") {
        throw new Error(
          `El evento publicado ${entry.name} contiene una fuente no permitida: ${child.name}`,
        );
      }
    }
    eventNames.push(entry.name);
  }

  if (eventNames.length === 0) {
    throw new Error("No se generó ningún evento publicable.");
  }
  return eventNames.sort();
}

async function validateArtifact(artifactRoot) {
  const requiredPaths = [
    "index.html",
    "bodas.html",
    "xv.html",
    "eventos.html",
    "catalog.json",
    "assets",
    "templates",
    "shared/invitation",
    "events",
    ".nojekyll",
    "CNAME",
  ];

  for (const relativePath of requiredPaths) {
    if (!(await pathExists(path.join(artifactRoot, relativePath)))) {
      throw new Error(`La salida publicable no contiene ${relativePath}.`);
    }
  }

  for (const forbidden of [
    ".git",
    ".github",
    "node_modules",
    "scripts",
    "schemas",
    "src",
    ".migration-backups",
    ".migration-staging",
  ]) {
    if (await pathExists(path.join(artifactRoot, forbidden))) {
      throw new Error(`La salida publicable contiene una fuente privada: ${forbidden}`);
    }
  }

  const sourceCname = await readFile(path.join(projectRoot, "CNAME"), "utf8");
  const outputCname = await readFile(path.join(artifactRoot, "CNAME"), "utf8");
  if (sourceCname !== outputCname) {
    throw new Error("El CNAME de la salida no coincide exactamente con el archivo fuente.");
  }

  const files = await walkFiles(artifactRoot);
  await validateTextReferences(artifactRoot, files);
  await validateJsonReferences(artifactRoot, files);
  await validateCatalog(artifactRoot);

  const sourceLeakFiles = [];
  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (!new Set([".html", ".js", ".mjs", ".css"]).has(extension)) continue;
    const content = await readFile(file, "utf8");
    if (content.includes("src/invitation")) {
      sourceLeakFiles.push(path.relative(artifactRoot, file));
    }
  }
  if (sourceLeakFiles.length > 0) {
    throw new Error(
      `Las demos todavía referencian src/invitation/: ${sourceLeakFiles.join(", ")}`,
    );
  }

  const eventNames = await validateEvents(artifactRoot);
  let bytes = 0;
  for (const file of files) bytes += (await stat(file)).size;
  return { files: files.length, bytes, eventNames };
}

async function replaceOutput() {
  assertManagedPath(outputRoot);
  assertManagedPath(temporaryRoot);
  assertManagedPath(previousRoot);

  const hadPreviousOutput = await pathExists(outputRoot);
  if (hadPreviousOutput) {
    await rename(outputRoot, previousRoot);
  }

  try {
    await rename(temporaryRoot, outputRoot);
    if (hadPreviousOutput) await removeManagedDirectory(previousRoot);
  } catch (error) {
    if (await pathExists(outputRoot)) await removeManagedDirectory(outputRoot);
    if (hadPreviousOutput && (await pathExists(previousRoot))) {
      await rename(previousRoot, outputRoot);
    }
    throw error;
  }
}

async function main() {
  assertSupportedNode();
  await removeManagedDirectory(temporaryRoot);
  await removeManagedDirectory(previousRoot);

  console.log(`Node.js ${process.versions.node}: versión compatible.`);
  console.log("Generando eventos con scripts/build-events.mjs...");
  await runEventsBuild();

  if (!(await pathExists(path.join(generatedRoot, "shared")))) {
    throw new Error("El build de eventos no generó dist/shared/.");
  }
  if (!(await pathExists(path.join(generatedRoot, "events")))) {
    throw new Error("El build de eventos no generó dist/events/.");
  }

  console.log("Ensamblando la salida pública temporal...");
  await mkdir(temporaryRoot, { recursive: true });
  await copyRootPublicFiles(temporaryRoot);
  await copyPublicTree(path.join(projectRoot, "assets"), path.join(temporaryRoot, "assets"), "assets");
  await copyPublicTree(
    path.join(projectRoot, "templates"),
    path.join(temporaryRoot, "templates"),
    "templates",
  );
  await copyPublicTree(
    path.join(generatedRoot, "shared"),
    path.join(temporaryRoot, "shared"),
    "generated",
  );
  await copyPublicTree(
    path.join(generatedRoot, "events"),
    path.join(temporaryRoot, "events"),
    "generated",
  );
  await writeFile(path.join(temporaryRoot, ".nojekyll"), "", "utf8");

  console.log("Validando rutas y contenido del artefacto...");
  const summary = await validateArtifact(temporaryRoot);
  await replaceOutput();

  console.log("");
  console.log("Build del sitio completado.");
  console.log(`Salida: ${path.relative(projectRoot, outputRoot)}/`);
  console.log(`Archivos: ${summary.files}`);
  console.log(`Tamaño: ${(summary.bytes / 1024 / 1024).toFixed(2)} MiB`);
  console.log(`Eventos: ${summary.eventNames.join(", ")}`);
  console.log(`Referencias de demos dirigidas a shared/: ${rewrittenDemoReferences}`);
  if (omittedMissingDemoHeroImages.length > 0) {
    console.log("Referencias heroImage opcionales omitidas por no existir (fallback CSS conservado):");
    for (const item of omittedMissingDemoHeroImages) console.log(`  ${item}`);
  }
  console.log("Rutas principales:");
  console.log("  /");
  console.log("  /bodas.html");
  console.log("  /xv.html");
  console.log("  /eventos.html");
  for (const eventName of summary.eventNames) {
    console.log(`  /events/${eventName}/`);
  }
}

main().catch(async (error) => {
  try {
    if (await pathExists(temporaryRoot)) await removeManagedDirectory(temporaryRoot);
  } catch (cleanupError) {
    console.error(`No se pudo limpiar la salida temporal: ${cleanupError.message}`);
  }
  console.error(`Build del sitio fallido: ${error.message}`);
  process.exitCode = 1;
});
