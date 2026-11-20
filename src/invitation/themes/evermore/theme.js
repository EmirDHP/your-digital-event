const gate = document.querySelector("#gate");
const menuButton = document.querySelector("#evermoreMenuButton");
const navigation = document.querySelector("#evermoreNavigation");

document.documentElement.classList.add("evermore-js");

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  document.documentElement.classList.remove("evermore-pointer-input");
}, true);

document.addEventListener("pointerdown", () => {
  document.documentElement.classList.add("evermore-pointer-input");
}, true);

// Fail open if the shared runtime cannot initialize the gate.
if (gate){
  window.setTimeout(() => {
    if (!gate.isConnected || gate.dataset.gateReady === "true") return;
    document.body.classList.remove("locked");
    document.querySelector(".hero-content")?.classList.add("revealed");
    gate.remove();
  }, 7000);
}

function closeNavigation(){
  if (!menuButton || !navigation) return;
  menuButton.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
}

if (menuButton && navigation){
  menuButton.addEventListener("click", () => {
    const shouldOpen = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(shouldOpen));
    navigation.classList.toggle("is-open", shouldOpen);
  });

  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeNavigation();
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key !== "Escape" ||
      menuButton.getAttribute("aria-expanded") !== "true"
    ) return;

    const lightbox = document.querySelector("#lightbox");
    if (lightbox && !lightbox.hidden) return;

    closeNavigation();
    menuButton.focus();
  });

  window.matchMedia("(min-width: 761px)").addEventListener?.("change", closeNavigation);
}
