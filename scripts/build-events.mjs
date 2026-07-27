import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { migrateConfig } from "../src/invitation/core/config-migrator.js";
import { validateConfig } from "../src/invitation/core/config-validator.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const shellPath = path.join(projectRoot, "src", "invitation", "shell.html");
const themesRoot = path.join(projectRoot, "src", "invitation", "themes");
const runtimeRoot = path.join(projectRoot, "src", "invitation");
const outputRoot = path.join(projectRoot, "dist");
const temporaryOutputRoot = path.join(
  projectRoot,
  `.dist-events-build-${process.pid}`
);
const previousOutputRoot = path.join(
  projectRoot,
  `.dist-events-previous-${process.pid}`
);
const minimumNodeVersion = [18, 18, 0];

const navigationItems = [
  { section: "people", href: "#personas", label: "Personas" },
  { section: "details", href: "#detalles", label: "Detalles" },
  { section: "story", href: "#historia", label: "Historia" },
  { section: "schedule", href: "#itinerario", label: "Itinerario" },
  { section: "gallery", href: "#galeria", label: "Galería" },
  { section: "gifts", href: "#regalos", label: "Regalos" },
  { section: "rsvp", href: "#rsvp", label: "RSVP" }
];

function parseArguments(argv){
  const options = {
    eventsRoot: path.join(projectRoot, "events"),
    eventSlug: null
  };

  for (let index = 0; index < argv.length; index += 1){
    const argument = argv[index];
    if (argument === "--events-root"){
      const value = argv[index + 1];
      if (!value) throw new Error("--events-root requiere una ruta.");
      options.eventsRoot = path.resolve(projectRoot, value);
      index += 1;
    }else if (argument === "--event"){
      const value = argv[index + 1];
      if (!value) throw new Error("--event requiere un slug.");
      options.eventSlug = value;
      index += 1;
    }else{
      throw new Error(`Argumento desconocido: ${argument}`);
    }
  }

  return options;
}

function assertSupportedNode(){
  const current = process.versions.node.split(".").map(Number);
  const isSupported = minimumNodeVersion.every((minimumPart, index) => {
    const currentPart = current[index] || 0;
    const previousPartsEqual = minimumNodeVersion
      .slice(0, index)
      .every((part, previousIndex) => part === (current[previousIndex] || 0));
    return !previousPartsEqual || currentPart >= minimumPart;
  });

  if (!isSupported){
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

function assertSafeOutputPath(candidate){
  if (
    path.resolve(candidate) !== outputRoot &&
    path.resolve(candidate) !== temporaryOutputRoot &&
    path.resolve(candidate) !== previousOutputRoot &&
    !isInside(temporaryOutputRoot, path.resolve(candidate))
  ){
    throw new Error("La ruta de salida queda fuera del directorio generado.");
  }
}

function isSafeRelativePath(value){
  if (typeof value !== "string" || value.trim() === "") return false;
  if (path.isAbsolute(value) || value.includes("\\")) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;

  try{
    return !decodeURIComponent(value).split("/").includes("..");
  }catch{
    return false;
  }
}

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsonForHtml(value){
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function applySectionConditions(shell, conditions){
  const pattern =
    /<!-- IF:([A-Za-z][A-Za-z0-9]*) -->([\s\S]*?)<!-- ENDIF:\1 -->/g;
  let output = shell;

  while (pattern.test(output)){
    pattern.lastIndex = 0;
    output = output.replace(
      pattern,
      (match, name, content) => conditions[name] ? content : ""
    );
  }

  return output;
}

function replacePlaceholders(shell, values){
  const output = shell.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (!(key in values)){
      throw new Error(`El shell contiene un placeholder sin resolver: ${key}.`);
    }
    return values[key];
  });

  const unresolved = output.match(/\{\{[A-Z_]+\}\}/);
  if (unresolved){
    throw new Error(`Placeholder sin resolver: ${unresolved[0]}.`);
  }

  return output;
}

function renderNavigation(sections){
  return navigationItems
    .filter((item) => sections[item.section]?.enabled)
    .map((item) =>
      `        <a href="${item.href}">${escapeHtml(item.label)}</a>`
    )
    .join("\n");
}

function renderFontLinks(fonts){
  if (!Array.isArray(fonts)) return "";

  return fonts.map((font, index) => {
    if (!font || typeof font !== "object"){
      throw new Error(`La fuente ${index} del manifest no es válida.`);
    }
    if (!["preconnect", "stylesheet"].includes(font.rel)){
      throw new Error(`Rel de fuente no permitido: ${font.rel}.`);
    }

    let url;
    try{
      url = new URL(font.href);
    }catch{
      throw new Error(`URL de fuente inválida en la posición ${index}.`);
    }
    if (url.protocol !== "https:"){
      throw new Error("Las fuentes del tema deben utilizar HTTPS.");
    }

    const crossorigin = font.crossorigin ? " crossorigin" : "";
    return `    <link rel="${font.rel}" href="${escapeHtml(url.href)}"${crossorigin}>`;
  }).join("\n");
}

function collectAssetReferences(config){
  const references = new Set();
  const add = (value) => {
    if (typeof value === "string" && value.trim() !== ""){
      references.add(value.replaceAll("\\", "/"));
    }
  };

  add(config.media?.hero?.src);
  add(config.sections?.music?.src);

  for (const group of config.sections?.people?.groups || []){
    for (const person of group.people || []){
      add(person.image);
    }
  }
  for (const item of config.sections?.story?.items || []){
    add(item.image);
  }
  for (const item of config.sections?.gallery?.items || []){
    add(item.thumb);
    add(item.full);
    add(item.src);
  }

  return references;
}

async function listFiles(directory){
  try{
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries){
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()){
        files.push(...await listFiles(absolute));
      }else if (entry.isFile()){
        files.push(absolute);
      }else if (entry.isSymbolicLink()){
        throw new Error(`No se permiten enlaces simbólicos en assets: ${absolute}.`);
      }
    }
    return files;
  }catch(error){
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function fileExists(filePath){
  try{
    const value = await stat(filePath);
    return value.isFile();
  }catch{
    return false;
  }
}

async function readJson(filePath, description){
  let text;
  try{
    text = await readFile(filePath, "utf8");
  }catch{
    throw new Error(`No se pudo leer ${description}.`);
  }

  try{
    return JSON.parse(text);
  }catch{
    throw new Error(`${description} no contiene JSON válido.`);
  }
}

async function discoverEvents(eventsRoot, requestedSlug){
  if (!isInside(projectRoot, eventsRoot)){
    throw new Error("El directorio de eventos debe estar dentro del proyecto.");
  }

  let entries;
  try{
    entries = await readdir(eventsRoot, { withFileTypes: true });
  }catch{
    throw new Error(`No se encontró el directorio de eventos: ${eventsRoot}.`);
  }

  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      slug: entry.name,
      directory: path.join(eventsRoot, entry.name)
    }))
    .filter((entry) => !requestedSlug || entry.slug === requestedSlug)
    .sort((left, right) => left.slug.localeCompare(right.slug));

  if (requestedSlug && directories.length === 0){
    throw new Error(`No se encontró el evento solicitado: ${requestedSlug}.`);
  }
  if (directories.length === 0){
    throw new Error("No se encontraron eventos para generar.");
  }

  return directories;
}

