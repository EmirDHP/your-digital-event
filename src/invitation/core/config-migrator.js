const CURRENT_SCHEMA_VERSION = 1;
const DEFAULT_TIME_ZONE = "America/Matamoros";

function asObject(value){
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value){
  return Array.isArray(value) ? value : [];
}

function hasText(value){
  return typeof value === "string" && value.trim().length > 0;
}

function slugify(value){
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " y ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTheme(template){
  const value = String(template || "").toLowerCase();
  const knownThemes = [
    "aura",
    "eclipse",
    "ivory",
    "blush",
    "regal",
    "alba",
    "celeste"
  ];
  return knownThemes.find((theme) => value === theme || value.startsWith(`${theme}-`))
    || value;
}

function getEventType(eventType){
  const value = String(eventType || "").toLowerCase();
  if (["boda", "bodas", "wedding"].includes(value)) return "wedding";
  if (["xv", "quince", "quinceanera", "quinceañera"].includes(value)) return "xv";
  if (["event", "evento", "eventos"].includes(value)) return "event";
  return value;
}

function migrateLegacyStory(rawStory, names){
  const story = asObject(rawStory);
  const items = asArray(story.items).map((item) => {
    const source = asObject(item);
    const migrated = {
      title: source.title ?? "",
      text: source.text ?? ""
    };

    if (hasText(source.image)){
      migrated.image = source.image;
      migrated.alt = source.alt || source.title || names;
    }

    return migrated;
  });

  return {
    enabled: story.enabled !== false && items.length > 0,
    ...(hasText(story.title) ? { title: story.title } : {}),
    ...(hasText(story.subtitle) ? { subtitle: story.subtitle } : {}),
    ...(items.length > 0 ? { items } : {})
  };
}

function migrateLegacyGallery(rawGallery){
  const items = asArray(rawGallery).map((item) => {
    const source = asObject(item);
    return {
      ...(hasText(source.thumb) ? { thumb: source.thumb } : {}),
      ...(hasText(source.full) ? { full: source.full } : {}),
      ...(hasText(source.src) ? { src: source.src } : {}),
      alt: source.alt ?? ""
    };
  });

  return {
    enabled: items.length > 0,
    ...(items.length > 0 ? { items } : {})
  };
}

function migrateLegacyPeople(rawPeople){
  const people = asObject(rawPeople);
  const groups = asArray(people.groups).map((group) => {
    const sourceGroup = asObject(group);
    return {
      label: sourceGroup.label ?? "",
      people: asArray(sourceGroup.people).map((person) => {
        const sourcePerson = asObject(person);
        return {
          name: sourcePerson.name ?? "",
          ...(hasText(sourcePerson.relation)
            ? { relation: sourcePerson.relation }
            : {}),
          ...(hasText(sourcePerson.image)
            ? { image: sourcePerson.image }
            : {})
        };
      })
    };
  });
  const enabled = people.enabled !== false && groups.length > 0;

  return {
    enabled,
    ...(hasText(people.title) ? { title: people.title } : {}),
    ...(hasText(people.intro) ? { intro: people.intro } : {}),
    ...(groups.length > 0 ? { groups } : {})
  };
}

function migrateLegacyGifts(rawGifts){
  const gifts = asObject(rawGifts);
  const options = asArray(gifts.options);

  return {
    enabled: gifts.enabled !== false && options.length > 0,
    ...(hasText(gifts.title) ? { title: gifts.title } : {}),
    ...(hasText(gifts.intro) ? { intro: gifts.intro } : {}),
    ...(options.length > 0 ? { options } : {})
  };
}

function migrateLegacyRsvp(rawRsvp){
  const rsvp = asObject(rawRsvp);
  const number = String(rsvp.whatsappNumber || "").replace(/\D/g, "");
  const message = rsvp.whatsappMessage;
  const enabled = rsvp.enabled !== false && (hasText(number) || hasText(message));

  return {
    enabled,
    ...(enabled ? {
      channel: "whatsapp",
      number,
      message: message ?? ""
    } : {})
  };
}

function migrateLegacyMusic(rawMusic){
  const music = asObject(rawMusic);
  const enabled = music.enabled !== false && hasText(music.src);

  return {
    enabled,
    ...(hasText(music.src) ? { src: music.src } : {}),
    ...(hasText(music.label) ? { label: music.label } : {})
  };
}

function migrateLegacyConfig(rawConfig){
  const raw = asObject(rawConfig);
  const names = raw.names ?? "";
  const scheduleItems = asArray(raw.schedule);
  const messageEnabled = hasText(raw.messageTitle) || hasText(raw.messageBody);
  const detailsEnabled = [
    raw.dateDisplay,
    raw.timeDisplay,
    raw.venueName,
    raw.addressLine,
    raw.mapsUrl
  ].some(hasText);

  const media = {};
  if (hasText(raw.heroImage)){
    media.hero = {
      src: raw.heroImage,
      alt: names
    };
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    slug: slugify(raw.slug || names),
    theme: getTheme(raw.template || raw.theme),
    event: {
      type: getEventType(raw.eventType),
      ...(hasText(raw.eventSubtype || raw.subtype)
        ? { subtype: raw.eventSubtype || raw.subtype }
        : {}),
      names,
      tagline: raw.tagline ?? "",
      date: {
        iso: raw.dateISO ?? "",
        timeZone: raw.timeZone || DEFAULT_TIME_ZONE,
        display: raw.dateDisplay ?? "",
        timeDisplay: raw.timeDisplay ?? ""
      },
      venue: {
        name: raw.venueName ?? "",
        address: raw.addressLine ?? "",
        ...(hasText(raw.mapsUrl) ? { mapsUrl: raw.mapsUrl } : {})
      }
    },
    sections: {
      message: {
        enabled: messageEnabled,
        ...(hasText(raw.messageTitle) ? { title: raw.messageTitle } : {}),
        ...(hasText(raw.messageBody) ? { body: raw.messageBody } : {})
      },
      people: migrateLegacyPeople(raw.people),
      countdown: {
        enabled: hasText(raw.dateISO)
      },
      details: {
        enabled: detailsEnabled
      },
      schedule: {
        enabled: scheduleItems.length > 0,
        ...(scheduleItems.length > 0 ? { items: scheduleItems } : {})
      },
      story: migrateLegacyStory(raw.story, names),
      gallery: migrateLegacyGallery(raw.gallery),
      dressCode: {
        enabled: hasText(raw.dressCode),
        ...(hasText(raw.dressCode) ? { text: raw.dressCode } : {})
      },
      gifts: migrateLegacyGifts(raw.gifts),
      rsvp: migrateLegacyRsvp(raw.rsvp),
      music: migrateLegacyMusic(raw.music)
    },
    media,
    branding: {
      footerText: asObject(raw.branding).footerText ?? ""
    }
  };
}

export class UnsupportedSchemaVersionError extends Error {
  constructor(version){
    super("La versión de configuración no es compatible.");
    this.name = "UnsupportedSchemaVersionError";
    this.code = "UNSUPPORTED_SCHEMA_VERSION";
    this.version = version;
  }
}

export function migrateConfig(rawConfig){
  const raw = asObject(rawConfig);
  const version = raw.schemaVersion;

  if (version === CURRENT_SCHEMA_VERSION){
    return {
      config: raw,
      migrated: false,
      sourceVersion: CURRENT_SCHEMA_VERSION
    };
  }

  if (version === undefined || version === null){
    return {
      config: migrateLegacyConfig(raw),
      migrated: true,
      sourceVersion: 0
    };
  }

  throw new UnsupportedSchemaVersionError(version);
}
