import { byId, safeText } from "../core/dom.js";
import { getSafeHttpUrl } from "../core/external-url.js";

function maskClabe(clabe){
  const value = String(clabe || "").replace(/\s+/g, "");
  if (value.length < 8) return value;
  return value.replace(/(\d{4})(?=\d)/g, "$1 ");
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(String(text || ""));
    return true;
  }catch{
    return false;
  }
}

export function renderGifts(gifts){
  const section = byId("regalos");
  const title = byId("giftsTitle");
  const intro = byId("giftsIntro");
  const list = byId("giftsList");

  if (!section || !title || !intro || !list) return;

  if (!gifts?.enabled || !Array.isArray(gifts.options) || gifts.options.length === 0){
    section.hidden = true;
    return;
  }

  section.hidden = false;
  safeText(title, gifts.title || "Mesa de regalos");
  safeText(intro, gifts.intro || "");
  list.innerHTML = "";

  gifts.options.forEach((option) => {
    const card = document.createElement("article");
    card.className = "gift-card";

    const typeLabelMap = {
      sobre: "Sobre",
      transfer: "Transferencia",
      wishlist: "Wishlist"
    };
    const typeText = typeLabelMap[option.type] || "Opción";

    const head = document.createElement("div");
    head.className = "gift-head";
    head.innerHTML = `
      <div class="gift-chip">${typeText}</div>
      <div class="gift-name">${option.label || "Opción de regalo"}</div>
    `;
    card.appendChild(head);

    const body = document.createElement("div");
    body.className = "gift-body";

    if (option.type === "sobre"){
      const text = document.createElement("p");
      text.className = "gift-text";
      text.textContent =
        option.text || "Habrá un espacio disponible el día del evento.";
      body.appendChild(text);
    }else if (option.type === "transfer"){
      const rows = document.createElement("div");
      rows.className = "gift-rows";

      const bank = document.createElement("div");
      bank.className = "gift-row";
      bank.innerHTML = `
        <div class="gift-k">Banco</div>
        <div class="gift-v">${option.bank || "-"}</div>
      `;

      const holder = document.createElement("div");
      holder.className = "gift-row";
      holder.innerHTML = `
        <div class="gift-k">Titular</div>
        <div class="gift-v">${option.holder || "-"}</div>
      `;

      const clabe = document.createElement("div");
      clabe.className = "gift-row gift-row-clabe";
      clabe.innerHTML = `
        <div class="gift-k">CLABE</div>
        <div class="gift-v gift-mono">${maskClabe(option.clabe || "")}</div>
      `;

      rows.appendChild(bank);
      rows.appendChild(holder);
      rows.appendChild(clabe);
      body.appendChild(rows);

      const actions = document.createElement("div");
      actions.className = "gift-actions";

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "btn btn-ghost gift-copy";
      copyButton.textContent = "Copiar CLABE";

      copyButton.addEventListener("click", async () => {
        const copied = await copyText(option.clabe || "");
        const originalText = copyButton.textContent;
        copyButton.textContent = copied ? "CLABE copiada ✓" : "No se pudo copiar";
        setTimeout(() => {
          copyButton.textContent = originalText;
        }, 1400);
      });

      actions.appendChild(copyButton);
      body.appendChild(actions);
    }else if (option.type === "wishlist"){
      const text = document.createElement("p");
      text.className = "gift-text";
      text.textContent = "Puedes ver nuestra lista de regalos en línea.";
      body.appendChild(text);

      const wishlistUrl = getSafeHttpUrl(option.url);
      if (wishlistUrl){
        const actions = document.createElement("div");
        actions.className = "gift-actions";

        const link = document.createElement("a");
        link.className = "btn btn-primary";
        link.href = wishlistUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Abrir lista";

        actions.appendChild(link);
        body.appendChild(actions);
      }
    }else{
      const text = document.createElement("p");
      text.className = "gift-text";
      text.textContent = option.text || "Opción de regalo";
      body.appendChild(text);
    }

    card.appendChild(body);
    list.appendChild(card);
  });
}
