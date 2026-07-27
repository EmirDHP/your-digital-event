import { byId, safeText } from "../core/dom.js";
import { getSafeHttpUrl } from "../core/external-url.js";

function createElement(tagName, className, text){
  const element = document.createElement(tagName);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createLocationCard(location){
  const card = createElement("article", "card details-location");
  const label = createElement(
    "div",
    "card-label details-location-label",
    location.label
  );
  const name = createElement(
    "div",
    "card-value details-location-name",
    location.name
  );
  const meta = createElement("div", "details-location-meta");
  const date = createElement(
    "span",
    "details-location-date",
    location.dateDisplay
  );
  const time = createElement(
    "span",
    "details-location-time",
    location.timeDisplay
  );
  const address = createElement(
    "div",
    "card-sub details-location-address",
    location.address
  );

  meta.append(date, time);
  card.append(label, name, meta, address);

  const mapsUrl = getSafeHttpUrl(location.mapsUrl);
  if (mapsUrl){
    const link = createElement(
      "a",
      "link details-location-link",
      "Ver ubicación"
    );
    link.href = mapsUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(link);
  }

  return card;
}

function renderLegacyDetails(details){
  safeText(byId("detailsDate"), details.dateDisplay);
  safeText(byId("detailsTime"), details.timeDisplay);
  safeText(byId("detailsVenue"), details.venueName);
  safeText(byId("detailsAddr"), details.addressLine);

  const mapsLink = byId("mapsLink");
  if (!mapsLink) return;

  const mapsUrl = getSafeHttpUrl(details.mapsUrl);
  mapsLink.hidden = !mapsUrl;
  if (mapsUrl) mapsLink.href = mapsUrl;
  else mapsLink.removeAttribute("href");
}

export function renderDetails(details){
  const list = byId("detailsList") || byId("detailsDate")?.closest(".cards");
  if (!list || !details?.enabled) return false;

  if (details.locations.length === 0){
    list.classList.remove("has-locations");
    renderLegacyDetails(details);
    return true;
  }

  const fragment = document.createDocumentFragment();
  details.locations.forEach((location) => {
    fragment.append(createLocationCard(location));
  });

  list.replaceChildren(fragment);
  list.classList.add("has-locations");
  return true;
}
