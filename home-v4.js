(() => {
  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('.primary-nav');
  const header = document.querySelector('[data-header]');

  const setMenu = (open) => {
    if (!menuButton || !nav) return;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    nav.classList.toggle('is-open', open);
  };

  menuButton?.addEventListener('click', () => {
    setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
  });

  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMenu(false);
      menuButton?.focus();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (header && !header.contains(event.target)) setMenu(false);
  }, { passive: true });

  const salesNumber = '5218681259635';
  const whatsappUrl = (message) => `https://wa.me/${salesNumber}?text=${encodeURIComponent(message)}`;
  const quoteMessage = 'Hola! Me gustaría cotizar una invitación digital.';

  document.querySelectorAll('.whatsapp-link').forEach((link) => {
    link.href = whatsappUrl(quoteMessage);
  });

  document.querySelectorAll('.package-link').forEach((link) => {
    const packageName = link.dataset.package;
    link.href = whatsappUrl(`Hola! Me interesa el paquete ${packageName} para una invitación digital. ¿Qué incluye y cuál sería el precio final?`);
  });

  document.querySelectorAll('[data-year]').forEach((item) => {
    item.textContent = new Date().getFullYear();
  });
})();
