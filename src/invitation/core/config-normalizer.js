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
  const sharing = asObject(config.sharing);
  const people = asObject(sections.people);
  const details = asObject(sections.details);
  const faq = asObject(sections.faq);

  return {
    schemaVersion: config.schemaVersion,
    slug: config.slug,
    theme: config.theme,
    eventType: event.type,
    eventSubtype: event.subtype,
    names: event.names,
    tagline: event.tagline ?? "",
    dateISO: date.iso,
    dateEndISO: date.endIso ?? "",
    timeZone: date.timeZone,
    heroImage: hero.src ?? "",
    branding: asObject(config.branding),
    sharing: {
      ...sharing,
      url: sharing.url ?? "",
      title: sharing.title ?? `Invitación • ${event.names ?? ""}`,
      description: sharing.description ?? event.tagline ?? "",
      image: sharing.image ?? hero.src ?? "",
      imageAlt: sharing.imageAlt ?? hero.alt ?? event.names ?? ""
    },

    sections: {
      message: { ...asObject(sections.message) },
      people: {
        ...people,
        enabled: people.enabled === true,
        groups: asArray(people.groups).map((group) => {
          const currentGroup = asObject(group);
          return {
            ...currentGroup,
            people: asArray(currentGroup.people).map((person) => ({
              ...asObject(person)
            }))
          };
        })
      },
      countdown: { ...asObject(sections.countdown) },
      details: {
        ...details,
        dateDisplay: date.display,
        timeDisplay: date.timeDisplay,
        venueName: venue.name,
        addressLine: venue.address,
        mapsUrl: venue.mapsUrl ?? "",
        locations: asArray(details.locations).map((location) => ({
          ...asObject(location),
          mapsUrl: asObject(location).mapsUrl ?? ""
        }))
      },
      schedule: {
        ...asObject(sections.schedule),
        items: asArray(asObject(sections.schedule).items)
      },
      faq: {
        ...faq,
        enabled: faq.enabled === true,
        items: asArray(faq.items).map((item) => ({
          ...asObject(item)
        }))
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
