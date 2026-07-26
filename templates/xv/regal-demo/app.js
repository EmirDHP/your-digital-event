const $ = (id) => document.getElementById(id);

function pad2(n){ return String(n).padStart(2, "0"); }

function formatCountdown(diffMs){
  const totalSec = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return { days, hours, mins, secs };
}

function buildWhatsAppUrl(number, message){
  const clean = String(number).replace(/[^\d]/g, "");
  const text = encodeURIComponent(message);
  return `https://wa.me/${clean}?text=${text}`;
}

function safeText(el, value){
  if (!el) return;
  el.textContent = value ?? "";
}

function setHeroImage(path){
  if (!path) return;
  const bg = $("heroBg");
  if (!bg) return;
  bg.classList.add("has-image");
  bg.style.backgroundImage = `url("${path}")`;
}

function renderSchedule(items){
  const wrap = $("scheduleList");
  if (!wrap) return;
  wrap.innerHTML = "";
  (items || []).forEach((it) => {
    const row = document.createElement("div");
    row.className = "tl-item";
    row.innerHTML = `
      <div class="tl-time">${it.time || ""}</div>
      <div class="tl-title">${it.title || ""}</div>
    `;
    wrap.appendChild(row);
  });
}


function renderStory(story){
  const section = $("historia");
  const titleEl = $("storyTitle");
  const subtitleEl = $("storySubtitle");
  const list = $("storyList");

  if (!section || !titleEl || !subtitleEl || !list) return;

  if (!story?.enabled || !Array.isArray(story.items) || story.items.length === 0){
    section.hidden = true;
    return;
  }

  section.hidden = false;
  safeText(titleEl, story.title || "Nuestra historia");
  safeText(subtitleEl, story.subtitle || "Cómo sucedió");

  list.innerHTML = "";

  story.items.forEach((item, idx) => {
    const card = document.createElement("article");
    card.className = "story-card";

    const step = String(idx + 1).padStart(2, "0");
    const hasImage = !!item.image;

    const mediaHtml = hasImage
      ? `<div class="story-media"><img src="${item.image}" alt="${item.title || `Momento ${idx + 1}`}" loading="lazy" decoding="async"></div>`
      : `<div class="story-step">${step}</div>`;

    card.innerHTML = `
      ${mediaHtml}
      <div class="story-content">
        <h4 class="story-item-title">${item.title || `Momento ${idx + 1}`}</h4>
        <p class="story-item-text">${item.text || ""}</p>
      </div>
    `;

    list.appendChild(card);
  });
}


function maskClabe(clabe){
  const s = String(clabe || "").replace(/\s+/g, "");
  if (s.length < 8) return s;
  // formato visual en bloques de 4
  return s.replace(/(\d{4})(?=\d)/g, "$1 ");
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(String(text || ""));
    return true;
  }catch{
    return false;
  }
}

