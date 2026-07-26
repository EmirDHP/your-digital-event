export function setSectionAvailability(sectionId, isAvailable){
  const section = document.getElementById(sectionId);
  setElementAvailability(section, isAvailable);

  document.querySelectorAll(`a[href="#${sectionId}"]`).forEach((link) => {
    link.hidden = !isAvailable;
  });
}

export function setElementAvailability(element, isAvailable){
  if (element) element.hidden = !isAvailable;
}
