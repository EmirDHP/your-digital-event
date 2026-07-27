import {
  readFile,
  readdir,
  realpath,
  stat
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { migrateConfig } from "../src/invitation/core/config-migrator.js";
import { validateConfig } from "../src/invitation/core/config-validator.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const eventsRoot = path.join(projectRoot, "events");
const themesRoot = path.join(projectRoot, "src", "invitation", "themes");
const outputRoot = path.join(projectRoot, "dist");
const outputEventsRoot = path.join(outputRoot, "events");
const outputSharedRoot = path.join(outputRoot, "shared", "invitation");
const minimumNodeVersion = [18, 18, 0];

const errors = [];
const warnings = [];

function relativeToProject(filePath){
  return path.relative(projectRoot, filePath).replaceAll("\\", "/") || ".";
}

function addIssue(collection, event, file, problem){
  collection.push({
    event: event || "global",
    file: file ? relativeToProject(file) : "(sin archivo)",
    problem
  });
}

function addError(event, file, problem){
  addIssue(errors, event, file, problem);
}

function addWarning(event, file, problem){
  addIssue(warnings, event, file, problem);
}

function assertSupportedNode(){
  const current = process.versions.node.split(".").map(Number);
  const supported = minimumNodeVersion.every((minimumPart, index) => {
    const previousPartsEqual = minimumNodeVersion
      .slice(0, index)
      .every((part, previousIndex) => part === (current[previousIndex] || 0));
    return !previousPartsEqual || (current[index] || 0) >= minimumPart;
  });

  if (!supported){
    throw new Error(
      `Se requiere Node.js 18.18.0 o superior. Versión detectada: ${process.version}.`
    );
  }
}

function isInside(parent, candidate){
  const relative = path.relative(parent, candidate);
  return relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function getStats(filePath){
  try{
    return await stat(filePath);
  }catch(error){
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function fileExists(filePath){
  return Boolean((await getStats(filePath))?.isFile());
}

async function directoryExists(filePath){
  return Boolean((await getStats(filePath))?.isDirectory());
}

async function readJson(filePath, event, description){
  let source;
  try{
    source = await readFile(filePath, "utf8");
  }catch(error){
    addError(event, filePath, `No se pudo leer ${description}: ${error.code || "error de lectura"}.`);
    return null;
  }

  try{
    return JSON.parse(source);
  }catch{
    addError(event, filePath, `${description} no contiene JSON válido.`);
    return null;
  }
}

async function listDirectories(directory, event, description){
  let entries;
  try{
    entries = await readdir(directory, { withFileTypes: true });
  }catch(error){
    addError(event, directory, `No se pudo leer ${description}: ${error.code || "error de lectura"}.`);
    return [];
  }

  const directories = [];
  for (const entry of entries){
    if (entry.isSymbolicLink()){
      addError(event, path.join(directory, entry.name), "No se permiten enlaces simbólicos.");
    }else if (entry.isDirectory()){
      directories.push(entry.name);
    }
  }
  return directories.sort((left, right) => left.localeCompare(right));
}

function normalizeUrlValue(value){
  return String(value || "")
    .trim()
    .replaceAll("&amp;", "&");
}

function decodePathname(value){
  try{
    return decodeURIComponent(value);
  }catch{
    return null;
  }
}

function classifyReference(rawValue){
  const value = normalizeUrlValue(rawValue);
  if (!value) return { kind: "empty", value };
  if (value.startsWith("#")) return { kind: "fragment", value };
  if (value.startsWith("//")) return { kind: "protocol-relative", value };
  if (/^[\\/]/.test(value) || /^[A-Za-z]:[\\/]/.test(value)){
    return { kind: "absolute-local", value };
  }

  const scheme = value.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1]?.toLowerCase();
  if (scheme){
    if (["http", "https", "data", "mailto", "tel"].includes(scheme)){
      return { kind: "external", value, scheme };
    }
    return { kind: "unsupported-scheme", value, scheme };
  }

  const pathname = value.split(/[?#]/, 1)[0];
  const decoded = decodePathname(pathname);
  if (decoded === null) return { kind: "invalid-encoding", value };
  if (decoded.includes("\\")) return { kind: "backslash", value };
  return {
    kind: "local",
    value,
    pathname: decoded,
    containsTraversal: decoded.split("/").includes("..")
  };
}

async function resolveLocalReference({
  event,
  sourceFile,
  rawValue,
  label,
  allowDirectoryIndex = false
}){
  const reference = classifyReference(rawValue);

  if (["empty", "fragment", "external"].includes(reference.kind)){
    return null;
  }
  if (reference.kind === "protocol-relative"){
    addError(event, sourceFile, `${label} usa una URL protocol-relative: ${reference.value}`);
    return null;
  }
  if (reference.kind === "absolute-local"){
    addError(event, sourceFile, `${label} usa una ruta local absoluta: ${reference.value}`);
    return null;
  }
  if (reference.kind === "unsupported-scheme"){
    addError(event, sourceFile, `${label} usa un protocolo no permitido: ${reference.scheme}:`);
    return null;
  }
  if (reference.kind === "invalid-encoding"){
    addError(event, sourceFile, `${label} contiene codificación URL inválida: ${reference.value}`);
    return null;
  }
  if (reference.kind === "backslash"){
    addError(event, sourceFile, `${label} debe usar '/' y no '\\': ${reference.value}`);
    return null;
  }

  const target = path.resolve(path.dirname(sourceFile), reference.pathname);
  if (!isInside(outputRoot, target)){
    addError(
      event,
      sourceFile,
      `${label} contiene traversal fuera de dist/: ${reference.value}`
    );
    return null;
  }

  let candidate = target;
  let targetStats = await getStats(candidate);
  if (allowDirectoryIndex && targetStats?.isDirectory()){
    candidate = path.join(candidate, "index.html");
    targetStats = await getStats(candidate);
  }
  if (!targetStats?.isFile()){
    addError(event, sourceFile, `${label} no existe: ${reference.value}`);
    return null;
  }

  const resolved = await realpath(candidate);
  if (!isInside(outputRoot, resolved)){
    addError(
      event,
      sourceFile,
      `${label} resuelve fuera de dist/: ${reference.value}`
    );
    return null;
  }

  return candidate;
}

function extractHtmlReferences(html){
  const references = [];
  const attributePattern =
    /\b(src|href|poster)\s*=\s*(["'])(.*?)\2/gi;
  let match;

  while ((match = attributePattern.exec(html))){
    references.push({ attribute: match[1].toLowerCase(), value: match[3] });
  }

  const srcsetPattern = /\bsrcset\s*=\s*(["'])(.*?)\1/gi;
  while ((match = srcsetPattern.exec(html))){
    for (const candidate of match[2].split(",")){
      const value = candidate.trim().split(/\s+/, 1)[0];
      if (value) references.push({ attribute: "srcset", value });
    }
  }

  return references;
}

function extractEmbeddedJson(html, id){
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<script\\b[^>]*\\bid=(["'])${escapedId}\\1[^>]*>([\\s\\S]*?)<\\/script>`,
    "i"
  );
  const match = html.match(pattern);
  if (!match) return { found: false, value: null };

  try{
    return { found: true, value: JSON.parse(match[2]) };
  }catch{
    return { found: true, value: null };
  }
}

function collectConfigAssetReferences(config){
  const references = [];
  const add = (value, field) => {
    if (typeof value === "string" && value.trim()){
      references.push({ value, field });
    }
  };

  add(config.media?.hero?.src, "media.hero.src");
  add(config.sections?.music?.src, "sections.music.src");

  for (const [groupIndex, group] of (
    config.sections?.people?.groups || []
  ).entries()){
    for (const [personIndex, person] of (group.people || []).entries()){
      add(
        person.image,
        `sections.people.groups.${groupIndex}.people.${personIndex}.image`
      );
    }
  }
  for (const [index, item] of (config.sections?.story?.items || []).entries()){
    add(item.image, `sections.story.items.${index}.image`);
  }
  for (const [index, item] of (config.sections?.gallery?.items || []).entries()){
    add(item.thumb, `sections.gallery.items.${index}.thumb`);
    add(item.full, `sections.gallery.items.${index}.full`);
    add(item.src, `sections.gallery.items.${index}.src`);
  }

  return references;
}

async function validateCanonicalAsset(event, eventDirectory, configFile, reference){
  const classified = classifyReference(reference.value);
  if (classified.kind !== "local" || classified.containsTraversal){
    addError(
      event,
      configFile,
      `${reference.field} debe ser una ruta relativa segura: ${reference.value}`
    );
    return;
  }

  const target = path.resolve(eventDirectory, classified.pathname);
  if (!isInside(eventDirectory, target)){
    addError(event, configFile, `${reference.field} sale del evento: ${reference.value}`);
    return;
  }
  if (!await fileExists(target)){
    addError(event, configFile, `${reference.field} no existe: ${reference.value}`);
    return;
  }

  const resolved = await realpath(target);
  if (!isInside(eventDirectory, resolved)){
    addError(event, configFile, `${reference.field} resuelve fuera del evento.`);
  }
}

async function loadTheme(themeId, event){
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(themeId || ""))){
    addError(event, themesRoot, `El identificador de tema no es seguro: "${themeId}".`);
    return null;
  }

  const themeDirectory = path.resolve(themesRoot, themeId);
  if (!isInside(themesRoot, themeDirectory)){
    addError(event, themesRoot, `La ruta del tema sale de src/invitation/themes/: "${themeId}".`);
    return null;
  }

  const manifestPath = path.join(themeDirectory, "manifest.json");
  const manifest = await readJson(manifestPath, event, `el manifest del tema ${themeId}`);
  if (!manifest) return null;

  if (manifest.id !== themeId){
    addError(event, manifestPath, `El manifest declara id "${manifest.id}" en lugar de "${themeId}".`);
  }

  const cssReference = classifyReference(manifest.css);
  if (cssReference.kind !== "local" || cssReference.containsTraversal){
    addError(event, manifestPath, `El CSS del tema usa una ruta insegura: ${manifest.css}`);
    return { manifest, manifestPath, cssPath: null };
  }

  const cssPath = path.resolve(themeDirectory, cssReference.pathname);
  if (!isInside(themeDirectory, cssPath) || !await fileExists(cssPath)){
    addError(event, manifestPath, `No existe el CSS declarado por el tema: ${manifest.css}`);
    return { manifest, manifestPath, cssPath: null };
  }

  return { manifest, manifestPath, cssPath };
}

async function validateCanonicalEvents(){
  if (!await directoryExists(eventsRoot)){
    addError("global", eventsRoot, "No existe el directorio de eventos canónicos.");
    return [];
  }

  const directoryNames = await listDirectories(
    eventsRoot,
    "global",
    "el directorio de eventos canónicos"
  );
  if (directoryNames.length === 0){
    addError("global", eventsRoot, "No hay eventos canónicos para validar.");
    return [];
  }

  const events = [];
  const slugs = new Map();

  for (const directoryName of directoryNames){
    const eventDirectory = path.join(eventsRoot, directoryName);
    const configFile = path.join(eventDirectory, "config.json");
    const rawConfig = await readJson(
      configFile,
      directoryName,
      "la configuración canónica"
    );
    if (!rawConfig) continue;

    let migration;
    try{
      migration = migrateConfig(rawConfig);
    }catch(error){
      addError(
        directoryName,
        configFile,
        `No se pudo migrar la configuración: ${error.code || error.message}.`
      );
      continue;
    }

    const config = migration.config;
    const validation = validateConfig(config);
    for (const issue of validation.errors){
      addError(
        directoryName,
        configFile,
        `${issue.path || "(raíz)"} [${issue.code}]: ${issue.message}`
      );
    }
    for (const issue of validation.warnings){
      addWarning(
        directoryName,
        configFile,
        `${issue.path || "(raíz)"} [${issue.code}]: ${issue.message}`
      );
    }
    if (migration.migrated){
      addWarning(
        directoryName,
        configFile,
        "La configuración es legacy; se validó después de migrarla en memoria."
      );
    }

    if (config.slug !== directoryName){
      addError(
        directoryName,
        configFile,
        `El slug "${config.slug}" no coincide con la carpeta "${directoryName}".`
      );
    }

    const previousDirectory = slugs.get(config.slug);
    if (previousDirectory){
      addError(
        directoryName,
        configFile,
        `Slug duplicado "${config.slug}"; también se usa en "${previousDirectory}".`
      );
    }else{
      slugs.set(config.slug, directoryName);
    }

    const theme = await loadTheme(config.theme, directoryName);
    for (const reference of collectConfigAssetReferences(config)){
      await validateCanonicalAsset(
        directoryName,
        eventDirectory,
        configFile,
        reference
      );
    }

    events.push({
      directoryName,
      eventDirectory,
      configFile,
      config,
      theme
    });
  }

  return events;
}

async function validateCssGraph(event, entryFiles){
  const queue = [...new Set(entryFiles)];
  const visited = new Set();

  while (queue.length > 0){
    const cssFile = queue.shift();
    if (!cssFile || visited.has(cssFile)) continue;
    visited.add(cssFile);

    let css;
    try{
      css = await readFile(cssFile, "utf8");
    }catch(error){
      addError(event, cssFile, `No se pudo leer el CSS: ${error.code || "error de lectura"}.`);
      continue;
    }

    const references = [];
    const urlPattern = /url\(\s*(?:(["'])(.*?)\1|([^)"']+))\s*\)/gi;
    let match;
    while ((match = urlPattern.exec(css))){
      references.push({ value: (match[2] || match[3] || "").trim(), isImport: false });
    }
    const importPattern = /@import\s+(?:url\(\s*)?(["'])(.*?)\1\s*\)?/gi;
    while ((match = importPattern.exec(css))){
      references.push({ value: match[2], isImport: true });
    }

    for (const reference of references){
      const target = await resolveLocalReference({
        event,
        sourceFile: cssFile,
        rawValue: reference.value,
        label: "Referencia CSS"
      });
      if (reference.isImport && target?.toLowerCase().endsWith(".css")){
        queue.push(target);
      }
    }
  }
}

async function validateJavaScriptGraph(event, entryFiles){
  const queue = [...new Set(entryFiles)];
  const visited = new Set();

  while (queue.length > 0){
    const scriptFile = queue.shift();
    if (!scriptFile || visited.has(scriptFile)) continue;
    visited.add(scriptFile);

    let source;
    try{
      source = await readFile(scriptFile, "utf8");
    }catch(error){
      addError(event, scriptFile, `No se pudo leer JavaScript: ${error.code || "error de lectura"}.`);
      continue;
    }

    const specifiers = [];
    const staticPattern =
      /\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?(["'])([^"']+)\1/g;
    const dynamicPattern = /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g;
    let match;
    while ((match = staticPattern.exec(source))) specifiers.push(match[2]);
    while ((match = dynamicPattern.exec(source))) specifiers.push(match[2]);

    for (const specifier of specifiers){
      const target = await resolveLocalReference({
        event,
        sourceFile: scriptFile,
        rawValue: specifier,
        label: "Import de JavaScript"
      });
      if (target?.toLowerCase().endsWith(".js")) queue.push(target);
    }
  }
}

async function validateGeneratedEvent(sourceEvent){
  const { directoryName: event, config, theme } = sourceEvent;
  const eventOutputDirectory = path.join(outputEventsRoot, event);
  const indexFile = path.join(eventOutputDirectory, "index.html");

  if (!await fileExists(indexFile)){
    addError(event, indexFile, "El evento generado no contiene index.html.");
    return;
  }

  let html;
  try{
    html = await readFile(indexFile, "utf8");
  }catch(error){
    addError(event, indexFile, `No se pudo leer index.html: ${error.code || "error de lectura"}.`);
    return;
  }

  const embedded = extractEmbeddedJson(html, "event-config");
  if (!embedded.found){
    addError(event, indexFile, "Falta la configuración incrustada #event-config.");
  }else if (!embedded.value){
    addError(event, indexFile, "La configuración incrustada no contiene JSON válido.");
  }else{
    const validation = validateConfig(embedded.value);
    for (const issue of validation.errors){
      addError(
        event,
        indexFile,
        `Configuración incrustada ${issue.path || "(raíz)"} [${issue.code}]: ${issue.message}`
      );
    }
    if (!isDeepStrictEqual(embedded.value, config)){
      addError(event, indexFile, "La configuración incrustada no coincide con la fuente canónica.");
    }
  }

  const executableConfigReference =
    /\b(?:fetch|import)\s*\(\s*(["'])[^"']*\bconfig\.json\b[^"']*\1/i.test(html);
  const resourceConfigReference = extractHtmlReferences(html).some((reference) => {
    const classified = classifyReference(reference.value);
    return classified.kind === "local" &&
      path.posix.basename(classified.pathname).toLowerCase() === "config.json";
  });
  if (executableConfigReference || resourceConfigReference){
    addError(
      event,
      indexFile,
      "El HTML generado conserva una referencia a config.json pese a tener configuración incrustada."
    );
  }

  const cssEntries = [];
  const scriptEntries = [];
  const references = extractHtmlReferences(html);
  for (const reference of references){
    const target = await resolveLocalReference({
      event,
      sourceFile: indexFile,
      rawValue: reference.value,
      label: `Atributo ${reference.attribute}`,
      allowDirectoryIndex: reference.attribute === "href"
    });
    if (!target) continue;
    if (target.toLowerCase().endsWith(".css")) cssEntries.push(target);
    if (target.toLowerCase().endsWith(".js")) scriptEntries.push(target);
  }

  const expectedRuntime = path.join(
    outputSharedRoot,
    "runtime",
    "core",
    "bootstrap.js"
  );
  if (!await fileExists(expectedRuntime)){
    addError(event, expectedRuntime, "No existe el runtime compartido generado.");
  }else if (!scriptEntries.includes(expectedRuntime)){
    addError(event, indexFile, "index.html no referencia el runtime compartido esperado.");
  }

  if (theme?.manifest && theme.cssPath){
    const generatedThemeDirectory = path.join(
      outputSharedRoot,
      "themes",
      config.theme
    );
    const expectedThemeManifest = path.join(
      generatedThemeDirectory,
      "manifest.json"
    );
    const expectedThemeCss = path.resolve(
      generatedThemeDirectory,
      theme.manifest.css
    );
    if (!isInside(generatedThemeDirectory, expectedThemeCss)){
      addError(event, expectedThemeCss, "La ruta generada del CSS sale del tema.");
    }else if (!await fileExists(expectedThemeManifest)){
      addError(event, expectedThemeManifest, "No existe el manifest del tema en dist/.");
    }else if (!await fileExists(expectedThemeCss)){
      addError(event, expectedThemeCss, "No existe el CSS compartido del tema en dist/.");
    }else if (!cssEntries.includes(expectedThemeCss)){
      addError(event, indexFile, "index.html no referencia el CSS compartido del tema esperado.");
    }
  }

  for (const reference of collectConfigAssetReferences(config)){
    await resolveLocalReference({
      event,
      sourceFile: indexFile,
      rawValue: reference.value,
      label: `Asset incrustado ${reference.field}`
    });
  }

  await validateCssGraph(event, cssEntries);
  await validateJavaScriptGraph(event, scriptEntries);
}

async function validateGeneratedOutput(sourceEvents){
  if (!await directoryExists(outputRoot)){
    addError("global", outputRoot, "No existe dist/. Ejecuta primero npm run build.");
    return;
  }
  if (!await directoryExists(outputEventsRoot)){
    addError("global", outputEventsRoot, "No existe dist/events/.");
    return;
  }
  if (!await directoryExists(outputSharedRoot)){
    addError("global", outputSharedRoot, "No existe el runtime compartido en dist/shared/invitation/.");
  }

  const generatedDirectories = await listDirectories(
    outputEventsRoot,
    "global",
    "los eventos generados"
  );
  const canonicalNames = new Set(sourceEvents.map((event) => event.directoryName));
  const generatedNames = new Set(generatedDirectories);

  for (const event of sourceEvents){
    if (!generatedNames.has(event.directoryName)){
      addError(
        event.directoryName,
        path.join(outputEventsRoot, event.directoryName),
        "El evento canónico no fue generado."
      );
    }
  }
  for (const generatedName of generatedDirectories){
    if (!canonicalNames.has(generatedName)){
      addError(
        generatedName,
        path.join(outputEventsRoot, generatedName),
        "Existe un evento generado sin fuente canónica; dist/ está desactualizado."
      );
    }
  }

  for (const event of sourceEvents){
    await validateGeneratedEvent(event);
  }
}

function printIssues(label, collection, method){
  if (collection.length === 0) return;
  method(`${label} (${collection.length}):`);
  for (const issue of collection){
    method(`  [${issue.event}] ${issue.file}: ${issue.problem}`);
  }
}

async function main(){
  assertSupportedNode();
  console.log("Validando configuraciones canónicas...");
  const sourceEvents = await validateCanonicalEvents();
  console.log(`  ${sourceEvents.length} evento(s) descubierto(s).`);

  console.log("Validando salida estática...");
  await validateGeneratedOutput(sourceEvents);

  printIssues("Advertencias", warnings, console.warn);
  if (errors.length > 0){
    printIssues("Errores", errors, console.error);
    console.error(`Check falló con ${errors.length} error(es).`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `✓ Check completado: ${sourceEvents.length} evento(s), ` +
    `${warnings.length} advertencia(s), 0 errores.`
  );
}

main().catch((error) => {
  console.error(`Check cancelado: ${error.message}`);
  process.exitCode = 1;
});
