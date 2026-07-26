import { byId, setLightboxLoading } from "../core/dom.js";

export function createLightboxController({ getItems }){
  let index = 0;
  let initialized = false;

  const items = () => {
    const currentItems = typeof getItems === "function" ? getItems() : [];
    return Array.isArray(currentItems) ? currentItems : [];
  };

  const preloadImageAt = (targetIndex) => {
    const galleryItems = items();
    if (!galleryItems.length) return;

    const normalizedIndex =
      (targetIndex + galleryItems.length) % galleryItems.length;
    const item = galleryItems[normalizedIndex];
    const src = item?.full || item?.src || item?.thumb;
    if (!src) return;

    const image = new Image();
    image.src = src;
  };

  const renderCurrentImage = () => {
    const galleryItems = items();
    const item = galleryItems[index];
    const image = byId("lbImg");
    const caption = byId("lbCaption");
    if (!item || !image) return;

    if (caption) caption.textContent = item.alt || "";

    setLightboxLoading(true);
    image.onload = () => setLightboxLoading(false);
    image.onerror = () => setLightboxLoading(false);
    image.src = item.full || item.src || item.thumb;
    image.alt = item.alt || "Foto";

    preloadImageAt(index + 1);
    preloadImageAt(index - 1);
  };

  const open = (targetIndex) => {
    const lightbox = byId("lightbox");
    const image = byId("lbImg");
    const galleryItems = items();
    if (!lightbox || !image || !galleryItems.length) return;

    index = targetIndex;
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    renderCurrentImage();
  };

  const close = () => {
    const lightbox = byId("lightbox");
    if (!lightbox) return;

    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
  };

  const step = (direction) => {
    const galleryItems = items();
    if (!galleryItems.length) return;

    index = (index + direction + galleryItems.length) % galleryItems.length;
    renderCurrentImage();
  };

  const init = () => {
    if (initialized) return;

    const closeButton = byId("lbClose");
    const previousButton = byId("lbPrev");
    const nextButton = byId("lbNext");
    const backdrop = byId("lbBackdrop");
    const panel = document.querySelector(".lb-panel");
    if (!panel) return;

    initialized = true;

    if (closeButton) closeButton.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);
    if (previousButton) previousButton.addEventListener("click", () => step(-1));
    if (nextButton) nextButton.addEventListener("click", () => step(1));

    window.addEventListener("keydown", (event) => {
      const lightbox = byId("lightbox");
      if (!lightbox || lightbox.hidden) return;

      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    });

    let startX = 0;
    let startY = 0;

    panel.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });

    panel.addEventListener("touchend", (event) => {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaX) > 45 && Math.abs(deltaY) < 60){
        if (deltaX > 0) step(-1);
        else step(1);
      }
    }, { passive: true });
  };

  return { open, close, step, init };
}
