import { byId, safeText } from "../core/dom.js";

export function renderStory(story){
  const section = byId("historia");
  const title = byId("storyTitle");
  const subtitle = byId("storySubtitle");
  const list = byId("storyList");

  if (!section || !title || !subtitle || !list) return;

  if (!story?.enabled || !Array.isArray(story.items) || story.items.length === 0){
    section.hidden = true;
    return;
  }

  section.hidden = false;
  safeText(title, story.title || "Nuestra historia");
  safeText(subtitle, story.subtitle || "Cómo sucedió");
  list.innerHTML = "";
  const titleLevel = /^H[1-6]$/.test(title.tagName)
    ? Number(title.tagName.slice(1))
    : 2;
  const itemHeadingTag = `h${Math.min(titleLevel + 1, 6)}`;

  story.items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "story-card";

    const step = String(index + 1).padStart(2, "0");
    const hasImage = Boolean(item.image);
    const mediaHtml = hasImage
      ? `<div class="story-media"><img src="${item.image}" alt="${item.alt || item.title || `Momento ${index + 1}`}" loading="lazy" decoding="async"></div>`
      : `<div class="story-step">${step}</div>`;

    card.innerHTML = `
      ${mediaHtml}
      <div class="story-content">
        <${itemHeadingTag} class="story-item-title">${item.title || `Momento ${index + 1}`}</${itemHeadingTag}>
        <p class="story-item-text">${item.text || ""}</p>
      </div>
    `;

    list.appendChild(card);
  });
}
