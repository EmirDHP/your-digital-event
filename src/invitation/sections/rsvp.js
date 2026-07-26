import { byId } from "../core/dom.js";
import { buildWhatsAppUrl } from "../core/external-url.js";
import { setSectionAvailability } from "../core/navigation.js";

let initialized = false;

export function initRsvp(rsvp){
  const button = byId("rsvpBtn");
  const input = byId("guestName");
  const isAvailable = Boolean(
    rsvp?.enabled !== false &&
    buildWhatsAppUrl(rsvp?.whatsappNumber, "")
  );

  setSectionAvailability("rsvp", isAvailable);

  if (!isAvailable || !button || !input || initialized) return;
  initialized = true;

  button.addEventListener("click", () => {
    const guest = (input.value || "").trim();
    const baseMessage =
      rsvp?.whatsappMessage || "¡Hola! Confirmo mi asistencia. Mi nombre es: ";
    const message = guest ? `${baseMessage}${guest}` : baseMessage;
    const url = buildWhatsAppUrl(rsvp?.whatsappNumber, message);

    if (url) window.open(url, "_blank", "noopener,noreferrer");
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") button.click();
  });
}
