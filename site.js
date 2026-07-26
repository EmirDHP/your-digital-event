(() => {
  function initMobileNav(){
    const header = document.querySelector(".nav");
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.getElementById("primary-nav");
    if (!header || !toggle || !nav) return;

    const desktop = window.matchMedia("(min-width: 861px)");

    const setMenuState = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      nav.classList.toggle("is-open", open);
    };

    toggle.addEventListener("click", () => {
      setMenuState(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => setMenuState(false));
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
      setMenuState(false);
      toggle.focus();
    });

    document.addEventListener("pointerdown", event => {
      if (!header.contains(event.target)) setMenuState(false);
    }, { passive: true });

    desktop.addEventListener("change", event => {
      if (event.matches) setMenuState(false);
    });
  }

  function setCurrentYear(){
    document.querySelectorAll("[data-current-year], #year").forEach(element => {
      element.textContent = new Date().getFullYear();
    });
  }

  function revealGroups(groups){
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches || !("IntersectionObserver" in window)) return;

    const revealElements = [];
    groups.forEach(group => {
      Array.from(group || []).forEach((element, index) => {
        if (element.dataset.revealObserved === "true") return;
        element.dataset.revealObserved = "true";
        element.classList.add("reveal");
        element.style.setProperty("--reveal-delay", `${index * 80}ms`);
        revealElements.push(element);
      });
    });

    if (!revealElements.length) return;
    document.documentElement.classList.add("motion-ready");

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const element = entry.target;
        const delay = Number.parseInt(element.style.getPropertyValue("--reveal-delay"), 10) || 0;
        element.classList.add("is-visible");
        observer.unobserve(element);

        const finishReveal = () => {
          element.classList.remove("reveal", "is-visible");
          element.style.removeProperty("--reveal-delay");
          delete element.dataset.revealObserved;
        };

        element.addEventListener("transitionend", finishReveal, { once: true });
        window.setTimeout(finishReveal, 750 + delay);
      });
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -8% 0px"
    });

    window.requestAnimationFrame(() => {
      revealElements.forEach(element => observer.observe(element));
    });
  }

  window.SiteUI = { revealGroups };

  initMobileNav();
  setCurrentYear();
})();
