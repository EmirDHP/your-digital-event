import { byId, setLightboxLoading } from "../core/dom.js";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])"
].join(",");

function isFocusable(element){
  return element instanceof HTMLElement &&
    !element.hidden &&
    element.getClientRects().length > 0;
}

function focusElement(element){
  if (!(element instanceof HTMLElement)) return;

  try{
    element.focus({ preventScroll: true });
  }catch{
    element.focus();
  }
}

function makeSurroundingContentInert(lightbox){
  const states = [];
  const registered = new Set();
  let branch = lightbox;

  while (branch.parentElement && branch.parentElement !== document.documentElement){
    const parent = branch.parentElement;

    Array.from(parent.children).forEach((element) => {
      if (
        element === branch ||
        !(element instanceof HTMLElement) ||
        ["SCRIPT", "STYLE", "LINK"].includes(element.tagName) ||
        registered.has(element)
      ) return;

      registered.add(element);
      states.push({ element, hadInert: element.hasAttribute("inert") });
      element.setAttribute("inert", "");
    });

    branch = parent;
  }

  return () => {
    states.forEach(({ element, hadInert }) => {
      if (!hadInert) element.removeAttribute("inert");
    });
  };
}

export function createLightboxController({ getItems }){
  let index = 0;
  let initialized = false;
  let triggerElement = null;
  let restoreBackground = null;
  let bodyWasLocked = false;

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

  const open = (targetIndex, opener = document.activeElement) => {
    const lightbox = byId("lightbox");
    const image = byId("lbImg");
    const galleryItems = items();
    if (!lightbox || !image || !galleryItems.length) return;

    index = targetIndex;
    if (lightbox.hidden){
      triggerElement = opener instanceof HTMLElement ? opener : null;
      bodyWasLocked = document.body.classList.contains("locked");
      restoreBackground = makeSurroundingContentInert(lightbox);
    }
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    renderCurrentImage();
    focusElement(byId("lbClose") || lightbox.querySelector(".lb-panel"));
  };

  const close = () => {
    const lightbox = byId("lightbox");
    if (!lightbox || lightbox.hidden) return;

    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    if (!bodyWasLocked) document.body.classList.remove("locked");
    restoreBackground?.();
    restoreBackground = null;

    const focusTarget = triggerElement;
    triggerElement = null;
    bodyWasLocked = false;

    if (focusTarget?.isConnected && !focusTarget.hasAttribute("inert")){
      focusElement(focusTarget);
    }
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
    if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");

    if (closeButton) closeButton.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);
    if (previousButton) previousButton.addEventListener("click", () => step(-1));
    if (nextButton) nextButton.addEventListener("click", () => step(1));

    window.addEventListener("keydown", (event) => {
      const lightbox = byId("lightbox");
      if (!lightbox || lightbox.hidden) return;

      if (event.key === "Escape"){
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
        return;
      }

      if (event.key === "Tab"){
        const focusable = Array.from(lightbox.querySelectorAll(FOCUSABLE_SELECTOR))
          .filter(isFocusable);

        if (focusable.length === 0){
          event.preventDefault();
          focusElement(panel);
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && (active === first || !lightbox.contains(active))){
          event.preventDefault();
          focusElement(last);
        }else if (!event.shiftKey && (active === last || !lightbox.contains(active))){
          event.preventDefault();
          focusElement(first);
        }
        return;
      }

      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    });

    document.addEventListener("focusin", (event) => {
      const lightbox = byId("lightbox");
      if (!lightbox || lightbox.hidden || lightbox.contains(event.target)) return;
      focusElement(byId("lbClose") || panel);
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
