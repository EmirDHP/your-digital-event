import { safeText } from "./dom.js";
import { getSafeHttpUrl } from "./external-url.js";

function asObject(value){
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function createSignature(footer){
  const url = getSafeHttpUrl(footer.url);
  if (!url || !url.startsWith("https://")) return null;

  const link = document.createElement("a");
  link.className = "brand-signature";
  link.href = url;
  link.setAttribute("aria-label", `Visitar ${footer.name}`);

  if (footer.openInNewTab === true){
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  const label = document.createElement("span");
  label.className = "brand-signature-label";
  label.textContent = footer.label;

  const brand = document.createElement("span");
  brand.className = "brand-signature-brand";

  const name = document.createElement("span");
  name.className = "brand-signature-name";
  name.textContent = footer.name;

  const dots = document.createElement("span");
  dots.className = "brand-signature-dots";
  dots.setAttribute("aria-hidden", "true");
  dots.append(document.createElement("span"), document.createElement("span"));

  brand.append(name, dots);
  link.append(label, brand);
  return link;
}

export function renderBranding(branding){
  const value = asObject(branding) || {};
  const header = document.querySelector(".topbar");
  if (header) header.hidden = value.header?.enabled === false;

  const footerElement = document.querySelector(".footer");
  if (!footerElement) return;

  const footer = asObject(value.footer);
  const footerEnabled = footer?.enabled !== false;
  footerElement.hidden = !footerEnabled;
  if (!footerEnabled) return;

  if (footer){
    const signature = createSignature(footer);
    if (signature){
      footerElement.replaceChildren(signature);
      return;
    }
  }

  let legacyText = document.getElementById("footerText");
  if (!legacyText){
    legacyText = document.createElement("div");
    legacyText.id = "footerText";
    footerElement.replaceChildren(legacyText);
  }
  safeText(legacyText, value.footerText);
}
