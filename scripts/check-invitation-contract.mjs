import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { migrateConfig } from "../src/invitation/core/config-migrator.js";
import { normalizeConfig } from "../src/invitation/core/config-normalizer.js";
import { validateConfig } from "../src/invitation/core/config-validator.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const schemaPath = path.join(projectRoot, "schemas", "event.schema.json");
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
  assert(
    validateConfig(celeste).valid,
    "El runtime debe aceptar Celeste para celebraciones familiares."
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
      migrated.config.sections.people.enabled,
    "La migración legacy debe centralizar subtype y people."
  );
  assert(
    validateConfig(migrated.config).valid,
    "La configuración legacy de prueba debe ser válida después de migrarse."
  );
}

async function main(){
  await validateSchemaDocument();
  validateRuntimeContract();

  if (failures.length > 0){
    console.error(`Contrato inválido (${failures.length} error(es)):`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    `✓ Contrato de configuración válido: ${expectedSubtypes.length} ` +
    "subtipos, sections.people y details.locations."
  );
}

main().catch((error) => {
  console.error(`Validación de contrato cancelada: ${error.message}`);
  process.exitCode = 1;
});