function renderGifts(gifts){
  const section = $("regalos");
  const titleEl = $("giftsTitle");
  const introEl = $("giftsIntro");
  const list = $("giftsList");

  if (!section || !titleEl || !introEl || !list) return;

  // Hide if disabled or empty
  if (!gifts?.enabled || !Array.isArray(gifts.options) || gifts.options.length === 0){
    section.hidden = true;
    return;
  }

  section.hidden = false;
  safeText(titleEl, gifts.title || "Mesa de regalos");
  safeText(introEl, gifts.intro || "");

  list.innerHTML = "";

  gifts.options.forEach((opt) => {
    const card = document.createElement("article");
    card.className = "gift-card";

    // type icon / chip
    const typeLabelMap = {
      sobre: "Sobre",
      transfer: "Transferencia",
      wishlist: "Wishlist"
    };
    const typeText = typeLabelMap[opt.type] || "Opción";

    const head = document.createElement("div");
    head.className = "gift-head";
    head.innerHTML = `
      <div class="gift-chip">${typeText}</div>
      <div class="gift-name">${opt.label || "Opción de regalo"}</div>
    `;
    card.appendChild(head);

    const body = document.createElement("div");
    body.className = "gift-body";

    if (opt.type === "sobre"){
      const p = document.createElement("p");
      p.className = "gift-text";
      p.textContent = opt.text || "Habrá un espacio disponible el día del evento.";
      body.appendChild(p);
    }

    else if (opt.type === "transfer"){
      const rows = document.createElement("div");
      rows.className = "gift-rows";

      const bank = document.createElement("div");
      bank.className = "gift-row";
      bank.innerHTML = `
        <div class="gift-k">Banco</div>
        <div class="gift-v">${opt.bank || "-"}</div>
      `;

      const holder = document.createElement("div");
      holder.className = "gift-row";
      holder.innerHTML = `
        <div class="gift-k">Titular</div>
        <div class="gift-v">${opt.holder || "-"}</div>
      `;

      const clabe = document.createElement("div");
      clabe.className = "gift-row gift-row-clabe";
      clabe.innerHTML = `
        <div class="gift-k">CLABE</div>
        <div class="gift-v gift-mono">${maskClabe(opt.clabe || "")}</div>
      `;

      rows.appendChild(bank);
      rows.appendChild(holder);
      rows.appendChild(clabe);
      body.appendChild(rows);

      const actions = document.createElement("div");
      actions.className = "gift-actions";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "btn btn-ghost gift-copy";
      copyBtn.textContent = "Copiar CLABE";

      copyBtn.addEventListener("click", async () => {
        const ok = await copyText(opt.clabe || "");
        const old = copyBtn.textContent;
        copyBtn.textContent = ok ? "CLABE copiada ✓" : "No se pudo copiar";
        setTimeout(() => { copyBtn.textContent = old; }, 1400);
      });

      actions.appendChild(copyBtn);
      body.appendChild(actions);
    }

    else if (opt.type === "wishlist"){
      const p = document.createElement("p");
      p.className = "gift-text";
      p.textContent = "Puedes ver nuestra lista de regalos en línea.";
      body.appendChild(p);

      if (opt.url){
        const actions = document.createElement("div");
        actions.className = "gift-actions";

        const link = document.createElement("a");
        link.className = "btn btn-primary";
        link.href = opt.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Abrir lista";

        actions.appendChild(link);
        body.appendChild(actions);
      }
    }

    else {
      const p = document.createElement("p");
      p.className = "gift-text";
      p.textContent = opt.text || "Opción de regalo";
      body.appendChild(p);
    }

    card.appendChild(body);
    list.appendChild(card);
  });
}


let GALLERY_ITEMS = [];
let lbIndex = 0;

let MUSIC_STATE = {
  audio: null,
  btn: null,
  label: "Reproducir música",
  enabled: false,
  playing: false
};

