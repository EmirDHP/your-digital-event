import("../../../src/invitation/core/app.js")
  .then(({ startInvitation }) => startInvitation({
    preserveEmptyHeroState: true
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
