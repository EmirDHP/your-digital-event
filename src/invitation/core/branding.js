import { getSafeHttpUrl } from "./external-url.js";

const DEFAULT_FOOTER = Object.freeze({
  enabled: true,
  label: "Diseñado por",
  name: "Your Digital Event",
  url: "https://www.your-digital-event.com/",
  openInNewTab: true
});

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
  link.append(label, document.createTextNode(" "), brand);
  return link;
}

export function renderBranding(branding){
  const value = asObject(branding) || {};
  const header = document.querySelector(".topbar");
  if (header) header.hidden = value.header?.enabled === false;

  const footerElement = document.querySelector(".footer");
  if (!footerElement) return;

  const configuredFooter = asObject(value.footer);
  const footer = configuredFooter || DEFAULT_FOOTER;
  const footerEnabled = footer?.enabled !== false;
  footerElement.hidden = !footerEnabled;
  if (!footerEnabled) return;

  const signature = createSignature(footer);
  if (signature){
    footerElement.replaceChildren(signature);
    return;
  }

  if (configuredFooter){
    footerElement.hidden = true;
    footerElement.replaceChildren();
    return;
  }

  const fallbackSignature = createSignature(DEFAULT_FOOTER);
  if (fallbackSignature) footerElement.replaceChildren(fallbackSignature);
}