function renderGallery(gallery){
  const grid = $("galleryGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const valid = (gallery || []).filter(g => g?.thumb || g?.full || g?.src);
  GALLERY_ITEMS = valid;

  if (valid.length === 0) {
    grid.innerHTML = `<div class="muted">Aún no se han agregado fotos.</div>`;
    return;
  }

  valid.forEach((g, idx) => {
    const box = document.createElement("button");
    box.type = "button";
    box.className = "gimg";
    box.style.cursor = "pointer";
    box.setAttribute("aria-label", `Abrir foto ${idx + 1}`);

    const img = document.createElement("img");
    img.src = g.thumb || g.src || g.full;
    img.alt = g.alt || "Foto";
    img.loading = "lazy";

    box.appendChild(img);
    box.addEventListener("click", () => openLightbox(idx));

    grid.appendChild(box);
  });
}

function openLightbox(index){
  const lb = $("lightbox");
  const img = $("lbImg");
  const cap = $("lbCaption");
  if (!lb || !img) return;

  lbIndex = index;
  const item = GALLERY_ITEMS[lbIndex];

  if (cap) cap.textContent = item.alt || "";

  lb.hidden = false;
  lb.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");

  // Loader
  setLightboxLoading(true);
  img.onload = () => setLightboxLoading(false);
  img.onerror = () => setLightboxLoading(false);

  // Solo UNA asignación
  img.src = item.full || item.src || item.thumb;
  img.alt = item.alt || "Foto";

  // Preload vecinos
  preloadImageAt(lbIndex + 1);
  preloadImageAt(lbIndex - 1);
}


function closeLightbox(){
  const lb = $("lightbox");
  if (!lb) return;
  lb.hidden = true;
  lb.setAttribute("aria-hidden", "true");
  document.body.classList.remove("locked");
}

function stepLightbox(dir){
  if (!GALLERY_ITEMS.length) return;

  lbIndex = (lbIndex + dir + GALLERY_ITEMS.length) % GALLERY_ITEMS.length;

  const item = GALLERY_ITEMS[lbIndex];
  const img = $("lbImg");
  const cap = $("lbCaption");
  if (!img) return;

  if (cap) cap.textContent = item.alt || "";

  setLightboxLoading(true);
  img.onload = () => setLightboxLoading(false);
  img.onerror = () => setLightboxLoading(false);

  // Solo UNA asignación
  img.src = item.full || item.src || item.thumb;
  img.alt = item.alt || "Foto";

  preloadImageAt(lbIndex + 1);
  preloadImageAt(lbIndex - 1);
}

function initLightbox(){
  const closeBtn = $("lbClose");
  const prevBtn = $("lbPrev");
  const nextBtn = $("lbNext");
  const backdrop = $("lbBackdrop");

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (backdrop) backdrop.addEventListener("click", closeLightbox);
  if (prevBtn) prevBtn.addEventListener("click", () => stepLightbox(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => stepLightbox(1));

  // Keyboard support
  window.addEventListener("keydown", (e) => {
    const lb = $("lightbox");
    if (!lb || lb.hidden) return;

    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });

  // Touch swipe support (mobile)
  let startX = 0;
  let startY = 0;

  const panel = document.querySelector(".lb-panel");
  if (!panel) return;

  panel.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
  }, { passive: true });

  panel.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    // horizontal swipe only
    if (Math.abs(dx) > 45 && Math.abs(dy) < 60) {
      if (dx > 0) stepLightbox(-1);
      else stepLightbox(1);
    }
  }, { passive: true });
}

function preloadImageAt(index){
  if (!GALLERY_ITEMS.length) return;
  const i = (index + GALLERY_ITEMS.length) % GALLERY_ITEMS.length;
  const it = GALLERY_ITEMS[i];
  const src = it?.full || it?.src || it?.thumb;
  if (!src) return;

  const img = new Image();
  img.src = src;
}


function initMusic(music){
  const wrap = $("musicWrap");
  const btn = $("musicBtn");
  const audio = $("musicAudio");
  if (!wrap || !btn || !audio) return;

  if (!music?.enabled || !music?.src) {
    wrap.hidden = true;
    MUSIC_STATE = { audio:null, btn:null, label:"Reproducir música", enabled:false, playing:false };
    return;
  }

  wrap.hidden = false;
  audio.src = music.src;
  audio.loop = true;      // loop suave para demo
  audio.volume = 0.55;    // volumen agradable demo

  const baseLabel = music.label || "Reproducir música";
  btn.textContent = baseLabel;

  MUSIC_STATE = {
    audio,
    btn,
    label: baseLabel,
    enabled: true,
    playing: false
  };

  btn.addEventListener("click", async () => {
    try{
      if (!MUSIC_STATE.playing){
        await audio.play();
        MUSIC_STATE.playing = true;
        btn.textContent = "Pausar música";
      } else {
        audio.pause();
        MUSIC_STATE.playing = false;
        btn.textContent = baseLabel;
      }
    }catch(e){
      alert("Tu navegador bloqueó el audio. Toca de nuevo para intentar.");
    }
  });
}

async function tryAutoplayMusic(){
  if (!MUSIC_STATE.enabled || !MUSIC_STATE.audio || MUSIC_STATE.playing) return;

  try{
    await MUSIC_STATE.audio.play();
    MUSIC_STATE.playing = true;
    if (MUSIC_STATE.btn) MUSIC_STATE.btn.textContent = "Pausar música";
  }catch(err){
    // Si el navegador lo bloquea, no pasa nada:
    // el usuario todavía puede usar el botón manual.
    console.warn("Autoplay bloqueado:", err);
  }
}

function initGate(){
  const gate = $("gate");
  const btn = $("openInvite");
  if (!gate || !btn) return;

  btn.addEventListener("click", async () => {
    document.body.classList.remove("locked");
    gate.classList.add("hide");

    // reveal hero
    const hc = document.querySelector(".hero-content");
    if (hc) hc.classList.add("revealed");

    // Intentar reproducir música al abrir invitación
    await tryAutoplayMusic();

    setTimeout(() => gate.remove(), 520);
  });
}

