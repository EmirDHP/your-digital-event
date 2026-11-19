const CALENDAR_FILE_NAME = "evento.ics";
const UID_DOMAIN = "your-digital-event.com";
const CRLF = "\r\n";

function escapeIcsText(value){
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line){
  const chunks = [];
  let current = "";

  for (const symbol of String(line)){
    const continuationBytes = chunks.length > 0 ? 1 : 0;
    if (
      current &&
      Buffer.byteLength(current + symbol, "utf8") + continuationBytes > 75
    ){
      chunks.push(current);
      current = symbol;
    }else{
      current += symbol;
    }
  }

  if (current || chunks.length === 0) chunks.push(current);
  return chunks
    .map((chunk, index) => index === 0 ? chunk : ` ${chunk}`)
    .join(CRLF);
}

function formatUtcDateTime(value){
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    "T",
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    String(date.getUTCSeconds()).padStart(2, "0"),
    "Z"
  ].join("");
}

function isValidTimeZone(value){
  try{
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  }catch{
    return false;
  }
}

function getDescription(config){
  return config.sharing?.description ||
    config.sections?.message?.body ||
    config.event?.tagline ||
    "";
}

function getLocation(config){
  return [
    config.event?.venue?.name,
    config.event?.venue?.address
  ].filter((value) => String(value || "").trim()).join(", ");
}

export function createCalendarFile(config, { timestamp = new Date() } = {}){
  const slug = String(config?.slug || "").trim();
  const names = String(config?.event?.names || "").trim();
  const startIso = config?.event?.date?.iso;
  const endIso = config?.event?.date?.endIso;
  const timeZone = String(config?.event?.date?.timeZone || "").trim();
  const startTime = Date.parse(startIso || "");
  const endTime = Date.parse(endIso || "");

  if (!endIso){
    return { available: false, reason: "missing_end_iso" };
  }
  if (!slug || !names || !Number.isFinite(startTime)){
    return { available: false, reason: "invalid_event_data" };
  }
  if (!Number.isFinite(endTime) || endTime <= startTime){
    return { available: false, reason: "invalid_end_iso" };
  }
  if (!isValidTimeZone(timeZone)){
    return { available: false, reason: "invalid_time_zone" };
  }

  const stamp = formatUtcDateTime(timestamp);
  if (!stamp){
    throw new Error("La fecha de generación del calendario no es válida.");
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Your Digital Event//Invitation Calendar//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(names)}`,
    `X-WR-TIMEZONE:${escapeIcsText(timeZone)}`,
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(`${slug}@${UID_DOMAIN}`)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatUtcDateTime(startIso)}`,
    `DTEND:${formatUtcDateTime(endIso)}`,
    `SUMMARY:${escapeIcsText(names)}`,
    `LOCATION:${escapeIcsText(getLocation(config))}`,
    `DESCRIPTION:${escapeIcsText(getDescription(config))}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return {
    available: true,
    fileName: CALENDAR_FILE_NAME,
    uid: `${slug}@${UID_DOMAIN}`,
    content: `${lines.map(foldIcsLine).join(CRLF)}${CRLF}`
  };
}

export const icsInternals = Object.freeze({
  escapeIcsText,
  foldIcsLine,
  formatUtcDateTime
});
