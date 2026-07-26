export const byId = (id) => document.getElementById(id);

export function safeText(element, value){
  if (!element) return;
  element.textContent = value ?? "";
}

export function setDocumentTitle(names){
  document.title = names ? `Invitación • ${names}` : "Invitación";
}

export function setHeroImage(path, { preserveEmptyState = false } = {}){
  const background = byId("heroBg");
  if (!background) return;

  if (!path){
    if (preserveEmptyState){
      background.classList.add("has-image");
      background.style.backgroundImage = "none";
    }
    return;
  }

  background.classList.add("has-image");
  background.style.backgroundImage = `url("${path}")`;
}

export function setLightboxLoading(isLoading){
  const panel = document.querySelector(".lb-panel");
  if (!panel) return;
  panel.classList.toggle("loading", isLoading);
}