// If gate is removed/disabled later, ensure hero shows
setTimeout(() => {
  const hc = document.querySelector(".hero-content");
  if (hc) hc.classList.add("revealed");
}, 150);

async function loadConfig(){
  const res = await fetch("config.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar config.json");
  return await res.json();
}

function setTitle(names){
  document.title = names ? `Invitación • ${names}` : "Invitación";
}

function initRSVP(rsvp){
  const btn = $("rsvpBtn");
  const input = $("guestName");
  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    const guest = (input.value || "").trim();
    const baseMsg = rsvp?.whatsappMessage || "¡Hola! Confirmo mi asistencia. Mi nombre es: ";
    const msg = guest ? `${baseMsg}${guest}` : baseMsg;
    const url = buildWhatsAppUrl(rsvp?.whatsappNumber || "", msg);
    window.open(url, "_blank", "noopener");
  });

  // Press Enter to send
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn.click();
  });
}

function startCountdown(dateISO){
  const target = new Date(dateISO);
  const tick = () => {
    const now = new Date();
    const diff = target - now;
    const {days, hours, mins, secs} = formatCountdown(diff);
    safeText($("cdDays"), days);
    safeText($("cdHours"), pad2(hours));
    safeText($("cdMins"), pad2(mins));
    safeText($("cdSecs"), pad2(secs));
  };
  tick();
  setInterval(tick, 1000);
}

async function main(){
  initGate();

  const cfg = await loadConfig();

  // Text bindings
  safeText($("gateNames"), cfg.names);
  safeText($("gateDate"), cfg.dateDisplay);

  safeText($("tagline"), cfg.tagline);
  safeText($("heroNames"), cfg.names);
  safeText($("heroDate"), cfg.dateDisplay);
  safeText($("heroTime"), cfg.timeDisplay);

  safeText($("msgTitle"), cfg.messageTitle);
  safeText($("msgBody"), cfg.messageBody);

  safeText($("detailsDate"), cfg.dateDisplay);
  safeText($("detailsTime"), cfg.timeDisplay);
  safeText($("detailsVenue"), cfg.venueName);
  safeText($("detailsAddr"), cfg.addressLine);

  const maps = $("mapsLink");
  if (maps && cfg.mapsUrl) maps.href = cfg.mapsUrl;

  safeText($("dressCode"), cfg.dressCode);
  safeText($("footerText"), cfg.branding?.footerText);

  setTitle(cfg.names);
  setHeroImage(cfg.heroImage);

  renderSchedule(cfg.schedule);
  renderStory(cfg.story);
  renderGallery(cfg.gallery);
  renderGifts(cfg.gifts);

  initRevealAnimations();
  initHeroParallax();

  initLightbox();
  initMusic(cfg.music); // primero música
  initGate();          // luego gate
  initRSVP(cfg.rsvp);

  if (cfg.dateISO) startCountdown(cfg.dateISO);
}

function initRevealAnimations(){
  const targets = [
    ".section",
    ".hero-content",
    ".cards .card",
    ".timeline .tl-item",
    ".gallery .gimg",
    ".rsvp-box"
  ];

  const els = targets.flatMap(sel => Array.from(document.querySelectorAll(sel)));

  // add class
  els.forEach(el => el.classList.add("reveal"));

  // If reduced motion, show immediately
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    els.forEach(el => el.classList.add("in"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries){
      if (e.isIntersecting){
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -10% 0px" });

  els.forEach(el => io.observe(el));
}

main().catch((err) => {
  console.error(err);
  alert("Error cargando la invitación. Revisa config.json y archivos.");
});


function setLightboxLoading(isLoading){
  const panel = document.querySelector(".lb-panel");
  if (!panel) return;
  panel.classList.toggle("loading", isLoading);
}

function initHeroParallax(){
  const bg = document.getElementById("heroBg");
  if (!bg) return;

  // Skip on reduced motion
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  window.addEventListener("scroll", () => {
    const y = Math.min(160, window.scrollY);
    bg.style.transform = `translateY(${y * 0.08}px)`;
  }, { passive: true });
}