async function loadTheme(themeId){
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(themeId)){
    throw new Error("El identificador del tema no es seguro.");
  }

  const themeDirectory = path.join(themesRoot, themeId);
  const manifestPath = path.join(themeDirectory, "manifest.json");
  const manifest = await readJson(
    manifestPath,
    `el manifest del tema ${themeId}`
  );

  if (manifest.id !== themeId){
    throw new Error(`El manifest del tema ${themeId} declara un id diferente.`);
  }
  if (typeof manifest.name !== "string" || manifest.name.trim() === ""){
    throw new Error(`El manifest del tema ${themeId} no declara un nombre.`);
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(String(manifest.themeColor || ""))){
    throw new Error(`El theme-color del tema ${themeId} no es válido.`);
  }
  if (
    manifest.runtimeOptions !== undefined &&
    (
      !manifest.runtimeOptions ||
      typeof manifest.runtimeOptions !== "object" ||
      Array.isArray(manifest.runtimeOptions)
    )
  ){
    throw new Error(`Las opciones de runtime del tema ${themeId} no son válidas.`);
  }
  if (!isSafeRelativePath(manifest.css)){
    throw new Error(`El CSS del tema ${themeId} no usa una ruta segura.`);
  }

  const cssPath = path.resolve(themeDirectory, manifest.css);
  if (!isInside(themeDirectory, cssPath) || !await fileExists(cssPath)){
    throw new Error(`No se encontró el CSS del tema ${themeId}.`);
  }

  return { manifest, themeDirectory, cssPath };
}

