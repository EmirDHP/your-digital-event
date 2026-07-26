const IVORY_REVEAL_PROFILE = {
  baseSelectors: [
    ".hero-content",
    ".message",
    "#detalles",
    "#itinerario",
    "#historia",
    "#galeria",
    "#regalos",
    "#rsvp",
    ".footer"
  ],
  itemSelectors: [
    ".cards .card",
    ".timeline .tl-item",
    ".gallery .gimg",
    "#historia .story-card",
    "#regalos .gift-card",
    ".countdown .cd-item"
  ]
};

import("../../../src/invitation/core/app.js")
  .then(({ startInvitation }) => startInvitation({
    preserveEmptyHeroState: true,
    revealProfile: IVORY_REVEAL_PROFILE
  }))
  .catch((error) => {
    console.error("No se pudo cargar el runtime de la invitación.", error);
    const button = document.getElementById("openInvite");
    const hint = document.querySelector(".gate-hint");
    if (button) button.disabled = true;
    if (hint){
      hint.textContent =
        "No fue posible cargar esta invitación. Intenta recargar la página.";
    }
  });
