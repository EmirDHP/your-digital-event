import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { migrateConfig } from "../src/invitation/core/config-migrator.js";
import { normalizeConfig } from "../src/invitation/core/config-normalizer.js";
import { validateConfig } from "../src/invitation/core/config-validator.js";
import { createCalendarFile } from "./lib/icalendar.mjs";
import { createSocialMetadata } from "./lib/social-metadata.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const schemaPath = path.join(projectRoot, "schemas", "event.schema.json");
const evermoreThemeRoot = path.join(
  projectRoot,
  "src",
  "invitation",
  "themes",
  "evermore"
);
const expectedSubtypes = [
  "baptism",
  "babyShower",
  "presentation",
  "firstBirthday",
  "communion",
  "kidsParty",
  "familyCelebration",
  "other"
];

const failures = [];

function clone(value){
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message){
  if (!condition) failures.push(message);
}

function hasError(validation, path, code){
  return validation.errors.some((issue) =>
    issue.path === path && (!code || issue.code === code)
  );
}

function createBaseConfig(){
  return {
    schemaVersion: 1,
    slug: "contract-test",
    theme: "eclipse",
    event: {
      type: "event",
      names: "Evento de prueba",
      date: {
        iso: "2027-01-10T12:00:00-06:00",
        timeZone: "America/Matamoros",
        display: "10 · Enero · 2027",
        timeDisplay: "12:00 PM"
      },
      venue: {
        name: "Lugar de prueba",
        address: "Dirección de prueba"
      }
    },
    sections: {
      message: { enabled: false },
      countdown: { enabled: false },
      details: { enabled: true },
      schedule: { enabled: false },
      story: { enabled: false },
      gallery: { enabled: false },
      dressCode: { enabled: false },
      gifts: { enabled: false },
      rsvp: { enabled: false },
      music: { enabled: false }
    },
    media: {},
    branding: {
      footerText: "Your Digital Event"
    }
  };
}