async function validateAssets(eventDirectory, config){
  const references = collectAssetReferences(config);
  const errors = [];

  for (const reference of references){
    if (!isSafeRelativePath(reference)){
      errors.push(`Ruta de asset insegura: ${reference}`);
      continue;
    }

    const absolute = path.resolve(eventDirectory, reference);
    if (!isInside(eventDirectory, absolute)){
      errors.push(`Ruta de asset fuera del evento: ${reference}`);
      continue;
    }
    if (!await fileExists(absolute)){
      errors.push(`Asset inexistente: ${reference}`);
      continue;
    }

    const resolvedAsset = await realpath(absolute);
    if (!isInside(eventDirectory, resolvedAsset)){
      errors.push(`El asset resuelve fuera del evento: ${reference}`);
    }
  }

  if (errors.length > 0){
    throw new Error(errors.join("\n"));
  }

  const assetDirectory = path.join(eventDirectory, "assets");
  const sourceAssets = await listFiles(assetDirectory);
  const referencedAssets = new Set(
    [...references].map((reference) =>
      path.normalize(path.resolve(eventDirectory, reference))
    )
  );
  const unused = sourceAssets
    .filter((asset) => !referencedAssets.has(path.normalize(asset)))
    .map((asset) => path.relative(eventDirectory, asset).replaceAll("\\", "/"));

  return { references, unused };
}

function renderEventHtml(shell, config, manifest){
  const sections = config.sections;
  const conditions = Object.fromEntries(
    Object.entries(sections).map(([name, section]) => [
      name,
      section?.enabled === true
    ])
  );
  conditions.maps = Boolean(config.event.venue.mapsUrl);

  const conditionalShell = applySectionConditions(shell, conditions);
  const values = {
    LANG: escapeHtml(config.language || "es"),
    TITLE: escapeHtml(`Invitación • ${config.event.names}`),
    THEME_COLOR: escapeHtml(manifest.themeColor),
    FONT_LINKS: renderFontLinks(manifest.fonts),
    THEME_CSS_HREF:
      `../../shared/invitation/themes/${escapeHtml(config.theme)}/theme.css`,
    RUNTIME_HREF: "../../shared/invitation/runtime/core/bootstrap.js",
    NAVIGATION: renderNavigation(sections),
    NAMES: escapeHtml(config.event.names),
    TAGLINE: escapeHtml(config.event.tagline || ""),
    DATE_DISPLAY: escapeHtml(config.event.date.display),
    TIME_DISPLAY: escapeHtml(config.event.date.timeDisplay),
    MESSAGE_TITLE: escapeHtml(sections.message.title || ""),
    MESSAGE_BODY: escapeHtml(sections.message.body || ""),
    PEOPLE_TITLE: escapeHtml(sections.people?.title || ""),
    PEOPLE_INTRO: escapeHtml(sections.people?.intro || ""),
    VENUE_NAME: escapeHtml(config.event.venue.name),
    VENUE_ADDRESS: escapeHtml(config.event.venue.address),
    STORY_TITLE: escapeHtml(sections.story.title || ""),
    STORY_SUBTITLE: escapeHtml(sections.story.subtitle || ""),
    DRESS_CODE: escapeHtml(sections.dressCode.text || ""),
    GIFTS_TITLE: escapeHtml(sections.gifts.title || ""),
    GIFTS_INTRO: escapeHtml(sections.gifts.intro || ""),
    FOOTER_TEXT: escapeHtml(config.branding.footerText),
    EVENT_CONFIG: escapeJsonForHtml(config),
    THEME_RUNTIME_OPTIONS: escapeJsonForHtml(manifest.runtimeOptions || {})
  };

  return replacePlaceholders(conditionalShell, values);
}

async function copySharedRuntime(destinationRoot){
  const sharedRoot = path.join(destinationRoot, "shared", "invitation");
  const runtimeDestination = path.join(sharedRoot, "runtime");
  await mkdir(runtimeDestination, { recursive: true });
  await cp(
    path.join(runtimeRoot, "core"),
    path.join(runtimeDestination, "core"),
    { recursive: true }
  );
  await cp(
    path.join(runtimeRoot, "sections"),
    path.join(runtimeDestination, "sections"),
    { recursive: true }
  );

  const themeEntries = await readdir(themesRoot, { withFileTypes: true });
  for (const entry of themeEntries.filter((value) => value.isDirectory())){
    const source = path.join(themesRoot, entry.name);
    const destination = path.join(sharedRoot, "themes", entry.name);
    await cp(source, destination, { recursive: true });
  }
}

async function verifyCopiedAssets(eventDirectory, outputEventDirectory, references){
  for (const reference of references){
    const source = path.resolve(eventDirectory, reference);
    const destination = path.resolve(outputEventDirectory, reference);
    if (!isInside(outputEventDirectory, destination)){
      throw new Error(`Asset generado fuera del evento: ${reference}.`);
    }

    const [sourceStats, destinationStats] = await Promise.all([
      stat(source),
      stat(destination)
    ]);
    if (sourceStats.size !== destinationStats.size){
      throw new Error(`El asset copiado no coincide con el origen: ${reference}.`);
    }
  }
}

