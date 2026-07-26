let revealInitialized = false;
let parallaxInitialized = false;

export function initRevealAnimations(profile = {}){
  if (revealInitialized) return;
  revealInitialized = true;

  const defaultSelectors = [
    ".section",
    ".hero-content",
    ".cards .card",
    ".timeline .tl-item",
    ".gallery .gimg",
    ".rsvp-box"
  ];

  const baseSelectors = profile.baseSelectors || defaultSelectors;
  const itemSelectors = profile.itemSelectors || [];

  const baseElements = baseSelectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector))
  );
  const itemElements = itemSelectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector))
  );

  baseElements.forEach((element) => element.classList.add("reveal"));
  itemElements.forEach((element, index) => {
    element.classList.add("reveal");
    element.dataset.stagger = "1";
    element.style.setProperty("--i", String(index % 10));
  });

  const elements = [...baseElements, ...itemElements];

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ){
    elements.forEach((element) => element.classList.add("in"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries){
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("in");
      observer.unobserve(entry.target);
    }
  }, {
    threshold: 0.12,
    rootMargin: "0px 0px -10% 0px"
  });

  elements.forEach((element) => observer.observe(element));
}

export function initHeroParallax(){
  if (parallaxInitialized) return;

  const background = document.getElementById("heroBg");
  if (!background) return;

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) return;

  parallaxInitialized = true;
  let frameRequested = false;

  const update = () => {
    const y = Math.min(160, window.scrollY);
    background.style.transform = `translateY(${y * 0.08}px)`;
    frameRequested = false;
  };

  window.addEventListener("scroll", () => {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(update);
  }, { passive: true });
}