async function validateSchemaDocument(){
  let schema;
  try{
    schema = JSON.parse(await readFile(schemaPath, "utf8"));
  }catch(error){
    failures.push(`No se pudo leer el JSON Schema: ${error.message}`);
    return;
  }

  assert(
    schema.$schema === "https://json-schema.org/draft/2020-12/schema",
    "El schema debe continuar usando JSON Schema draft 2020-12."
  );
  assert(
    JSON.stringify(schema.$defs?.event?.properties?.type?.enum) ===
      JSON.stringify(["wedding", "xv", "event"]),
    "El schema debe conservar los tipos wedding, xv y event."
  );
  assert(
    schema.properties?.theme?.enum?.includes("alba"),
    "El schema debe registrar el tema Alba."
  );
  assert(
    schema.properties?.theme?.enum?.includes("celeste"),
    "El schema debe registrar el tema Celeste."
  );
  assert(
    schema.properties?.theme?.enum?.includes("evermore"),
    "El schema debe registrar el tema Evermore."
  );
  assert(
    schema.$defs?.date?.properties?.endIso?.format === "date-time" &&
      !schema.$defs?.date?.required?.includes("endIso"),
    "event.date.endIso debe ser una fecha opcional para el calendario."
  );
  assert(
    schema.$defs?.sections?.properties?.faq?.$ref === "#/$defs/faqSection" &&
      !schema.$defs?.sections?.required?.includes("faq"),
    "sections.faq debe ser opcional para configuraciones existentes."
  );
  assert(
    schema.$defs?.faqSection?.properties?.items?.minItems === 1 &&
      schema.$defs?.faqItem?.required?.includes("question") &&
      schema.$defs?.faqItem?.required?.includes("answer"),
    "El contrato FAQ debe exigir preguntas y respuestas completas."
  );
  assert(
    schema.properties?.sharing?.$ref === "#/$defs/sharing" &&
      !schema.required?.includes("sharing") &&
      schema.$defs?.sharing?.required?.includes("url") &&
      schema.$defs?.sharing?.required?.includes("description"),
    "sharing debe ser opcional y exigir URL y descripción cuando se declara."
  );
  assert(
    JSON.stringify(schema.$defs?.event?.properties?.subtype?.enum) ===
      JSON.stringify(expectedSubtypes),
    "El enum de event.subtype del schema no coincide con el contrato."
  );
  assert(
    schema.$defs?.sections?.properties?.people?.$ref ===
      "#/$defs/peopleSection",
    "sections.people debe referenciar peopleSection."
  );
  assert(
    !schema.$defs?.sections?.required?.includes("people"),
    "sections.people debe permanecer opcional para configuraciones existentes."
  );
  assert(
    schema.$defs?.peopleSection?.properties?.enabled?.type === "boolean",
    "sections.people.enabled debe ser booleano."
  );
  assert(
    schema.$defs?.peopleSection?.properties?.groups?.minItems === 1,
    "Una sección people activa debe admitir al menos un grupo."
  );
  assert(
    schema.$defs?.peopleGroup?.properties?.people?.minItems === 1,
    "Cada grupo de people debe admitir al menos una persona."
  );
  assert(
    schema.$defs?.person?.required?.includes("name"),
    "Cada persona debe requerir name."
  );
  assert(
    schema.$defs?.sections?.properties?.details?.$ref ===
      "#/$defs/detailsSection",
    "sections.details debe referenciar detailsSection."
  );
  assert(
    schema.$defs?.detailsSection?.properties?.locations?.minItems === 1,
    "details.locations debe requerir al menos una ubicación cuando se declara."
  );
  assert(
    JSON.stringify(schema.$defs?.location?.required) === JSON.stringify([
      "kind",
      "label",
      "name",
      "dateDisplay",
      "timeDisplay",
      "address"
    ]),
    "El contrato de location no contiene los campos requeridos esperados."
  );
  assert(
    schema.$defs?.location?.properties?.mapsUrl?.$ref ===
      "#/$defs/httpsUrl",
    "location.mapsUrl debe aceptar exclusivamente HTTPS."
  );
  assert(
    schema.$defs?.branding?.properties?.palette?.$ref ===
      "#/$defs/themePalette",
    "branding.palette debe referenciar el contrato de paleta versionado."
  );
  assert(
    schema.$defs?.themePalette?.additionalProperties?.$ref ===
      "#/$defs/hexColor",
    "Los valores de branding.palette deben ser colores hexadecimales."
  );
  assert(
    schema.$defs?.branding?.properties?.header?.$ref ===
      "#/$defs/brandingHeader",
    "branding.header debe usar su contrato opcional."
  );
  assert(
    schema.$defs?.branding?.properties?.footer?.$ref ===
      "#/$defs/brandingFooter",
    "branding.footer debe usar su contrato opcional."
  );
}

