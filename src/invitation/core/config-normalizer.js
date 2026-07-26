function asObject(value){
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value){
  return Array.isArray(value) ? value : [];
}

export function normalizeConfig(config){
  const event = asObject(config.event);
  const date = asObject(event.date);
  const venue = asObject(event.venue);
  const sections = asObject(config.sections);
  const media = asObject(config.media);
  const hero = asObject(media.hero);

  return {
    schemaVersion: config.schemaVersion,
    slug: config.slug,
    theme: config.theme,
    eventType: event.type,
    names: event.names,
    tagline: event.tagline ?? "",
    dateISO: date.iso,
    heroImage: hero.src ?? "",
    branding: asObject(config.branding),

    sections: {
      message: { ...asObject(sections.message) },
      countdown: { ...asObject(sections.countdown) },
      details: {
        ...asObject(sections.details),
        dateDisplay: date.display,
        timeDisplay: date.timeDisplay,
        venueName: venue.name,
        addressLine: venue.address,
        mapsUrl: venue.mapsUrl ?? ""
      },
      schedule: {
        ...asObject(sections.schedule),
        items: asArray(asObject(sections.schedule).items)
      },
      story: {
        ...asObject(sections.story),
        items: asArray(asObject(sections.story).items)
      },
      gallery: {
        ...asObject(sections.gallery),
        items: asArray(asObject(sections.gallery).items)
      },
      dressCode: { ...asObject(sections.dressCode) },
      gifts: {
        ...asObject(sections.gifts),
        options: asArray(asObject(sections.gifts).options)
      },
      rsvp: {
        ...asObject(sections.rsvp),
        whatsappNumber: asObject(sections.rsvp).number,
        whatsappMessage: asObject(sections.rsvp).message
      },
      music: { ...asObject(sections.music) }
    }
  };
}

