import { byId } from "../core/dom.js";

let galleryItems = [];

export function getGalleryItems(){
  return galleryItems;
}

export function renderGallery(gallery, { openLightbox } = {}){
  const grid = byId("galleryGrid");
  if (!grid) return;

  grid.innerHTML = "";
  galleryItems = (gallery || []).filter((item) =>
    item?.thumb || item?.full || item?.src
  );

  if (galleryItems.length === 0){
    grid.innerHTML = `<div class="muted">Aún no se han agregado fotos.</div>`;
    return;
  }

  galleryItems.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gimg";
    button.style.cursor = "pointer";
    button.setAttribute("aria-label", `Abrir foto ${index + 1}`);

    const image = document.createElement("img");
    image.src = item.thumb || item.src || item.full;
    image.alt = item.alt || "Foto";
    image.loading = "lazy";

    button.appendChild(image);
    button.addEventListener("click", () => {
      if (typeof openLightbox === "function") openLightbox(index);
    });

    grid.appendChild(button);
  });
}
