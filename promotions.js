(() => {
  const store = document.querySelector('.cea-site');
  const main = document.getElementById('store-main');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const rotationDelay = 6500;
  let carousel;
  let slides = [];
  let progressMarks = [];
  let activeIndex = 0;
  let visible = false;
  let hovered = false;
  let timer;

  const visibility = 'IntersectionObserver' in window
    ? new IntersectionObserver(([entry]) => {
      if (entry.target !== carousel) return;
      visible = entry.intersectionRatio >= 0.25;
      scheduleRotation();
    }, {threshold: 0.25})
    : null;

  function scheduleRotation() {
    window.clearTimeout(timer);
    const focused = carousel?.contains(document.activeElement) && document.activeElement.matches(':focus-visible');
    if (slides.length < 2 || !visible || hovered || focused || reducedMotion.matches || document.hidden) return;
    timer = window.setTimeout(() => showSlide(activeIndex + 1), rotationDelay);
  }

  function showSlide(index) {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === activeIndex;
      slide.inert = !active;
      slide.setAttribute('aria-hidden', String(!active));
      slide.classList.toggle('is-active', active);
      progressMarks[slideIndex]?.classList.toggle('is-current', active);
    });
    carousel.querySelector('.promotions-position').textContent = `${activeIndex + 1} / ${slides.length}`;
    scheduleRotation();
  }

  function syncCarousel() {
    const nextCarousel = store.dataset.view === 'home' ? main.querySelector('.home-promotions') : null;
    if (nextCarousel === carousel) return;
    visibility?.disconnect();
    carousel = nextCarousel;
    slides = carousel ? [...carousel.querySelectorAll('.promotion-slide')] : [];
    progressMarks = carousel ? [...carousel.querySelectorAll('.promotions-progress > span')] : [];
    visible = Boolean(carousel && !visibility);
    hovered = false;
    if (slides.length) {
      for (const slide of slides) {
        const flyer = slide.querySelector('img');
        slide.style.setProperty('--slide-ratio', Number(flyer.getAttribute('width')) / Number(flyer.getAttribute('height')));
      }
      showSlide(activeIndex);
      slides.forEach(slide => { slide.hidden = false; });
      visibility?.observe(carousel);
    }
    scheduleRotation();
  }

  main.addEventListener('focusin', event => {
    if (carousel?.contains(event.target)) scheduleRotation();
  });

  main.addEventListener('focusout', event => {
    if (carousel?.contains(event.target)) queueMicrotask(scheduleRotation);
  });

  main.addEventListener('pointerover', event => {
    const flyer = event.target.closest('.promotion-slide');
    if (event.pointerType === 'mouse' && flyer && carousel?.contains(flyer) && !flyer.contains(event.relatedTarget)) {
      hovered = true;
      scheduleRotation();
    }
  });

  main.addEventListener('pointerout', event => {
    const flyer = event.target.closest('.promotion-slide');
    if (event.pointerType === 'mouse' && flyer && carousel?.contains(flyer) && !flyer.contains(event.relatedTarget)) {
      hovered = false;
      scheduleRotation();
    }
  });

  reducedMotion.addEventListener('change', scheduleRotation);
  document.addEventListener('visibilitychange', scheduleRotation);
  const viewChanges = new MutationObserver(syncCarousel);
  viewChanges.observe(main, {childList: true});
  viewChanges.observe(store, {attributes: true, attributeFilter: ['data-view']});
  syncCarousel();
})();