async function buildEvent(eventSource, shell, destinationRoot){
  const rawConfig = await readJson(
    path.join(eventSource.directory, "config.json"),
    `la configuración de ${eventSource.slug}`
  );
  const migration = migrateConfig(rawConfig);
  const config = migration.config;
  const validation = validateConfig(config);

  if (!validation.valid){
    const details = validation.errors
      .map((issue) => `${issue.path || "(raíz)"}: ${issue.code}`)
      .join("\n");
    throw new Error(`Configuración inválida para ${eventSource.slug}:\n${details}`);
  }
  if (config.slug !== eventSource.slug){
    throw new Error(
      `El slug de la configuración (${config.slug}) no coincide con la carpeta (${eventSource.slug}).`
    );
  }

  const { manifest } = await loadTheme(config.theme);
  const assets = await validateAssets(eventSource.directory, config);
  const outputEventDirectory = path.join(
    destinationRoot,
    "events",
    config.slug
  );
  await mkdir(outputEventDirectory, { recursive: true });

  const sourceAssets = path.join(eventSource.directory, "assets");
  try{
    await access(sourceAssets);
    await cp(sourceAssets, path.join(outputEventDirectory, "assets"), {
      recursive: true
    });
  }catch(error){
    if (error?.code !== "ENOENT") throw error;
  }

  const html = renderEventHtml(shell, config, manifest);
  await writeFile(
    path.join(outputEventDirectory, "index.html"),
    `${html.trimEnd()}\n`,
    "utf8"
  );
  await verifyCopiedAssets(
    eventSource.directory,
    outputEventDirectory,
    assets.references
  );

  return {
    slug: config.slug,
    theme: config.theme,
    migrated: migration.migrated,
    validationWarnings: validation.warnings,
    unusedAssets: assets.unused
  };
}

async function replaceOutput(){
  assertSafeOutputPath(outputRoot);
  assertSafeOutputPath(temporaryOutputRoot);
  assertSafeOutputPath(previousOutputRoot);

  await rm(previousOutputRoot, { recursive: true, force: true });
  let hadPreviousOutput = false;

  try{
    await access(outputRoot);
    try{
      await rename(outputRoot, previousOutputRoot);
    }catch(error){
      if (!["EPERM", "EACCES"].includes(error?.code)) throw error;

      await cp(outputRoot, previousOutputRoot, { recursive: true });
      try{
        await rm(outputRoot, { recursive: true, force: true });
      }catch(removeError){
        await rm(previousOutputRoot, { recursive: true, force: true });
        throw removeError;
      }
    }
    hadPreviousOutput = true;
  }catch(error){
    if (error?.code !== "ENOENT") throw error;
  }

  try{
    await rename(temporaryOutputRoot, outputRoot);
  }catch(error){
    if (hadPreviousOutput){
      try{
        await rename(previousOutputRoot, outputRoot);
      }catch(restoreError){
        if (!["EPERM", "EACCES"].includes(restoreError?.code)){
          throw restoreError;
        }
        await cp(previousOutputRoot, outputRoot, { recursive: true });
        await rm(previousOutputRoot, { recursive: true, force: true });
      }
    }
    throw error;
  }

  if (hadPreviousOutput){
    await rm(previousOutputRoot, { recursive: true, force: true });
  }
}

async function main(){
  assertSupportedNode();
  const options = parseArguments(process.argv.slice(2));
  const [shell, events] = await Promise.all([
    readFile(shellPath, "utf8"),
    discoverEvents(options.eventsRoot, options.eventSlug)
  ]);

  assertSafeOutputPath(temporaryOutputRoot);
  await rm(temporaryOutputRoot, { recursive: true, force: true });
  await mkdir(temporaryOutputRoot, { recursive: true });

  try{
    await copySharedRuntime(temporaryOutputRoot);
    const results = [];

    for (const eventSource of events){
      results.push(await buildEvent(eventSource, shell, temporaryOutputRoot));
    }

    await replaceOutput();

    for (const result of results){
      const migrationLabel = result.migrated ? " (migrado desde legacy)" : "";
      console.log(`✓ ${result.slug} · ${result.theme}${migrationLabel}`);
      for (const warning of result.validationWarnings){
        console.warn(`  advertencia ${warning.path}: ${warning.code}`);
      }
      for (const asset of result.unusedAssets){
        console.warn(`  asset no utilizado: ${asset}`);
      }
    }
    console.log(`Salida: ${path.relative(projectRoot, outputRoot)}`);
  }catch(error){
    await rm(temporaryOutputRoot, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(`Build cancelado: ${error.message}`);
  process.exitCode = 1;
});
