const $ = (id) => document.getElementById(id);

let CATALOG = null;

function buildWhatsAppUrl(number, message){
  const clean = String(number || "").replace(/[^\d]/g, "");
  const text = encodeURIComponent(message || "");
  return `https://wa.me/${clean}?text=${text}`;
}

async function loadCatalog(){
  const res = await fetch("catalog.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar catalog.json");
  return await res.json();
}

async function main(){
  CATALOG = await loadCatalog();

  const baseUrl = buildWhatsAppUrl(CATALOG.brand.whatsappSales, "Hola! Me gustaría cotizar una invitación digital 🙂");

  ["ctaWhatsTop","ctaWhatsHero","ctaWhatsBottom"].forEach(id=>{
    const el = $(id);
    if (el) el.href = baseUrl;
  });

  // Paquetes
  const packBtns = [
    ["packEsencial", "Esencial"],
    ["packPremium", "Premium"],
    ["packVIP", "VIP"]
  ];

  packBtns.forEach(([id, pack])=>{
    const el = $(id);
    if (!el) return;
    const msg = `Hola! Me interesa el paquete ${pack} para una invitación digital. ¿Qué incluye y cuál sería el precio final?`;
    el.href = buildWhatsAppUrl(CATALOG.brand.whatsappSales, msg);
  });
}

function initRevealMotion(){
  const revealGroups = [
    document.querySelectorAll("#categorias .section-head"),
    document.querySelectorAll(".cat-card"),
    document.querySelectorAll("#incluye .section-head, .include-visual"),
    document.querySelectorAll(".include-col"),
    document.querySelectorAll("#paquetes .section-head"),
    document.querySelectorAll(".price-card"),
    document.querySelectorAll(".faq-intro"),
    document.querySelectorAll(".qa"),
    document.querySelectorAll(".contact > div"),
    document.querySelectorAll(".footer-inner")
  ];
  window.SiteUI?.revealGroups(revealGroups);
}

function initHeroParallax(){
  const hero = document.querySelector(".hero");
  const image = document.querySelector(".hero-img");
  if (!hero || !image) return;

  const desktop = window.matchMedia("(min-width: 1024px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let active = false;
  let frameId = 0;

  const update = () => {
    frameId = 0;
    const rect = hero.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    const heroCenter = rect.top + rect.height / 2;
    const viewportCenter = window.innerHeight / 2;
    const offset = Math.max(-8, Math.min(8, (viewportCenter - heroCenter) * 0.012));
    image.style.setProperty("--hero-parallax", `${offset.toFixed(2)}px`);
  };

  const requestUpdate = () => {
    if (!frameId) frameId = window.requestAnimationFrame(update);
  };

  const enable = () => {
    if (active) return;
    active = true;
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    requestUpdate();
  };

  const disable = () => {
    if (!active) return;
    active = false;
    window.removeEventListener("scroll", requestUpdate);
    window.removeEventListener("resize", requestUpdate);
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    image.style.removeProperty("--hero-parallax");
  };

  const sync = () => {
    if (desktop.matches && !reducedMotion.matches) enable();
    else disable();
  };

  desktop.addEventListener("change", sync);
  reducedMotion.addEventListener("change", sync);
  sync();
}

initRevealMotion();
initHeroParallax();
main().catch(console.error);
