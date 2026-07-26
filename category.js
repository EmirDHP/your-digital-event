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

function groupByCollection(items){
  const map = new Map();
  items.forEach(it=>{
    const key = it.collection || "Otros";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  });
  return map;
}

function renderCollection(title, items){
  const root = $("collections");
  if (!root) return;

  const section = document.createElement("section");
  section.className = "collection-section";

  const head = document.createElement("div");
  head.className = "collection-head";

  const collectionTitle = document.createElement("h2");
  collectionTitle.className = "collection-title";
  collectionTitle.textContent = title;

  const collectionCount = document.createElement("p");
  collectionCount.className = "muted collection-count";
  collectionCount.textContent = `${items.length} diseño(s)`;

  head.appendChild(collectionTitle);
  head.appendChild(collectionCount);

  const grid = document.createElement("div");
  grid.className = "grid";

  items
    .sort((a,b)=> (b.featured?1:0)-(a.featured?1:0) || (a.name||"").localeCompare(b.name||"", "es"))
    .forEach(it=>{
      const card = document.createElement("article");
      card.className = "card";

      const cover = document.createElement("div");
      cover.className = "cover";
      if (it.cover){
        cover.classList.add("has-img");
        const image = document.createElement("img");
        image.src = it.cover;
        image.alt = `Vista previa del diseño ${it.name}`;
        image.loading = "lazy";
        image.decoding = "async";
        cover.appendChild(image);
      }

      if (it.featured){
        const badge = document.createElement("div");
        badge.className = "card-badge";
        badge.textContent = "Destacado";
        card.appendChild(badge);
      }

      const body = document.createElement("div");
      body.className = "card-body";
      body.innerHTML = `
        <h3 class="card-name">${it.name}</h3>
        <p class="card-desc">${it.description || ""}</p>
        <div class="badges">
          <span class="badge">${it.type}</span>
          ${(it.style || []).slice(0,3).map(s => `<span class="badge">${s}</span>`).join("")}
        </div>
        <div class="actions">
          <a class="btn btn-ghost" href="${it.demoUrl}" aria-label="Ver demo del diseño ${it.name}">Ver demo</a>
          <a class="btn btn-primary" href="#" data-id="${it.id}" aria-label="Cotizar el diseño ${it.name} por WhatsApp">Quiero este</a>
        </div>
      `;

      card.appendChild(cover);
      card.appendChild(body);
      grid.appendChild(card);
    });

  section.appendChild(head);
  section.appendChild(grid);
  root.appendChild(section);

  // hook "Quiero este"
  section.querySelectorAll('a.btn-primary[data-id]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const id = a.getAttribute("data-id");
      const item = (CATALOG.items || []).find(x => x.id === id);
      if (!item) return;

      const msgTpl = CATALOG.brand.salesMessage || "Hola! Quiero el diseño {DESIGN}";
      const msg = msgTpl
        .replace("{DESIGN}", item.name)
        .replace("{TYPE}", item.type);

      const url = buildWhatsAppUrl(CATALOG.brand.whatsappSales, msg);
      window.open(url, "_blank", "noopener");
    });
  });
}

async function main(){
  const type = document.body.getAttribute("data-type"); // "Boda", "XV", "Eventos"
  const title = document.body.getAttribute("data-title") || "Templates";

  $("pageTitle").textContent = title;

  CATALOG = await loadCatalog();

  const list = (CATALOG.items || []).filter(it => it.type === type);

  const grouped = groupByCollection(list);

  // Render in insertion order (you can later sort collections)
  for (const [colName, items] of grouped.entries()){
    renderCollection(colName, items);
  }

  window.SiteUI?.revealGroups([
    document.querySelectorAll(".category-hero-copy > *"),
    document.querySelectorAll(".category-ornament"),
    document.querySelectorAll(".collection-head"),
    document.querySelectorAll(".card"),
    document.querySelectorAll(".footer-inner")
  ]);

  // WhatsApp CTA
  const cta = $("ctaWhats");
  if (cta){
    cta.href = buildWhatsAppUrl(CATALOG.brand.whatsappSales, `Hola! Me interesa una invitación digital para ${type}. ¿Me compartes paquetes y precio?`);
  }
}

main().catch(console.error);
