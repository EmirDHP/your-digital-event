Promise.all([
  import("../../../src/invitation/core/app.js"),
  fetch("../../../src/invitation/themes/alba/manifest.json")
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar el tema Alba.");
      return response.json();
    })
])
  .then(([{ startInvitation }, manifest]) =>
    startInvitation(manifest.runtimeOptions || {})
  )
  .catch((error) => {
    console.error("No se pudo cargar la demo Alba.", error);
    const button = document.getElementById("openInvite");
    const hint = document.querySelector(".gate-hint");
    if (button) button.disabled = true;
    if (hint){
      hint.textContent =
        "No fue posible cargar esta invitación. Intenta recargar la página.";
    }
  });
