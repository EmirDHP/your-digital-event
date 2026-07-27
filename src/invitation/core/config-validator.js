const KNOWN_THEMES = new Set([
  "aura",
  "eclipse",
  "ivory",
  "blush",
  "regal",
  "alba",
  "celeste"
]);
const EVENT_TYPES = new Set(["wedding", "xv", "event"]);
const EVENT_SUBTYPES = new Set([
  "baptism",
  "babyShower",
  "presentation",
  "firstBirthday",
  "communion",
  "kidsParty",
  "familyCelebration",
  "other"
]);
const SECTION_NAMES = [
  "message",
  "countdown",
  "details",
  "schedule",
  "story",
  "gallery",
  "dressCode",
  "gifts",
  "rsvp",
  "music"
];
const GIFT_TYPES = new Set(["sobre", "transfer", "wishlist"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCATION_KIND_PATTERN = /^[a-z][A-Za-z0-9-]*$/;
const ISO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function asObject(value){
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function hasText(value){
  return typeof value === "string" && value.trim().length > 0;
}

function addIssue(collection, path, code, message){
  collection.push({ path, code, message });
}

function requireObject(value, path, errors){
  const object = asObject(value);
  if (!object){
    addIssue(errors, path, "INVALID_TYPE", "Debe ser un objeto.");
  }
  return object;
}

function requireText(value, path, errors){
  if (!hasText(value)){
    addIssue(errors, path, "REQUIRED_FIELD", "Debe contener texto.");
    return false;
  }
  return true;
}

function isSafeAssetPath(value){
  if (!hasText(value)) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  if (/^[\\/]/.test(value) || value.includes("\\")) return false;
  try{
    return !decodeURIComponent(value).split("/").includes("..");
  }catch{
    return false;
  }
}

function validateAssetPath(value, path, errors){
  if (!isSafeAssetPath(value)){
    addIssue(
      errors,
      path,
      "UNSAFE_ASSET_PATH",
      "Debe ser una ruta relativa segura y no puede contener '..'."
    );
  }
}

function isAllowedUrl(value, { httpsOnly = false } = {}){
  if (!hasText(value)) return false;
  try{
    const url = new URL(value);
    return httpsOnly
      ? url.protocol === "https:"
      : url.protocol === "https:" || url.protocol === "http:";
  }catch{
    return false;
  }
}

function validateUrl(value, path, errors, options){
  if (!isAllowedUrl(value, options)){
    addIssue(
      errors,
      path,
      "INVALID_URL_PROTOCOL",
      options?.httpsOnly
        ? "Debe ser una URL HTTPS válida."
        : "Debe ser una URL HTTP o HTTPS válida."
    );
  }
}

function isValidIsoDate(value){
  const match = typeof value === "string" ? value.match(ISO_PATTERN) : null;
  if (!match || !Number.isFinite(Date.parse(value))) return false;

  const [, year, month, day, hour, minute, second = "0", zone] = match;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const maxDay = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();

  if (monthNumber < 1 || monthNumber > 12) return false;
  if (dayNumber < 1 || dayNumber > maxDay) return false;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;

  if (zone !== "Z"){
    const [offsetHour, offsetMinute] = zone.slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }

  return true;
}

function isValidTimeZone(value){
  if (!hasText(value)) return false;
  try{
    new Intl.DateTimeFormat("es-MX", { timeZone: value }).format();
    return true;
  }catch{
    return false;
  }
}

function normalizeDisplay(value){
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function validateDateDisplay(date, warnings){
  if (!isValidIsoDate(date.iso) || !hasText(date.display)) return;

  const isoMatch = date.iso.match(ISO_PATTERN);
  const isoYear = Number(isoMatch[1]);
  const isoMonth = Number(isoMatch[2]);
  const isoDay = Number(isoMatch[3]);
  const display = normalizeDisplay(date.display);
  const displayedYear = display.match(/\b(19|20)\d{2}\b/)?.[0];
  const displayedDay = display.match(/\b([1-9]|[12]\d|3[01])\b/)?.[0];
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  const displayedMonth = months.findIndex((month) => display.includes(month)) + 1;
  const mismatches = [];

  if (displayedYear && Number(displayedYear) !== isoYear) mismatches.push("año");
  if (displayedDay && Number(displayedDay) !== isoDay) mismatches.push("día");
  if (displayedMonth && displayedMonth !== isoMonth) mismatches.push("mes");

  if (mismatches.length > 0){
    addIssue(
      warnings,
      "event.date.display",
      "DATE_DISPLAY_MISMATCH",
      `La fecha editorial parece no coincidir con date.iso (${mismatches.join(", ")}).`
    );
  }
}

function validateEvent(event, errors, warnings){
  const value = requireObject(event, "event", errors);
  if (!value) return;

  if (!EVENT_TYPES.has(value.type)){
    addIssue(errors, "event.type", "INVALID_ENUM", "El tipo de evento no es válido.");
  }
  if (value.subtype !== undefined){
    if (!EVENT_SUBTYPES.has(value.subtype)){
      addIssue(
        errors,
        "event.subtype",
        "INVALID_ENUM",
        "El subtipo de evento no es válido."
      );
    }else if (value.type !== "event"){
      addIssue(
        errors,
        "event.subtype",
        "INVALID_SUBTYPE_FOR_TYPE",
        "event.subtype solo puede utilizarse cuando event.type es \"event\"."
      );
    }
  }
  requireText(value.names, "event.names", errors);

  const date = requireObject(value.date, "event.date", errors);
  if (date){
    if (!isValidIsoDate(date.iso)){
      addIssue(errors, "event.date.iso", "INVALID_DATE", "Debe ser una fecha ISO válida con zona horaria.");
    }
    if (!isValidTimeZone(date.timeZone)){
      addIssue(errors, "event.date.timeZone", "INVALID_TIME_ZONE", "Debe ser una zona horaria IANA válida.");
    }
    requireText(date.display, "event.date.display", errors);
    requireText(date.timeDisplay, "event.date.timeDisplay", errors);
    validateDateDisplay(date, warnings);
  }

  const venue = requireObject(value.venue, "event.venue", errors);
  if (venue){
    requireText(venue.name, "event.venue.name", errors);
    requireText(venue.address, "event.venue.address", errors);
    if (venue.mapsUrl !== undefined){
      validateUrl(venue.mapsUrl, "event.venue.mapsUrl", errors);
    }
  }
}

function validateEnabledSection(section, path, errors){
  const value = requireObject(section, path, errors);
  if (!value) return null;
  if (typeof value.enabled !== "boolean"){
    addIssue(errors, `${path}.enabled`, "REQUIRED_FIELD", "Debe declarar enabled como booleano.");
    return null;
  }
  return value;
}

function validateItems(items, path, errors, callback){
  if (!Array.isArray(items) || items.length === 0){
    addIssue(errors, path, "REQUIRED_ITEMS", "Debe contener al menos un elemento.");
    return;
  }
  items.forEach((item, index) => callback(item, `${path}.${index}`, errors));
}

function validateSections(sections, errors){
  const value = requireObject(sections, "sections", errors);
  if (!value) return;

  SECTION_NAMES.forEach((name) => {
    if (!(name in value)){
      addIssue(errors, `sections.${name}`, "REQUIRED_SECTION", "La sección debe estar declarada.");
    }
  });

  const message = validateEnabledSection(value.message, "sections.message", errors);
  if (message?.enabled){
    requireText(message.title, "sections.message.title", errors);
    requireText(message.body, "sections.message.body", errors);
  }

  if (value.people !== undefined){
    const people = validateEnabledSection(
      value.people,
      "sections.people",
      errors
    );
    if (people?.enabled){
      requireText(people.title, "sections.people.title", errors);
      requireText(people.intro, "sections.people.intro", errors);
      validateItems(
        people.groups,
        "sections.people.groups",
        errors,
        (group, groupPath) => {
          const currentGroup = requireObject(group, groupPath, errors);
          if (!currentGroup) return;
          requireText(currentGroup.label, `${groupPath}.label`, errors);
          validateItems(
            currentGroup.people,
            `${groupPath}.people`,
            errors,
            (person, personPath) => {
              const currentPerson = requireObject(person, personPath, errors);
              if (!currentPerson) return;
              requireText(currentPerson.name, `${personPath}.name`, errors);
              if (currentPerson.relation !== undefined){
                requireText(
                  currentPerson.relation,
                  `${personPath}.relation`,
                  errors
                );
              }
              if (currentPerson.image !== undefined){
                validateAssetPath(
                  currentPerson.image,
                  `${personPath}.image`,
                  errors
                );
              }
            }
          );
        }
      );
    }
  }

  validateEnabledSection(value.countdown, "sections.countdown", errors);

  const details = validateEnabledSection(
    value.details,
    "sections.details",
    errors
  );
  if (details?.locations !== undefined){
    validateItems(
      details.locations,
      "sections.details.locations",
      errors,
      (item, path) => {
        const location = requireObject(item, path, errors);
        if (!location) return;

        if (
          !requireText(location.kind, `${path}.kind`, errors) ||
          !LOCATION_KIND_PATTERN.test(location.kind)
        ){
          if (hasText(location.kind)){
            addIssue(
              errors,
              `${path}.kind`,
              "INVALID_LOCATION_KIND",
              "Debe usar un identificador simple que comience con una letra minúscula."
            );
          }
        }

        requireText(location.label, `${path}.label`, errors);
        requireText(location.name, `${path}.name`, errors);
        requireText(location.dateDisplay, `${path}.dateDisplay`, errors);
        requireText(location.timeDisplay, `${path}.timeDisplay`, errors);
        requireText(location.address, `${path}.address`, errors);

        if (location.mapsUrl !== undefined){
          validateUrl(
            location.mapsUrl,
            `${path}.mapsUrl`,
            errors,
            { httpsOnly: true }
          );
        }
      }
    );
  }

  const schedule = validateEnabledSection(value.schedule, "sections.schedule", errors);
  if (schedule?.enabled){
    validateItems(schedule.items, "sections.schedule.items", errors, (item, path) => {
      const current = requireObject(item, path, errors);
      if (!current) return;
      requireText(current.time, `${path}.time`, errors);
      requireText(current.title, `${path}.title`, errors);
    });
  }

  const story = validateEnabledSection(value.story, "sections.story", errors);
  if (story?.enabled){
    requireText(story.title, "sections.story.title", errors);
    requireText(story.subtitle, "sections.story.subtitle", errors);
    validateItems(story.items, "sections.story.items", errors, (item, path) => {
      const current = requireObject(item, path, errors);
      if (!current) return;
      requireText(current.title, `${path}.title`, errors);
      requireText(current.text, `${path}.text`, errors);
      if (current.image !== undefined){
        validateAssetPath(current.image, `${path}.image`, errors);
        requireText(current.alt, `${path}.alt`, errors);
      }
    });
  }

  const gallery = validateEnabledSection(value.gallery, "sections.gallery", errors);
  if (gallery?.enabled){
    validateItems(gallery.items, "sections.gallery.items", errors, (item, path) => {
      const current = requireObject(item, path, errors);
      if (!current) return;
      const sources = ["thumb", "full", "src"].filter((key) => current[key] !== undefined);
      if (sources.length === 0){
        addIssue(errors, path, "REQUIRED_IMAGE_SOURCE", "Debe declarar thumb, full o src.");
      }
      sources.forEach((key) => validateAssetPath(current[key], `${path}.${key}`, errors));
      requireText(current.alt, `${path}.alt`, errors);
    });
  }

  const dressCode = validateEnabledSection(value.dressCode, "sections.dressCode", errors);
  if (dressCode?.enabled){
    requireText(dressCode.text, "sections.dressCode.text", errors);
  }

  const gifts = validateEnabledSection(value.gifts, "sections.gifts", errors);
  if (gifts?.enabled){
    requireText(gifts.title, "sections.gifts.title", errors);
    requireText(gifts.intro, "sections.gifts.intro", errors);
    validateItems(gifts.options, "sections.gifts.options", errors, (item, path) => {
      const option = requireObject(item, path, errors);
      if (!option) return;
      if (!GIFT_TYPES.has(option.type)){
        addIssue(errors, `${path}.type`, "INVALID_ENUM", "El tipo de regalo no es válido.");
        return;
      }
      requireText(option.label, `${path}.label`, errors);
      if (option.type === "sobre"){
        requireText(option.text, `${path}.text`, errors);
      }else if (option.type === "transfer"){
        requireText(option.bank, `${path}.bank`, errors);
        requireText(option.holder, `${path}.holder`, errors);
        if (!/^\d{18}$/.test(String(option.clabe || ""))){
          addIssue(errors, `${path}.clabe`, "INVALID_CLABE", "Debe contener exactamente 18 dígitos.");
        }
      }else if (option.type === "wishlist"){
        validateUrl(option.url, `${path}.url`, errors, { httpsOnly: true });
      }
    });
  }

  const rsvp = validateEnabledSection(value.rsvp, "sections.rsvp", errors);
  if (rsvp?.enabled){
    if (rsvp.channel !== "whatsapp"){
      addIssue(errors, "sections.rsvp.channel", "INVALID_ENUM", "El canal RSVP no es válido.");
    }
    if (!/^\d{8,15}$/.test(String(rsvp.number || ""))){
      addIssue(errors, "sections.rsvp.number", "INVALID_PHONE", "Debe contener entre 8 y 15 dígitos.");
    }
    requireText(rsvp.message, "sections.rsvp.message", errors);
  }

  const music = validateEnabledSection(value.music, "sections.music", errors);
  if (music?.enabled){
    validateAssetPath(music.src, "sections.music.src", errors);
  }
}

function validateMedia(media, errors){
  const value = requireObject(media, "media", errors);
  if (!value || value.hero === undefined) return;
  const hero = requireObject(value.hero, "media.hero", errors);
  if (!hero) return;
  validateAssetPath(hero.src, "media.hero.src", errors);
  requireText(hero.alt, "media.hero.alt", errors);
}

function validateBranding(branding, errors){
  const value = requireObject(branding, "branding", errors);
  if (value) requireText(value.footerText, "branding.footerText", errors);
}

export function validateConfig(config){
  const errors = [];
  const warnings = [];
  const root = requireObject(config, "", errors);

  if (!root) return { valid: false, errors, warnings };

  if (root.schemaVersion !== 1){
    addIssue(errors, "schemaVersion", "UNSUPPORTED_SCHEMA_VERSION", "Debe ser schemaVersion 1.");
  }
  if (!SLUG_PATTERN.test(String(root.slug || ""))){
    addIssue(errors, "slug", "INVALID_SLUG", "Debe usar minúsculas, números y guiones.");
  }
  if (
    root.language !== undefined &&
    !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(String(root.language))
  ){
    addIssue(errors, "language", "INVALID_LANGUAGE", "Debe ser una etiqueta de idioma válida.");
  }
  if (!KNOWN_THEMES.has(root.theme)){
    addIssue(errors, "theme", "UNKNOWN_THEME", "El tema no está registrado.");
  }

  validateEvent(root.event, errors, warnings);
  validateSections(root.sections, errors);
  validateMedia(root.media, errors);
  validateBranding(root.branding, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
