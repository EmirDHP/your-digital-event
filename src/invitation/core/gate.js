import { byId } from "./dom.js";

let initialized = false;
let fallbackScheduled = false;

export function scheduleHeroRevealFallback(){
  if (fallbackScheduled) return;
  fallbackScheduled = true;

  setTimeout(() => {
    const heroContent = document.querySelector(".hero-content");
    if (heroContent) heroContent.classList.add("revealed");
  }, 150);
}

export function initGate({ tryAutoplay } = {}){
  if (initialized) return;

  const gate = byId("gate");
  const button = byId("openInvite");
  if (!gate || !button) return;

  initialized = true;

  button.addEventListener("click", async () => {
    document.body.classList.remove("locked");
    gate.classList.add("hide");

    const heroContent = document.querySelector(".hero-content");
    if (heroContent) heroContent.classList.add("revealed");

    if (typeof tryAutoplay === "function"){
      await tryAutoplay();
    }

    setTimeout(() => gate.remove(), 520);
  });
}
