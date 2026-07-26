import { loadConfig } from "./config-loader.js";
import { migrateConfig } from "./config-migrator.js";
import { normalizeConfig } from "./config-normalizer.js";
import { validateConfig } from "./config-validator.js";
import {
  byId,
  safeText,
  setDocumentTitle,
  setHeroImage
} from "./dom.js";
import { getSafeHttpUrl } from "./external-url.js";
import {
  setElementAvailability,
  setSectionAvailability
} from "./navigation.js";
import { initGate, scheduleHeroRevealFallback } from "./gate.js";
import { startCountdown } from "./countdown.js";
import { initMusic, tryAutoplayMusic } from "./music.js";
import { initHeroParallax, initRevealAnimations } from "./reveal.js";
import { renderSchedule } from "../sections/schedule.js";
import { renderStory } from "../sections/story.js";
import { getGalleryItems, renderGallery } from "../sections/gallery.js";
import { createLightboxController } from "../sections/lightbox.js";
import { renderGifts } from "../sections/gifts.js";
import { initRsvp } from "../sections/rsvp.js";

let startPromise = null;

async function initializeInvitation(options){
  scheduleHeroRevealFallback();

  const rawConfig = await loadConfig(options.configUrl || "config.json");
  const migration = migrateConfig(rawConfig);
  const validation = validateConfig(migration.config);

  if (validation.warnings.length > 0){
    console.warn("Advertencias de configuración:", validation.warnings);
  }

  if (!validation.valid){
    const error = new Error("La configuración del evento no es válida.");
    error.name = "ConfigValidationError";
    error.validation = validation;
    throw error;
  }

  const config = normalizeConfig(migration.config);
  const sections = config.sections;
  const lightbox = createLightboxController({ getItems: getGalleryItems });

  safeText(byId("gateNames"), config.names);
  safeText(byId("gateDate"), sections.details.dateDisplay);

  safeText(byId("tagline"), config.tagline);
  safeText(byId("heroNames"), config.names);
  safeText(byId("heroDate"), sections.details.dateDisplay);
  safeText(byId("heroTime"), sections.details.timeDisplay);

  safeText(byId("msgTitle"), sections.message.title);
  safeText(byId("msgBody"), sections.message.body);
  setElementAvailability(
    byId("msgTitle")?.closest(".section"),
    sections.message.enabled
  );

  safeText(byId("detailsDate"), sections.details.dateDisplay);
  safeText(byId("detailsTime"), sections.details.timeDisplay);
  safeText(byId("detailsVenue"), sections.details.venueName);
  safeText(byId("detailsAddr"), sections.details.addressLine);
  setSectionAvailability("detalles", sections.details.enabled);

  const mapsLink = byId("mapsLink");
  if (mapsLink){
    const mapsUrl = getSafeHttpUrl(sections.details.mapsUrl);
    mapsLink.hidden = !mapsUrl;
    if (mapsUrl) mapsLink.href = mapsUrl;
    else mapsLink.removeAttribute("href");
  }

  safeText(byId("dressCode"), sections.dressCode.text);
  setElementAvailability(
    byId("dressCode")?.closest(".section"),
    sections.dressCode.enabled
  );
  safeText(byId("footerText"), config.branding?.footerText);

  setDocumentTitle(config.names);
  setHeroImage(config.heroImage, {
    preserveEmptyState: Boolean(options.preserveEmptyHeroState)
  });
  setElementAvailability(
    document.querySelector(".countdown"),
    sections.countdown.enabled
  );

  if (sections.schedule.enabled) renderSchedule(sections.schedule.items);
  setSectionAvailability("itinerario", sections.schedule.enabled);

  renderStory(sections.story);
  setSectionAvailability("historia", sections.story.enabled);

  if (sections.gallery.enabled){
    renderGallery(sections.gallery.items, { openLightbox: lightbox.open });
  }
  setSectionAvailability("galeria", sections.gallery.enabled);

  renderGifts(sections.gifts);
  setSectionAvailability("regalos", sections.gifts.enabled);

  initRevealAnimations(options.revealProfile);
  initHeroParallax();

  if (sections.gallery.enabled) lightbox.init();
  initMusic(sections.music);
  initGate({ tryAutoplay: tryAutoplayMusic });
  initRsvp(sections.rsvp);

  if (sections.countdown.enabled && config.dateISO){
    startCountdown(config.dateISO);
  }
}

function reportInitializationError(error){
  if (error?.validation){
    console.error("Configuración inválida:", error.validation);
  }else if (
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  ){
    console.error("No se pudo inicializar la invitación.", error);
  }else{
    console.error("No se pudo inicializar la invitación.");
  }

  const openButton = byId("openInvite");
  if (openButton) openButton.disabled = true;

  const hint = document.querySelector(".gate-hint");
  if (hint){
    hint.textContent =
      "No fue posible cargar esta invitación. Intenta recargar la página.";
  }
}

export function startInvitation(options = {}){
  if (!startPromise){
    startPromise = initializeInvitation(options).catch(reportInitializationError);
  }

  return startPromise;
}