async function validateEvermoreTheme(){
  let manifest;
  let shell;
  let genericShell;

  try{
    [manifest, shell, genericShell] = await Promise.all([
      readFile(path.join(evermoreThemeRoot, "manifest.json"), "utf8")
        .then(JSON.parse),
      readFile(path.join(evermoreThemeRoot, "shell.html"), "utf8"),
      readFile(path.join(projectRoot, "src", "invitation", "shell.html"), "utf8")
    ]);
    await Promise.all([
      readFile(path.join(evermoreThemeRoot, manifest.css), "utf8"),
      readFile(path.join(evermoreThemeRoot, manifest.script), "utf8")
    ]);
  }catch(error){
    failures.push(`No se pudo leer el tema Evermore: ${error.message}`);
    return;
  }

  assert(
    manifest.id === "evermore" &&
      manifest.shell === "shell.html" &&
      manifest.css === "theme.css" &&
      manifest.script === "theme.js",
    "El manifest de Evermore debe declarar su shell, CSS y script propios."
  );
  assert(
    manifest.runtimeOptions?.gateOptions?.openDelayMs > 0,
    "Evermore debe declarar el tiempo visual de apertura sin duplicar el gate."
  );

  const requiredShellTokens = [
    'id="gate"',
    'id="openInvite"',
    'id="heroNames"',
    'id="detailsList"',
    'id="scheduleList"',
    'id="galleryGrid"',
    'id="faqList"',
    'id="rsvpBtn"',
    "<!-- IF:calendar -->",
    "{{CALENDAR_HREF}}",
    "{{SOCIAL_META_TAGS}}",
    "{{THEME_SCRIPT}}",
    "{{RUNTIME_HREF}}"
  ];
  requiredShellTokens.forEach((token) => {
    assert(
      shell.includes(token),
      `El shell de Evermore no contiene el contrato requerido: ${token}.`
    );
  });
  assert(
    genericShell.includes("{{SOCIAL_META_TAGS}}"),
    "El shell genérico debe permitir metadatos sociales estáticos."
  );
  assert(
    !/<script(?![^>]*type=["']application\/json["'])[^>]*>\s*(?!<)/i.test(shell),
    "El shell de Evermore no debe incorporar lógica JavaScript inline."
  );
}

function validateSocialMetadataContract(){
  const amelia = createBaseConfig();
  amelia.slug = "amelia-y-nicolas";
  amelia.event.names = "Amelia & Nicolás";
  amelia.sharing = {
    url: "https://www.your-digital-event.com/events/amelia-y-nicolas",
    description: "Invitación a la boda de Amelia & Nicolás",
    image: "assets/share/card social.jpg",
    imageAlt: "Amelia y Nicolás"
  };

  const ameliaMetadata = createSocialMetadata(amelia);
  assert(
    ameliaMetadata.available &&
      ameliaMetadata.title === "Invitación • Amelia & Nicolás" &&
      ameliaMetadata.description === amelia.sharing.description &&
      ameliaMetadata.url === amelia.sharing.url &&
      ameliaMetadata.type === "website",
    "Los metadatos sociales deben derivar título y conservar descripción, URL y tipo."
  );
  assert(
    ameliaMetadata.image ===
      "https://www.your-digital-event.com/events/amelia-y-nicolas/assets/share/card%20social.jpg" &&
      ameliaMetadata.imageAlt === "Amelia y Nicolás" &&
      ameliaMetadata.twitterCard === "summary_large_image",
    "La imagen social debe resolverse como HTTPS absoluta y activar Twitter Card grande."
  );

  const sofia = createBaseConfig();
  sofia.slug = "sofia-y-carlos";
  sofia.event.names = "Sofía & Carlos";
  sofia.sharing = {
    url: "https://www.your-digital-event.com/events/sofia-y-carlos/",
    title: "La boda de Sofía & Carlos",
    description: "Acompáñanos a celebrar"
  };
  const sofiaMetadata = createSocialMetadata(sofia);
  assert(
    sofiaMetadata.title === sofia.sharing.title &&
      sofiaMetadata.url === sofia.sharing.url &&
      sofiaMetadata.description === sofia.sharing.description &&
      sofiaMetadata.image === "" &&
      sofiaMetadata.twitterCard === "summary",
    "Cada cliente debe conservar sus propios metadatos sin exigir una imagen social."
  );
  assert(
    !JSON.stringify(sofiaMetadata).includes("Amelia") &&
      !JSON.stringify(ameliaMetadata).includes("Sofía"),
    "Los metadatos de clientes diferentes no deben cruzarse."
  );

  const withoutSharing = createSocialMetadata(createBaseConfig());
  assert(
    withoutSharing.available === false,
    "Sin sharing no deben generarse metadatos sociales incompletos."
  );
}

function validateCalendarContract(){
  const config = createBaseConfig();
  config.event.date.endIso = "2027-01-10T18:00:00-06:00";
  config.event.venue.name = "Jardín, Norte";
  config.event.venue.address = "Calle Uno; número 2";
  config.sections.message = {
    enabled: true,
    title: "Mensaje",
    body: "Primera línea,\nsegunda línea; confirmada."
  };

  const calendar = createCalendarFile(config, {
    timestamp: new Date("2026-11-19T18:30:00Z")
  });
  assert(calendar.available, "El calendario debe generarse con un rango válido.");
  assert(
    calendar.fileName === "evento.ics" &&
      calendar.uid === "contract-test@your-digital-event.com",
    "El calendario debe usar un nombre predecible y un UID estable por evento."
  );
  assert(
    calendar.content.includes("DTSTART:20270110T180000Z\r\n") &&
      calendar.content.includes("DTEND:20270111T000000Z\r\n") &&
      calendar.content.includes("X-WR-TIMEZONE:America/Matamoros\r\n"),
    "El calendario debe convertir el rango ISO a UTC y conservar su zona IANA."
  );
  assert(
    calendar.content.includes("LOCATION:Jardín\\, Norte\\, Calle Uno\\; número 2") &&
      calendar.content.includes("Primera línea\\,\\nsegunda línea\\; confirmada."),
    "El calendario debe escapar ubicación, comas, punto y coma y saltos de línea."
  );
  assert(
    !calendar.content.replaceAll("\r\n", "").includes("\n") &&
      calendar.content.split("\r\n").every((line) =>
        Buffer.byteLength(line, "utf8") <= 75
      ),
    "El archivo ICS debe usar CRLF y plegar cada línea a un máximo de 75 octetos."
  );

  const sameEvent = createCalendarFile(config, {
    timestamp: new Date("2026-11-20T18:30:00Z")
  });
  assert(
    sameEvent.uid === calendar.uid,
    "El UID del calendario no debe cambiar entre generaciones."
  );

  const missingEnd = clone(config);
  delete missingEnd.event.date.endIso;
  const unavailable = createCalendarFile(missingEnd);
  assert(
    unavailable.available === false && unavailable.reason === "missing_end_iso",
    "Sin event.date.endIso no debe generarse un calendario ni mostrarse su botón."
  );
}

function validateRuntimeContract(){
  const existingShape = createBaseConfig();
  const existingValidation = validateConfig(existingShape);
  assert(
    existingValidation.valid,
    "Una configuración schemaVersion 1 sin subtype ni people debe seguir siendo válida."
  );

  const alba = createBaseConfig();
  alba.theme = "alba";
  alba.event.subtype = "baptism";
  assert(
    validateConfig(alba).valid,
    "El runtime debe aceptar Alba para celebraciones familiares."
  );

  const celeste = createBaseConfig();
  celeste.theme = "celeste";
  celeste.event.subtype = "baptism";
  celeste.branding.palette = {
    canvas: "#FBF8EE",
    accent: "#F6EDB3"
  };
  assert(
    validateConfig(celeste).valid,
    "El runtime debe aceptar Celeste con una paleta válida por evento."
  );
  assert(
    normalizeConfig(celeste).branding.palette.accent === "#F6EDB3",
    "El normalizador debe conservar la paleta validada."
  );

  const evermore = createBaseConfig();
  evermore.theme = "evermore";
  evermore.event.type = "wedding";
  evermore.event.date.endIso = "2027-01-11T00:00:00-06:00";
  evermore.event.tagline = "Acompáñanos a celebrar nuestra boda";
  evermore.sections.faq = {
    enabled: true,
    title: "Preguntas frecuentes",
    intro: "Información útil para nuestros invitados",
    items: [
      {
        question: "¿Puedo llevar acompañante?",
        answer: "Consulta los lugares incluidos en tu invitación."
      }
    ]
  };
  evermore.media.hero = {
    src: "assets/hero/portada.jpg",
    alt: "Retrato de la pareja"
  };
  evermore.sharing = {
    url: "https://www.your-digital-event.com/events/contract-test/",
    description: "Invitación a una boda de demostración"
  };
  assert(
    validateConfig(evermore).valid,
    "El runtime debe aceptar Evermore con calendario, FAQ y datos para compartir."
  );
  const normalizedEvermore = normalizeConfig(evermore);
  assert(
    normalizedEvermore.dateISO === evermore.event.date.iso &&
      normalizedEvermore.dateEndISO === evermore.event.date.endIso &&
      normalizedEvermore.timeZone === evermore.event.date.timeZone &&
      normalizedEvermore.sections.faq.items.length === 1,
    "Evermore debe conservar una sola fuente de fechas y normalizar su FAQ."
  );
  assert(
    normalizedEvermore.sharing.title === `Invitación • ${evermore.event.names}` &&
      normalizedEvermore.sharing.image === evermore.media.hero.src &&
      normalizedEvermore.sharing.imageAlt === evermore.media.hero.alt,
    "sharing debe derivar título e imagen sin duplicar datos del evento."
  );

  const invalidEndDate = clone(evermore);
  invalidEndDate.event.date.endIso = invalidEndDate.event.date.iso;
  assert(
    hasError(
      validateConfig(invalidEndDate),
      "event.date.endIso",
      "INVALID_DATE_RANGE"
    ),
    "event.date.endIso debe ser posterior a event.date.iso."
  );

  const malformedEndDate = clone(evermore);
  malformedEndDate.event.date.endIso = "2027-01-11";
  assert(
    hasError(
      validateConfig(malformedEndDate),
      "event.date.endIso",
      "INVALID_DATE"
    ),
    "event.date.endIso debe incluir hora y zona horaria."
  );

  const incompleteFaq = clone(evermore);
  incompleteFaq.sections.faq.items[0].answer = "";
  assert(
    hasError(
      validateConfig(incompleteFaq),
      "sections.faq.items.0.answer",
      "REQUIRED_FIELD"
    ),
    "Cada elemento FAQ debe requerir una respuesta."
  );

  const disabledFaq = createBaseConfig();
  disabledFaq.sections.faq = { enabled: false };
  assert(
    validateConfig(disabledFaq).valid,
    "Una sección FAQ desactivada no debe exigir contenido."
  );

  const unsafeSharingUrl = clone(evermore);
  unsafeSharingUrl.sharing.url = "http://example.com/invitacion";
  assert(
    hasError(
      validateConfig(unsafeSharingUrl),
      "sharing.url",
      "INVALID_URL_PROTOCOL"
    ),
    "sharing.url debe requerir HTTPS."
  );

  const incompleteSharingImage = clone(evermore);
  incompleteSharingImage.sharing.image = "assets/share/preview.jpg";
  assert(
    hasError(
      validateConfig(incompleteSharingImage),
      "sharing.imageAlt",
      "REQUIRED_FIELD"
    ),
    "Una imagen específica para compartir debe incluir texto alternativo."
  );

  const invalidPalette = clone(celeste);
  invalidPalette.branding.palette.accent = "amarillo";
  assert(
    hasError(
      validateConfig(invalidPalette),
      "branding.palette.accent",
      "INVALID_COLOR"
    ),
    "El runtime debe rechazar colores de paleta que no sean hexadecimales."
  );

  const customBranding = clone(celeste);
  customBranding.branding.header = { enabled: false };
  customBranding.branding.footer = {
    enabled: true,
    label: "Diseñado por",
    name: "Your Digital Event",
    url: "https://www.your-digital-event.com/",
    openInNewTab: true
  };
  assert(
    validateConfig(customBranding).valid,
    "Header desactivado y footer enlazado deben ser una configuración válida."
  );
  assert(
    normalizeConfig(customBranding).branding.header.enabled === false &&
      normalizeConfig(customBranding).branding.footer.openInNewTab === true,
    "El normalizador debe conservar la configuración declarativa de branding."
  );

  const disabledFooter = clone(celeste);
  disabledFooter.branding.footer = { enabled: false };
  assert(
    validateConfig(disabledFooter).valid,
    "Un footer desactivado no debe exigir contenido ni dejar de ser válido."
  );

  const unsafeFooter = clone(customBranding);
  unsafeFooter.branding.footer.url = "javascript:alert(1)";
  assert(
    hasError(
      validateConfig(unsafeFooter),
      "branding.footer.url",
      "INVALID_URL_PROTOCOL"
    ),
    "El footer debe rechazar URLs que no sean HTTPS."
  );

  for (const subtype of expectedSubtypes){
    const config = createBaseConfig();
    config.event.subtype = subtype;
    assert(
      validateConfig(config).valid,
      `event.subtype="${subtype}" debe ser válido con event.type="event".`
    );
  }

  const active = createBaseConfig();
  active.event.subtype = "baptism";
  active.sections.people = {
    enabled: true,
    title: "Con la bendición de",
    intro: "Nos acompañan en este momento tan especial",
    groups: [
      {
        label: "Familia",
        people: [
          {
            name: "Nombre completo",
            relation: "Mamá",
            image: "assets/people/persona.jpg"
          }
        ]
      }
    ]
  };
  assert(
    validateConfig(active).valid,
    "La configuración válida de baptism con people activo fue rechazada."
  );

  const normalizedActive = normalizeConfig(active);
  assert(
    normalizedActive.eventSubtype === "baptism" &&
      normalizedActive.sections.people.enabled === true &&
      normalizedActive.sections.people.groups.length === 1,
    "El normalizador no conserva subtype y people."
  );

  const disabled = createBaseConfig();
  disabled.event.subtype = "baptism";
  disabled.sections.people = { enabled: false };
  assert(
    validateConfig(disabled).valid,
    "people desactivado no debe exigir title, intro ni groups."
  );

  const normalizedExisting = normalizeConfig(createBaseConfig());
  assert(
    normalizedExisting.sections.people.enabled === false &&
      normalizedExisting.sections.people.groups.length === 0,
    "El normalizador debe crear un estado people desactivado para configs existentes."
  );
  assert(
    normalizedExisting.sections.faq.enabled === false &&
      normalizedExisting.sections.faq.items.length === 0 &&
      normalizedExisting.dateEndISO === "" &&
      normalizedExisting.sharing.url === "",
    "Los campos opcionales de Evermore no deben alterar configs existentes."
  );
  assert(
    normalizedExisting.sections.details.locations.length === 0 &&
      normalizedExisting.sections.details.venueName === "Lugar de prueba",
    "El lugar único existente debe conservarse como fallback de details."
  );

  const multiLocation = createBaseConfig();
  multiLocation.sections.details.locations = [
    {
      kind: "ceremony",
      label: "Ceremonia religiosa",
      name: "Parroquia de prueba",
      dateDisplay: "10 · Enero · 2027",
      timeDisplay: "10:00 AM",
      address: "Dirección de ceremonia",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=1%2C2"
    },
    {
      kind: "reception",
      label: "Recepción",
      name: "Salón de prueba",
      dateDisplay: "10 · Enero · 2027",
      timeDisplay: "12:00 PM",
      address: "Dirección de recepción",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=3%2C4"
    }
  ];
  assert(
    validateConfig(multiLocation).valid,
    "Una configuración con dos ubicaciones válidas fue rechazada."
  );
  const normalizedMultiLocation = normalizeConfig(multiLocation);
  assert(
    normalizedMultiLocation.sections.details.locations.length === 2 &&
      normalizedMultiLocation.sections.details.locations[0].kind === "ceremony" &&
      normalizedMultiLocation.sections.details.locations[1].kind === "reception",
    "El normalizador no conserva las ubicaciones ni su orden."
  );

  const singleLocation = clone(multiLocation);
  singleLocation.sections.details.locations =
    singleLocation.sections.details.locations.slice(0, 1);
  assert(
    validateConfig(singleLocation).valid,
    "details.locations debe aceptar una sola ubicación."
  );

  const detailsDisabled = createBaseConfig();
  detailsDisabled.sections.details = { enabled: false };
  assert(
    validateConfig(detailsDisabled).valid,
    "details desactivado debe seguir siendo válido sin locations."
  );

  const emptyLocations = clone(multiLocation);
  emptyLocations.sections.details.locations = [];
  assert(
    hasError(
      validateConfig(emptyLocations),
      "sections.details.locations",
      "REQUIRED_ITEMS"
    ),
    "details.locations declarado no debe aceptar un arreglo vacío."
  );

  const emptyLocationName = clone(multiLocation);
  emptyLocationName.sections.details.locations[0].name = "";
  assert(
    hasError(
      validateConfig(emptyLocationName),
      "sections.details.locations.0.name",
      "REQUIRED_FIELD"
    ),
    "Una ubicación vacía debe fallar de forma controlada."
  );

  const unsafeLocationUrl = clone(multiLocation);
  unsafeLocationUrl.sections.details.locations[0].mapsUrl =
    "javascript:alert(1)";
  assert(
    hasError(
      validateConfig(unsafeLocationUrl),
      "sections.details.locations.0.mapsUrl",
      "INVALID_URL_PROTOCOL"
    ),
    "location.mapsUrl debe bloquear protocolos peligrosos."
  );

  const insecureLocationUrl = clone(multiLocation);
  insecureLocationUrl.sections.details.locations[0].mapsUrl =
    "http://example.com/location";
  assert(
    hasError(
      validateConfig(insecureLocationUrl),
      "sections.details.locations.0.mapsUrl",
      "INVALID_URL_PROTOCOL"
    ),
    "location.mapsUrl debe requerir HTTPS."
  );

  const unknownSubtype = createBaseConfig();
  unknownSubtype.event.subtype = "unknown";
  const unknownValidation = validateConfig(unknownSubtype);
  assert(
    !unknownValidation.valid &&
      hasError(unknownValidation, "event.subtype", "INVALID_ENUM"),
    "Un subtype desconocido debe fallar."
  );

  const weddingSubtype = createBaseConfig();
  weddingSubtype.event.type = "wedding";
  weddingSubtype.event.subtype = "baptism";
  const weddingValidation = validateConfig(weddingSubtype);
  assert(
    !weddingValidation.valid &&
      hasError(
        weddingValidation,
        "event.subtype",
        "INVALID_SUBTYPE_FOR_TYPE"
      ),
    "event.subtype debe rechazarse cuando event.type no es event."
  );

  const missingGroups = clone(active);
  delete missingGroups.sections.people.groups;
  assert(
    hasError(
      validateConfig(missingGroups),
      "sections.people.groups",
      "REQUIRED_ITEMS"
    ),
    "people activo debe requerir groups."
  );

  const emptyPeople = clone(active);
  emptyPeople.sections.people.groups[0].people = [];
  assert(
    hasError(
      validateConfig(emptyPeople),
      "sections.people.groups.0.people",
      "REQUIRED_ITEMS"
    ),
    "Cada grupo debe requerir al menos una persona."
  );

  const missingName = clone(active);
  missingName.sections.people.groups[0].people[0].name = "";
  assert(
    hasError(
      validateConfig(missingName),
      "sections.people.groups.0.people.0.name",
      "REQUIRED_FIELD"
    ),
    "Cada persona debe requerir name."
  );

  const unsafeImage = clone(active);
  unsafeImage.sections.people.groups[0].people[0].image = "../private.jpg";
  assert(
    hasError(
      validateConfig(unsafeImage),
      "sections.people.groups.0.people.0.image",
      "UNSAFE_ASSET_PATH"
    ),
    "Las imágenes de people deben bloquear traversal."
  );

  const legacy = {
    slug: "legacy-contract-test",
    template: "eclipse",
    eventType: "event",
    eventSubtype: "baptism",
    names: "Evento legacy",
    dateISO: "2027-01-10T12:00:00-06:00",
    dateEndISO: "2027-01-10T18:00:00-06:00",
    dateDisplay: "10 · Enero · 2027",
    timeDisplay: "12:00 PM",
    venueName: "Lugar de prueba",
    addressLine: "Dirección de prueba",
    people: {
      enabled: true,
      title: "Con la bendición de",
      intro: "Nos acompañan",
      groups: [
        {
          label: "Familia",
          people: [{ name: "Nombre completo" }]
        }
      ]
    },
    branding: {
      footerText: "Your Digital Event"
    }
  };
  const migrated = migrateConfig(legacy);
  assert(
    migrated.migrated &&
      migrated.config.event.subtype === "baptism" &&
      migrated.config.sections.people.enabled &&
      migrated.config.event.date.endIso === legacy.dateEndISO,
    "La migración legacy debe centralizar subtype y people."
  );
  assert(
    validateConfig(migrated.config).valid,
    "La configuración legacy de prueba debe ser válida después de migrarse."
  );
}

async function main(){
  await Promise.all([
    validateSchemaDocument(),
    validateEvermoreTheme()
  ]);
  validateRuntimeContract();
  validateCalendarContract();
  validateSocialMetadataContract();

  if (failures.length > 0){
    console.error(`Contrato inválido (${failures.length} error(es)):`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    `✓ Contrato de configuración válido: ${expectedSubtypes.length} ` +
    "subtipos, Evermore, FAQ, calendario y datos para compartir."
  );
}

main().catch((error) => {
  console.error(`Validación de contrato cancelada: ${error.message}`);
  process.exitCode = 1;
});
