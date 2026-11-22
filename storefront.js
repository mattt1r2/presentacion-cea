const tasks = [
  ['ropa', 'Ropa', 'detergente'],
  ['cocina', 'Cocina', 'desengrasante'],
  ['pisos', 'Pisos', 'pisos'],
  ['llantas', 'Llantas', 'llantas'],
  ['carroceria', 'Carrocería', 'lavado'],
  ['tapiz', 'Tapiz', 'tapiz']
];

const regions = ['Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo','Valparaíso','Metropolitana de Santiago','Libertador General Bernardo O’Higgins','Maule','Ñuble','Biobío','La Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes'];
const sample = { first:'Camila', last:'Ejemplo', email:'cliente@example.com', phone:'+56 9 0000 0000', address:'Calle de Ejemplo 123', city:'Talca', region:'Maule' };
const minimum = 20000;
const modeLabels = {minorista:'Al detalle', mayorista:'Mayorista'};
const catalogLines = [['todos','Todo'], ['hogar','Hogar'], ['automotriz','Automotriz'], ['promociones','Ofertas']];
const catalogModes = [['todos','Todos'], ...Object.entries(modeLabels)];
const catalogSorts = [['destacados','Destacados'], ['precio-asc','Menor precio'], ['precio-desc','Mayor precio'], ['nombre','Nombre']];
const formerProductSlugs = new Map([
  ['promo-gel', ['detergente', 0]],
  ['promo-gel-pack', ['detergente', 2]],
  ['promo-pisos', ['pisos', 0]],
  ['promo-tapiz', ['tapiz', 0]],
  ['promo-polvo', ['polvo', 0]],
  ['detergente-liquido-matic-mayorista', ['detergente', 1]],
  ['limpia-pisos-mayorista', ['pisos', 1]],
  ['limpia-tapiz-automotriz-mayorista', ['tapiz', 0]]
]);
const money = new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP'});
const shop = document.querySelector('.store');
const main = document.getElementById('store-main');
const siteHeader = shop.querySelector('.site-header');
const primaryNav = siteHeader.querySelector('nav');
const cartLink = siteHeader.querySelector('.site-cart');
const cartCount = cartLink.querySelector('[data-count]');
const cartDrawer = shop.querySelector('.cart-drawer');
const quickDialog = shop.querySelector('.quick-dialog');
const cartToast = shop.querySelector('.cart-toast');
const landing = Array.from(main.childNodes, node => node.cloneNode(true));
const landingObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('landing-revealed');
      landingObserver.unobserve(entry.target);
    }
  }, {threshold:.05})
  : null;
const state = {
  view:'home', use:'ropa', line:'todos', mode:'todos', query:'', sort:'destacados', finder:false,
  product:products[0], format:0, qty:1, cart:loadCart(), contact:{}, error:false, receipt:null
};
let activeNavigation = '';
let scrollFrame = 0;
let quickPurchase;
let cartOpener;
const addFeedbackTimers = new WeakMap();

const currency = amount => money.format(amount);
const getProduct = id => products.find(p => p.id === id);
const upper = value => value[0].toUpperCase() + value.slice(1);
const purchaseModeText = product => product.modes.map(mode => modeLabels[mode]).join(' · ');
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const basePrice = product => Math.min(...product.formats.map(([, price]) => price));
const priceLabel = product => (product.formats.length > 1 ? 'Desde ' : '') + currency(basePrice(product));
const formatImage = (product, index) => index === product.packFormat && product.packImage ? product.packImage : product.image;
const rows = () => Array.from(state.cart, ([key, {product, formatIndex, qty}]) => ({
  key, name:product.name, image:formatImage(product, formatIndex), format:product.formats[formatIndex][0], qty,
  price:promotionPricing.unitPrice(product, formatIndex, qty)
}));
const subtotal = () => rows().reduce((sum, row) => sum + row.price * row.qty, 0);
const units = () => [...state.cart.values()].reduce((sum, row) => sum + row.qty, 0);
const live = message => { shop.querySelector('[data-live]').textContent = message; };
const scrollToView = () => { window.scrollTo({top:0, behavior:'instant'}); };

function renderHome() {
  if (!main.querySelector('.home-hero')) main.replaceChildren(...landing.map(node => node.cloneNode(true)));
  const finder = main.querySelector('.home-use');
  if (finder.hidden) {
    finder.querySelector('[data-home-use-options]').innerHTML = useButtons();
    renderUse(finder);
    finder.hidden = false;
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const section of main.querySelectorAll('.cea-landing-section > .shell')) {
    if (!section.classList.contains('landing-revealed')) landingObserver?.observe(section);
  }
}

function productMedia(product, label = '', image = product.image) {
  if (image && media[image]) {
    return `<img src="${media[image]}" alt="${escapeHtml(label)}" loading="lazy">`;
  }
  return '<span class="photo-fallback"><strong>CEA</strong><small>Imagen no disponible</small></span>';
}

const factoryFamilies = [
  {id:'polvo', label:'Polvo', name:'Detergente en polvo', detail:'Matic Premium para la ropa'},
  {id:'detergente', label:'Gel', name:'Detergente en gel', detail:'Matic para la ropa'},
  {id:'pisos', label:'Limpiapisos', name:'Limpiapisos', detail:'Limpieza de pisos del hogar'}
];
let activeFamily = factoryFamilies[0];
const factoryChoices = new Map();
let stopFactoryRotation;

function startFactoryRotation(feature) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const options = {signal:events.signal};
  const interval = 7000;
  const fadeDuration = 200;
  let timer;
  let visible = !('IntersectionObserver' in window);
  let overButton = false;

  function canRotate() {
    return !events.signal.aborted && visible && !feature.hidden && !document.hidden && !motion.matches
      && !overButton && !feature.contains(document.activeElement) && !quickDialog.open && !cartDrawer.open;
  }

  function schedule() {
    clearTimeout(timer);
    feature.classList.remove('factory-changing');
    if (canRotate()) timer = setTimeout(beginFade, interval - fadeDuration);
  }

  function beginFade() {
    if (!canRotate()) return;
    feature.classList.add('factory-changing');
    timer = setTimeout(() => {
      if (canRotate()) {
        activeFamily = factoryFamilies[(factoryFamilies.indexOf(activeFamily) + 1) % factoryFamilies.length];
        renderFactoryFamily(true);
      }
      schedule();
    }, fadeDuration);
  }

  const visibility = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= .25;
    schedule();
  }, {threshold:.25}) : null;
  visibility?.observe(feature);
  const changes = new MutationObserver(schedule);
  changes.observe(feature, {attributes:true, attributeFilter:['hidden']});
  for (const dialog of [quickDialog, cartDrawer]) {
    changes.observe(dialog, {attributes:true, attributeFilter:['open']});
  }
  feature.addEventListener('pointerover', event => {
    if (event.pointerType === 'mouse' && event.target.closest('button')) {
      overButton = true;
      schedule();
    }
  }, options);
  feature.addEventListener('pointerout', event => {
    const nextButton = event.relatedTarget?.closest?.('button');
    if (overButton && (!nextButton || !feature.contains(nextButton))) {
      overButton = false;
      schedule();
    }
  }, options);
  feature.addEventListener('focusin', schedule, options);
  feature.addEventListener('focusout', () => queueMicrotask(schedule), options);
  motion.addEventListener('change', schedule, options);
  document.addEventListener('visibilitychange', schedule, options);

  function stop() {
    if (events.signal.aborted) return;
    events.abort();
    visibility?.disconnect();
    changes.disconnect();
    clearTimeout(timer);
    feature.classList.remove('factory-changing');
    feature.querySelector('.factory-price').setAttribute('aria-live', 'polite');
  }
  function stopOnChoice(event) {
    if (event.target.closest('button')) stop();
  }
  feature.addEventListener('pointerdown', schedule, options);
  feature.addEventListener('click', stopOnChoice, options);
  schedule();
  return stop;
}

function factoryOptions(product) {
  if (product.id === 'polvo') {
    return promotionPricing.quantityPrices(product, 0).map(([quantity]) => ({
      label:quantity === 1 ? '1 saco' : `${quantity} sacos`, format:0, quantity
    }));
  }
  return product.formats.map(([label], format) => ({
    label:label.replace(' con suavizante', ''), format, quantity:1
  }));
}

function shopFeatures() {
  return `<section class="market-features" aria-labelledby="factory-heading">
    <div class="factory-bar">
      <h2 id="factory-heading">Fabricación propia</h2>
      <div class="factory-families" role="group" aria-label="Elegir producto de fabricación propia">
        ${factoryFamilies.map(family => `<button type="button" data-action="factory-family" data-id="${family.id}" aria-pressed="${family === activeFamily}" aria-controls="factory-display">${family.label}</button>`).join('')}
      </div>
    </div>
    <div id="factory-display"></div>
  </section>`;
}

function renderFactoryFamily(automatic = false) {
  const feature = main.querySelector('.market-features');
  const product = getProduct(activeFamily.id);
  const options = factoryOptions(product);
  feature.dataset.family = product.id;
  for (const button of feature.querySelectorAll('[data-action=factory-family]')) {
    button.setAttribute('aria-pressed', button.dataset.id === product.id);
  }
  let photo = productMedia(product, product.name);
  if (product.id === 'polvo') photo = `<span class="shelf-sack">${photo}</span>`;
  if (product.id === 'detergente') photo = '<img src="assets/cea-matic-aqua.webp" width="1672" height="941" alt="Bidones de detergente en gel Matic CEA">';
  feature.querySelector('#factory-display').innerHTML = `
    <div class="factory-intro">
      <h3>${activeFamily.name}</h3>
      <p>${activeFamily.detail}</p>
    </div>
    <figure class="market-photo-stage">${photo}</figure>
    <div class="factory-buy">
      <fieldset class="factory-options"><legend>${product.id === 'polvo' ? 'Cantidad de sacos' : 'Presentación'}</legend>
        <div>${options.map((option, i) => `<button type="button" data-action="factory-option" data-index="${i}" aria-pressed="false">${escapeHtml(option.label)}</button>`).join('')}</div>
      </fieldset>
      <div class="factory-order">
        <div class="factory-price" aria-live="${automatic ? 'off' : 'polite'}" aria-atomic="true">
          <div><strong data-factory-price></strong> <span data-factory-basis></span></div>
          <small data-factory-note></small>
        </div>
        <button class="factory-buy-button" type="button" aria-haspopup="dialog" data-action="factory-buy"><span data-add-label="Comprar">Comprar</span><span aria-hidden="true" data-add-icon="+">+</span></button>
      </div>
    </div>`;
  updateFactoryOffer();
}

function updateFactoryOffer() {
  const feature = main.querySelector('#factory-display');
  if (!feature) return;
  const product = getProduct(activeFamily.id);
  const index = factoryChoices.get(product.id) ?? 0;
  const {format, quantity} = factoryOptions(product)[index];
  const price = purchasePreview(product, format, quantity);
  const unit = purchasePresentation(product, format);
  const countLabel = price.totalQuantity === 1 ? unit.singular : unit.plural;
  const tier = promotionPricing.tiers(product, format).find(([minimum]) => minimum > price.totalQuantity);
  let note = '';
  if (price.includesCart) note = `Al agregar, ${price.totalQuantity} ${countLabel} por ${currency(price.total)} en total`;
  else if (quantity > 1) note = `${quantity} ${unit.plural} por ${currency(price.total)} en total`;
  else if (tier) note = `Desde ${tier[0]} ${unit.plural}, ${currency(tier[1])} c/u`;
  else if (format === product.packFormat) note = unit.label.replace(/^Pack de /i, '');
  feature.querySelector('[data-factory-price]').textContent = currency(price.price);
  feature.querySelector('[data-factory-basis]').textContent = format === product.packFormat ? 'por pack' : unit.priceBasis;
  feature.querySelector('[data-factory-note]').textContent = note;
  for (const button of feature.querySelectorAll('[data-action=factory-option]')) {
    button.setAttribute('aria-pressed', Number(button.dataset.index) === index);
  }
}

function renderShop() {
  const finderVisible = state.finder;
  main.innerHTML = `
    <div class="shop-screen shop-market">
      <header class="market-head shell">
        <div class="market-mast">
          <h1 tabindex="-1">Tienda</h1>
          <form class="market-search" role="search" id="catalog-search-form">
            <label class="sr-only" for="catalog-search">Buscar productos en la tienda</label>
            <input id="catalog-search" type="search" data-search placeholder="Buscar un producto" value="${escapeHtml(state.query)}" aria-controls="catalog-products">
            <button type="submit" aria-label="Buscar en el catálogo"><span class="market-lens" aria-hidden="true"></span></button>
          </form>
          <p class="market-minimum">Pedido mínimo <strong>${currency(minimum)}</strong></p>
        </div>
        <div class="market-nav" role="group" aria-label="Categorías de la tienda">
          ${catalogLines.map(([key,label]) => `<button type="button" data-action="market-line" data-line="${key}" aria-pressed="${key === state.line}" aria-controls="catalog-products">${label}</button>`).join('')}
        </div>
      </header>
      <div class="shell market-body">
      ${shopFeatures()}
      <section class="catalog-zone" id="catalog-zone" aria-labelledby="catalog-title">
        <div class="market-catalog-head">
          <div class="market-result-title"><h2 id="catalog-title" tabindex="-1">Catálogo</h2>
            <p class="catalog-count" aria-live="polite"></p></div>
          <div class="market-controls">
            <label>Tipo de compra<select data-mode aria-controls="catalog-products">${catalogOptions(catalogModes, state.mode)}</select></label>
            <label>Ordenar por<select data-sort aria-controls="catalog-products">${catalogOptions(catalogSorts, state.sort)}</select></label>
            <button type="button" class="market-finder" data-action="finder" aria-expanded="${finderVisible}" aria-controls="use-zone">Buscar por uso</button>
          </div>
        </div>
        <button type="button" class="text-button catalog-reset" data-action="reset-filters" hidden>Limpiar filtros</button>
      <section class="use-zone" id="use-zone" aria-labelledby="use-title" ${finderVisible ? '' : 'hidden'}>
        <div class="use-layout">
          <div class="use-heading">
            <h2 id="use-title" tabindex="-1">¿Qué vas a limpiar?</h2>
            <div class="use-lines" role="group" aria-label="Línea para buscar por uso">
              <button type="button" data-action="use-line" data-use-line="automotriz" aria-pressed="false">Automotriz</button>
              <button type="button" data-action="use-line" data-use-line="hogar" aria-pressed="false">Hogar</button>
            </div>
            <div class="use-buttons" role="group" aria-label="Usos">${useButtons()}</div>
          </div>
          <div class="use-result" aria-live="polite"></div>
        </div>
      </section>
        <div class="products" id="catalog-products"></div>
      </section>
      </div>
    </div>`;
  renderUse(main.querySelector('#use-zone'));
  renderFactoryFamily();
  renderProducts();
  stopFactoryRotation = startFactoryRotation(main.querySelector('.market-features'));
}

function catalogOptions(options, selected) {
  return options.map(([key, label]) => `<option value="${key}"${key === selected ? ' selected' : ''}>${label}</option>`).join('');
}

function useButtons() {
  return tasks.map(([key, label]) => `
    <button type="button" class="chip" data-action="uses" data-use="${key}" data-use-choice aria-pressed="${key === state.use}">${label}</button>`).join('');
}

function renderUse(finder, animate = false) {
  const task = tasks.find(([id]) => id === state.use);
  const p = getProduct(task[2]);
  const onHome = finder.classList.contains('home-use');
  for (const button of finder.querySelectorAll('[data-use-line]')) {
    button.setAttribute('aria-pressed', button.dataset.useLine === p.line);
  }
  for (const button of finder.querySelectorAll('[data-use-choice]')) {
    const option = tasks.find(([key]) => key === button.dataset.use);
    button.hidden = !onHome && getProduct(option[2]).line !== p.line;
    button.setAttribute('aria-pressed', option[0] === state.use);
  }
  finder.querySelector('.use-result').innerHTML = `
    <article class="recommend${animate ? ' recommend-updated' : ''}">
      ${productMedia(p)}
      <div><span class="eyebrow">${task[1]} · ${upper(p.line)}</span><h3>${escapeHtml(p.name)}</h3>
        <span class="recommend-format">${p.formats.map(([format]) => escapeHtml(format)).join(' · ')}</span>
        <strong>${priceLabel(p)}</strong>
        <a class="${onHome ? 'primary' : 'text-button'}" href="#producto/${p.slug}" data-action="product" data-id="${p.id}">Elegir formato <span aria-hidden="true">↗</span></a>
      </div>
    </article>`;
}

function renderProducts() {
  const query = normalize(state.query);
  const order = {
    'precio-asc': (a,b) => basePrice(a) - basePrice(b),
    'precio-desc': (a,b) => basePrice(b) - basePrice(a),
    'nombre': (a,b) => a.name.localeCompare(b.name,'es-CL')
  };
  const result = products.filter(product => (state.line === 'todos' || state.line === product.line
    || (state.line === 'promociones' && promotionPricing.hasOffer(product)))
    && (state.mode === 'todos' || product.modes.includes(state.mode))
    && normalize([product.name, product.line, product.description, ...product.formats.map(([format]) => format)].join(' ')).includes(query));
  if (order[state.sort]) result.sort(order[state.sort]);
  main.querySelectorAll('[data-action=market-line]').forEach(button => button.setAttribute('aria-pressed', state.line === button.dataset.line));
  main.querySelector('[data-mode]').value = state.mode;
  const filtered = Boolean(query) || state.line !== 'todos' || state.mode !== 'todos';
  main.querySelector('.market-features').hidden = filtered;
  main.querySelector('[data-action=reset-filters]').hidden = !filtered;
  main.querySelector('#catalog-title').textContent = query ? 'Resultados de búsqueda'
    : state.line === 'todos' ? 'Catálogo' : catalogLines.find(([key]) => key === state.line)[1];
  main.querySelector('.catalog-count').textContent = `${result.length} ${result.length === 1 ? 'producto' : 'productos'}`;
  main.querySelector('.products').innerHTML = result.length ? result.map(p => {
    const lowestPrice = basePrice(p);
    const matchingFormats = p.formats.filter(([, price]) => price === lowestPrice);
    const formatLabel = matchingFormats.map(([format]) => escapeHtml(format)).join(' / ');
    const mode = p.modes.length > 1 && !p.tiersByFormat ? 'Al detalle y por mayor' : modeLabels[p.modes[0]];
    let photo = productMedia(p);
    if (p.image === 'promo-polvo') photo = `<span class="shelf-sack">${photo}</span>`;
    if (p.image === 'producto-573') photo = '<img src="assets/cea-matic-aqua.webp" alt="" loading="lazy">';
    if (!p.image) photo = '<span class="shelf-no-photo">Sin fotografía</span>';
    return `<article class="product" data-shelf-line="${p.line}">
      <a class="product-link" href="#producto/${p.slug}" data-action="product" data-id="${p.id}">
        <div class="product-picture" data-photo="${p.image ?? ''}">${photo}</div>
        <div class="product-copy">
          <h3>${escapeHtml(p.name)}</h3>
          <div class="shelf-pricing">
            <span class="shelf-price-context">${mode} · ${formatLabel}</span>
            <p>${matchingFormats.length < p.formats.length ? '<small>Desde</small> ' : ''}<strong>${currency(lowestPrice)}</strong></p>
            ${p.formats.map(([format], index) => {
              const tier = promotionPricing.tiers(p, index).at(-1);
              if (!tier) return '';
              const presentation = p.formats.length > 1 ? escapeHtml(format) + ' · ' : '';
              return `<small class="product-volume-price">${presentation}${tier[0]} o más a ${currency(tier[1])} c/u</small>`;
            }).join('')}
            ${p.packFormat != null ? `<small class="product-volume-price">${escapeHtml(p.formats[p.packFormat][0])} · ${currency(p.formats[p.packFormat][1])}</small>` : ''}
          </div>
        </div>
      </a>
      <div class="product-actions">
        <button type="button" class="primary quick-add" data-action="quick-buy" data-id="${p.id}" aria-haspopup="dialog" aria-label="Agregar ${escapeHtml(p.name)}, ${purchaseModeText(p)}"><span data-add-label="Agregar">Agregar</span><span aria-hidden="true" data-add-icon="+">+</span></button>
      </div>
    </article>`;
  }).join('') : '<p class="empty">No hay productos para esta búsqueda. Prueba con otro nombre o filtro.</p>';
}

function showUse(use, finder) {
  if (use === state.use) return;
  state.use = use;
  renderUse(finder, true);
}

function toggleFinder() {
  const section = main.querySelector('#use-zone');
  state.finder = section.hidden;
  section.hidden = !state.finder;
  main.querySelector('[data-action=finder]').setAttribute('aria-expanded', state.finder);
  if (state.finder) jump('use-zone');
}

function showCatalog(line) {
  if (line) {
    state.line = line;
    state.mode = 'todos';
    state.query = '';
  }
  if (state.view !== 'shop') go('shop');
  else {
    main.querySelector('[data-search]').value = state.query;
    renderProducts();
    jump('catalog-zone');
  }
}

const fragments = {home:'inicio', shop:'tienda', cart:'carrito', checkout:'datos', payment:'pago', confirmation:'confirmacion'};
const landingAnchors = new Set(['por-uso','promociones','empresa','lineas','granel','contacto']);

function productFragment(product, formatIndex) {
  const suffix = formatIndex === product.packFormat ? '/pack' : formatIndex > 0 ? `/formato-${formatIndex + 1}` : '';
  return `producto/${product.slug}${suffix}`;
}

function highlightNavigation(key, measure = false) {
  if (activeNavigation === key && !measure) return;
  activeNavigation = key;
  for (const link of primaryNav.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === key) link.setAttribute('aria-current', state.view === 'home' ? 'location' : 'page');
    else link.removeAttribute('aria-current');
  }
  const current = primaryNav.querySelector('[aria-current]');
  primaryNav.style.setProperty('--nav-offset', current.offsetLeft + 'px');
  primaryNav.style.setProperty('--nav-width', current.offsetWidth + 'px');
  primaryNav.classList.add('nav-ready');
}

function updateLandingNavigation() {
  if (state.view !== 'home') return;
  const threshold = siteHeader.getBoundingClientRect().bottom + Math.min(100, window.innerHeight * .15);
  const footerTop = document.getElementById('contacto').getBoundingClientRect().top;
  const atBottom = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 4;
  if (footerTop <= threshold || (atBottom && footerTop < window.innerHeight)) {
    highlightNavigation('contacto');
  } else {
    highlightNavigation(document.getElementById('empresa').getBoundingClientRect().top <= threshold ? 'empresa' : 'inicio');
  }
}

function go(view, {focus = true, scroll = true, replace = false, anchor = ''} = {}) {
  if (view === 'cart' || (view === 'checkout' && subtotal() < minimum)
    || (view === 'payment' && (!state.contact.email || subtotal() < minimum))) {
    openCart({replace:replace || view !== 'cart'});
    return;
  }
  if (view === 'confirmation' && !state.receipt) view = 'home';
  const fragment = view === 'product' ? productFragment(state.product, state.format) : (anchor || fragments[view]);
  if (location.hash !== '#' + fragment) history[replace ? 'replaceState' : 'pushState'](null, '', '#' + fragment);
  state.view = view;
  shop.dataset.view = view;
  if (view !== 'home') landingObserver?.disconnect();
  cartLink.hidden = view === 'home';
  if (['checkout','payment','confirmation'].includes(view)) cartLink.setAttribute('aria-current','page');
  else cartLink.removeAttribute('aria-current');
  cartToast.hidden = true;
  if (quickDialog.open) quickDialog.close();
  if (cartDrawer.open) cartDrawer.close();
  stopFactoryRotation?.();
  stopFactoryRotation = undefined;
  screens[view]();
  const activeNav = view !== 'home' ? 'tienda' : anchor === 'contacto' ? 'contacto' : ['empresa','lineas','granel'].includes(anchor) ? 'empresa' : 'inicio';
  highlightNavigation(activeNav, true);
  const title = main.querySelector('h1')?.textContent.trim();
  document.title = view === 'home' ? 'Distribuidora CEA · Fabricación propia' : title + ' · Distribuidora CEA';
  if (anchor && landingAnchors.has(anchor)) {
    jump(anchor, focus);
  } else {
    if (scroll) scrollToView();
    if (focus) main.querySelector('h1')?.focus({preventScroll:true});
  }
}

function restoreRoute(focus) {
  const hash = location.hash.slice(1);
  if (landingAnchors.has(hash)) {
    go('home', {anchor:hash, focus, replace:true});
    return;
  }
  if (hash.startsWith('producto/')) {
    const [, slug, suffix, extra] = hash.split('/');
    const [formerId, formerFormat = 0] = formerProductSlugs.get(slug) ?? [];
    const product = products.find(item => item.slug === slug) ?? getProduct(formerId);
    const formatNumber = suffix?.match(/^formato-(\d+)$/);
    const formatIndex = suffix === undefined ? formerFormat : suffix === 'pack' ? product?.packFormat : Number(formatNumber?.[1]) - 1;
    if (extra === undefined && product?.formats[formatIndex]) {
      if (state.product !== product || state.format !== formatIndex) {
        state.product = product;
        state.format = formatIndex;
        state.qty = 1;
      }
      go('product', {focus, replace:true});
      return;
    }
  }
  const view = Object.keys(fragments).find(key => fragments[key] === hash) ?? 'home';
  go(view, {focus, replace:true});
}

function cartKey(product, formatIndex) {
  return product.id + '-' + formatIndex;
}

function cartQuantity(product, formatIndex) {
  return state.cart.get(cartKey(product, formatIndex))?.qty ?? 0;
}

function purchasePreview(product, formatIndex, quantity) {
  const current = promotionPricing.tiers(product, formatIndex).length ? cartQuantity(product, formatIndex) : 0;
  const totalQuantity = Math.min(99, current + quantity);
  const price = promotionPricing.unitPrice(product, formatIndex, totalQuantity);
  return {price, totalQuantity, total:price * totalQuantity, includesCart:current > 0};
}

function purchasePresentation(product, formatIndex) {
  const label = product.formats[formatIndex][0];
  const packaging = /^\s*saco\b/i.test(label) ? ['saco', 'sacos']
    : /^\s*pack\b/i.test(label) ? ['pack', 'packs']
    : /^\s*bid[oó]n\b/i.test(label) ? ['bidón', 'bidones']
    : ['unidad', 'unidades'];
  const [singular, plural] = packaging;
  const priceBasis = singular === 'unidad'
    ? `por unidad · ${label}`
    : `por ${label.charAt(0).toLocaleLowerCase('es-CL')}${label.slice(1)}`;
  return {label, singular, plural, priceBasis};
}

function quantityPricingMarkup(product, formatIndex) {
  if (!promotionPricing.tiers(product, formatIndex).length) return '';
  const prices = promotionPricing.quantityPrices(product, formatIndex);
  const {singular, plural} = purchasePresentation(product, formatIndex);
  return `<div class="quantity-prices"><strong>Precios por cantidad</strong>
    <dl>${prices.map(([minimum, amount], index) => {
      const nextTier = prices[index + 1];
      const range = nextTier ? `${minimum} a ${nextTier[0] - 1} ${plural}` : `Desde ${minimum} ${plural}`;
      const option = index > 0
        ? `<button class="tier-quantity" type="button" data-action="tier-quantity" data-minimum="${minimum}" aria-label="${range}, ${currency(amount)} por ${singular}; seleccionar esta cantidad">${range}</button>`
        : range;
      return `<div><dt>${option}</dt><dd>${currency(amount)} por ${singular}</dd></div>`;
    }).join('')}</dl></div>`;
}

function renderPurchasePresentation(container, product, formatIndex) {
  const presentation = purchasePresentation(product, formatIndex);
  const label = `${product.name} · ${presentation.label}`;
  container.querySelector('[data-purchase-photo]').innerHTML = productMedia(product, label, formatImage(product, formatIndex));
  container.querySelector('[data-quantity-prices]').innerHTML = quantityPricingMarkup(product, formatIndex);
  container.querySelector('[data-price-format]').textContent = presentation.priceBasis;
  container.querySelector('[data-quantity-label]').textContent = `Cantidad de ${presentation.plural}`;
  const quantity = container.querySelector('.quantity');
  quantity.setAttribute('aria-label', `Cantidad de ${presentation.plural} · ${label}`);
  quantity.querySelector('output').setAttribute('aria-label', `Cantidad de ${presentation.plural}`);
  const article = presentation.singular === 'unidad' ? 'una' : 'un';
  quantity.querySelector('[data-delta="-1"]').setAttribute('aria-label', `Restar ${article} ${presentation.singular} · ${label}`);
  quantity.querySelector('[data-delta="1"]').setAttribute('aria-label', `Sumar ${article} ${presentation.singular} · ${label}`);
}

function renderDetail() {
  const p = state.product;
  main.innerHTML = `
    <section class="shell shop-view product-detail">
      <button class="text-button back" type="button" data-action="catalog">← Volver a Tienda</button>
      <div class="product-view">
        <figure class="detail-photo" data-purchase-photo></figure>
        <div class="detail-summary">
          <header class="detail-intro">
            <span class="eyebrow">${upper(p.line)} · ${purchaseModeText(p)}</span>
            <h1 class="view-title" tabindex="-1">${escapeHtml(p.name)}</h1>
            ${p.description ? `<p class="description">${escapeHtml(p.description)}</p>` : ''}
          </header>
          <div class="detail-purchase">
            <div class="detail-price-row"><p class="detail-price" data-price></p><span data-price-format></span></div>
            <strong class="detail-label" id="detail-format-label">Presentación</strong>
            <div class="variant-group" role="group" aria-labelledby="detail-format-label">${p.formats.map(([label], index) => `
              <button type="button" class="chip" data-action="variant" data-index="${index}" aria-pressed="${index === state.format}">${escapeHtml(label)}</button>`).join('')}</div>
            <strong class="detail-label" data-quantity-label>Cantidad</strong>
            <div class="detail-actions">
              ${stepper(state.qty, 'quantity', '', p.name, 1)}
              <button class="primary" type="button" data-action="add" aria-label="Agregar al carrito"><span data-add-label="Agregar al carrito">Agregar al carrito</span><span aria-hidden="true" data-add-icon="→">→</span></button>
            </div>
            <p class="detail-note" data-detail-total aria-live="polite"></p>
            <div data-quantity-prices></div>
          </div>
        </div>
      </div>
    </section>`;
  renderPurchasePresentation(main, p, state.format);
  updateDetail();
}

function updateDetail() {
  const presentation = purchasePresentation(state.product, state.format);
  const preview = purchasePreview(state.product, state.format, state.qty);
  const quantityLabel = `${preview.totalQuantity} ${preview.totalQuantity === 1 ? presentation.singular : presentation.plural}`;
  main.querySelector('[data-price]').textContent = currency(preview.price);
  main.querySelector('[data-detail-total]').textContent = preview.includesCart
    ? `Carrito al agregar · ${currency(preview.total)} por ${quantityLabel} de esta presentación`
    : `Subtotal · ${currency(preview.total)} por ${quantityLabel}`;
  main.querySelector('output').value = state.qty;
  main.querySelector('[data-delta="-1"]').disabled = state.qty <= 1;
  main.querySelector('[data-delta="1"]').disabled = state.qty >= 99;
  main.querySelectorAll('[data-index]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.index) === state.format));
}

function stepper(qty, action, key, name, min = 0) {
  return `<div class="quantity" role="group" aria-label="Cantidad de ${name}">
    <button type="button" data-action="${action}" data-delta="-1" data-key="${key}" aria-label="Restar una unidad de ${name}" ${qty <= min ? 'disabled' : ''}>−</button>
    <output aria-label="Unidades">${qty}</output>
    <button type="button" data-action="${action}" data-delta="1" data-key="${key}" aria-label="Sumar una unidad de ${name}" ${qty >= 99 ? 'disabled' : ''}>+</button>
  </div>`;
}

function progress(current) {
  return `<ol class="steps" aria-label="Pasos de compra">${['Carrito','Datos','Pago','Confirmación'].map((step, i) => `<li${i === current ? ' aria-current="step"' : ''}>${step}</li>`).join('')}</ol>`;
}

function renderCart() {
  const order = rows();
  const total = subtotal();
  const pending = Math.max(minimum - total, 0);
  const body = cartDrawer.querySelector('[data-cart-body]');
  const scroll = body.scrollTop;
  body.innerHTML = order.length ? `<ul class="order-list">${order.map(row => `
          <li class="order-row">
            ${productMedia(row)}
            <div><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.format)} · ${currency(row.price)} c/u</small>
              <div class="order-qty">${stepper(row.qty,'adjust',row.key,row.name)}
                <button class="text-button" type="button" data-action="remove" data-key="${row.key}" aria-label="Quitar ${escapeHtml(row.name)} ${escapeHtml(row.format)}">Quitar</button>
              </div>
            </div><b>${currency(row.price * row.qty)}</b>
          </li>`).join('')}</ul>` : '<p class="cart-drawer-empty">Tu carrito está vacío.</p>';
  body.scrollTop = scroll;
  cartDrawer.querySelector('[data-cart-summary]').innerHTML = `
    <p class="summary-line"><span>Subtotal de productos</span><strong>${currency(total)}</strong></p>
    <progress class="minimum-bar" max="${minimum}" value="${Math.min(total,minimum)}" aria-label="Avance hacia el pedido mínimo"></progress>
    <p class="hint" aria-live="polite">${pending ? `Te faltan ${currency(pending)} para el mínimo de ${currency(minimum)}.` : 'Alcanzaste el pedido mínimo.'}</p>
    <button class="primary" type="button" data-action="checkout" ${pending ? 'disabled' : ''}>Continuar al pago <span aria-hidden="true">→</span></button>`;
}

function openCart({replace = false} = {}) {
  if (!['shop','product'].includes(state.view) || location.hash === '#carrito') {
    go('shop', {replace:replace || location.hash === '#carrito'});
  }
  const focused = document.activeElement;
  cartOpener = focused === document.body || cartToast.contains(focused) ? cartLink : focused;
  cartToast.hidden = true;
  renderCart();
  if (cartDrawer.open) return;
  cartDrawer.showModal();
  cartLink.setAttribute('aria-expanded','true');
  cartDrawer.querySelector('[data-action=close-cart]').focus();
}

function contactField(name, label, type = 'text', full = false) {
  return `<label${full ? ' class="span"' : ''}>${label}<input class="input" name="${name}" type="${type}" required value="${escapeHtml(state.contact[name])}"></label>`;
}

function orderSummary(order, total) {
  return `<ul>${order.map(item => `<li><span>${item.qty} × ${escapeHtml(item.name)} · ${escapeHtml(item.format)}</span><b>${currency(item.qty * item.price)}</b></li>`).join('')}</ul>
    <p class="summary-line summary-total"><span>Total de demostración</span><strong>${currency(total)}</strong></p>`;
}

function renderCheckout() {
  main.innerHTML = `
    <section class="shell shop-view">
      <button class="text-button back" type="button" data-action="cart">← Volver al carrito</button>
      ${progress(1)}
      <h1 class="view-title" tabindex="-1">Finalizar compra</h1>
      <form id="checkout-form" autocomplete="off">
        <div class="order-layout">
          <div>
            <section class="order-panel">
              <div class="checkout-heading"><h2>Datos de contacto</h2><button class="secondary" type="button" data-action="fill">Usar datos de prueba</button></div>
              <div class="form-fields">
                ${contactField('first','Nombre')}${contactField('last','Apellidos')}
                ${contactField('email','Correo electrónico','email')}${contactField('phone','Teléfono','tel')}
              </div>
            </section>
            <section class="order-panel">
              <h2>Dirección del pedido</h2>
              <div class="form-fields">
                ${contactField('address','Dirección en Chile','text',true)}
                ${contactField('city','Comuna o ciudad')}
                <label>Región<select class="input" name="region" required><option value="">Selecciona</option>${regions.map(region => `<option${region === state.contact.region ? ' selected' : ''}>${region}</option>`).join('')}</select></label>
              </div>
            </section>
            <section class="order-panel">
              <h2>Forma de pago</h2>
              <div class="method"><strong>Webpay Plus</strong><span>Pago en línea con Transbank</span></div>
            </section>
          </div>
          <aside class="summary-panel checkout-summary">
            <h2>Tu pedido</h2>
            ${orderSummary(rows(),subtotal())}
            <button class="primary" type="submit">Continuar a Webpay <span aria-hidden="true">→</span></button>
            <p class="hint">Compra de prueba. Usa datos ficticios. Los montos corresponden solo a los productos.</p>
          </aside>
        </div>
      </form>
    </section>`;
}

function renderPayment() {
  main.innerHTML = `
    <section class="shell shop-view">
      <div class="payment">
        <button class="text-button back" type="button" data-action="checkout">← Volver a tus datos</button>
        ${progress(2)}
        <h1 class="view-title" tabindex="-1">Pago en línea</h1>
        <div class="gateway">
          <div class="gateway-name"><strong>Webpay Plus</strong><span>Demostración</span></div>
          <p>Distribuidora CEA</p><p class="gateway-total">${currency(subtotal())}</p>
          <p class="hint">Simula un resultado de Webpay para revisar el regreso a la tienda.</p>
          ${state.error ? '<p class="payment-error" role="alert">El pago de prueba fue rechazado. Tu carrito y tus datos siguen disponibles para reintentar.</p>' : ''}
          <div class="gateway-actions">
            <button class="primary" type="button" data-action="approve">Simular pago aprobado</button>
            <button class="secondary" type="button" data-action="reject">Simular rechazo</button>
          </div>
        </div>
      </div>
    </section>`;
}

function renderConfirmation() {
  const order = state.receipt;
  main.innerHTML = `
    <section class="shell shop-view">
      <div class="payment">
        ${progress(3)}
        <h1 class="view-title" tabindex="-1">Pedido confirmado</h1>
        <div class="confirmed">
          <strong>Pago de prueba aprobado</strong>
          <p>Pedido ${order.id} · ${escapeHtml(order.email)}</p>
        </div>
        <div class="order-panel checkout-summary">
          <h2>Detalle de la compra</h2>
          ${orderSummary(order.items,order.total)}
          <button class="secondary receipt-email-preview" type="button" data-action="preview-email">Ver correo de confirmación <span aria-hidden="true">↗</span></button>
          <p class="hint">Vista previa del correo. El envío se habilita al conectar la tienda real.</p>
          <button class="primary" type="button" data-action="catalog" data-line="todos">Volver a la tienda <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </section>`;
}


const screens = { home:renderHome, shop:renderShop, product:renderDetail, checkout:renderCheckout, payment:renderPayment, confirmation:renderConfirmation };

function jump(id, focus = true) {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({block:'start'});
  if (focus) {
    const heading = section.querySelector('[data-section-heading]') ?? section.querySelector('h2') ?? section;
    heading.tabIndex = -1;
    heading.focus({preventScroll:true});
  }
}

function updateCount() {
  cartCount.textContent = units();
  if (state.view === 'shop') updateFactoryOffer();
  try {
    const quantities = [...state.cart].map(([key, item]) => [key, item.qty]);
    sessionStorage.setItem('cea-cart', JSON.stringify(quantities));
  } catch {
    // The cart still works in memory if the browser blocks storage.
  }
}

function loadCart() {
  const cart = new Map();
  try {
    const entries = JSON.parse(sessionStorage.getItem('cea-cart') ?? '[]');
    if (!Array.isArray(entries)) return cart;
    for (const entry of entries) {
      if (!Array.isArray(entry)) continue;
      const [savedKey, qty] = entry;
      if (typeof savedKey !== 'string' || !Number.isInteger(qty) || qty < 1 || qty > 99) continue;
      const key = promotionPricing.replacedCartKeys.get(savedKey) ?? savedKey;
      const separator = key.lastIndexOf('-');
      const product = products.find(item => item.id === key.slice(0, separator));
      const formatIndex = Number(key.slice(separator + 1));
      if (!product?.formats[formatIndex] || cartKey(product, formatIndex) !== key) continue;
      const mergedQuantity = Math.min(99, (cart.get(key)?.qty ?? 0) + qty);
      cart.set(key, {product, formatIndex, qty:mergedQuantity});
    }
  } catch {
    // A missing or invalid local snapshot starts an empty cart.
  }
  return cart;
}

function resetAddition(button) {
  clearTimeout(addFeedbackTimers.get(button));
  const label = button.querySelector('[data-add-label]');
  const icon = button.querySelector('[data-add-icon]');
  label.textContent = label.dataset.addLabel;
  icon.textContent = icon.dataset.addIcon;
  button.removeAttribute('data-added');
  addFeedbackTimers.delete(button);
}

function confirmAddition(button) {
  const label = button.querySelector('[data-add-label]');
  const icon = button.querySelector('[data-add-icon]');
  label.textContent = 'Agregado';
  icon.textContent = '✓';
  button.setAttribute('data-added', '');
  clearTimeout(addFeedbackTimers.get(button));
  addFeedbackTimers.set(button, setTimeout(() => resetAddition(button), 1800));
}

function addToCart({product = state.product, formatIndex = state.format, quantity = state.qty, source, animationSource = source}) {
  const key = cartKey(product, formatIndex);
  const current = state.cart.get(key);
  const previous = current?.qty ?? 0;
  const qty = Math.min(99, previous + quantity);
  state.cart.set(key, {product, formatIndex, qty});
  updateCount();
  if (state.view === 'product' && product === state.product && formatIndex === state.format) updateDetail();
  const added = qty - previous;
  const message = added ? `${added} × ${product.name} al carrito.` : 'Ya tienes el máximo de unidades de este formato.';
  if (added) confirmAddition(source);
  else resetAddition(source);
  cartToast.querySelector('[data-toast-label]').textContent = message;
  cartToast.hidden = false;
  cartToast.querySelector('.cart-toast-mark').textContent = added ? '✓' : 'i';
  if (added) {
    window.ceaCartFeedback.play({
      source:animationSource,
      image:media[formatImage(product, formatIndex)],
      target:cartLink,
      toast:cartToast
    });
  }
  live(message);
}

function openQuickBuy(id, source, formatIndex = 0, quantity = 1) {
  const product = getProduct(id);
  if (!product) return;
  formatIndex = product.formats[formatIndex] ? Number(formatIndex) : 0;
  quantity = Math.max(1, Math.min(99, Math.trunc(Number(quantity)) || 1));
  quickPurchase = {product, formatIndex, quantity, source};
  quickDialog.innerHTML = `
    <div class="quick-dialog-head">
      <p>Compra rápida</p>
      <button type="button" class="quick-dialog-close" data-action="close-quick" aria-label="Cerrar compra rápida">×</button>
    </div>
    <div class="quick-dialog-content">
      <figure class="quick-product-photo" data-purchase-photo></figure>
      <div class="quick-product-body">
        <span class="eyebrow">${upper(product.line)} · ${purchaseModeText(product)}</span>
        <h2 id="quick-buy-title">${escapeHtml(product.name)}</h2>
        <label class="quick-format-label">Presentación<select class="input" data-quick-format aria-describedby="quick-format-price">${product.formats.map(([format], index) =>
          `<option value="${index}"${index === formatIndex ? ' selected' : ''}>${escapeHtml(format)}</option>`).join('')}</select></label>
        <p class="quick-format-price" id="quick-format-price"><strong data-quick-price></strong><span data-price-format></span></p>
        <div class="quick-quantity">
          <strong data-quantity-label>Cantidad</strong>
          ${stepper(quantity, 'quick-quantity', '', product.name, 1)}
        </div>
        <div data-quantity-prices></div>
        <div class="quick-summary"><span data-quick-summary-label>Subtotal</span><strong data-quick-total aria-live="polite"></strong></div>
        <p class="detail-note" data-quick-unit hidden></p>
        <button type="button" class="primary" data-action="quick-submit">Agregar al carrito <span aria-hidden="true">→</span></button>
      </div>
    </div>`;
  renderPurchasePresentation(quickDialog, product, quickPurchase.formatIndex);
  updateQuickBuy();
  quickDialog.showModal();
  quickDialog.querySelector('[data-quick-format]').focus();
}

function updateQuickBuy() {
  const {product, formatIndex, quantity} = quickPurchase;
  const presentation = purchasePresentation(product, formatIndex);
  const preview = purchasePreview(product, formatIndex, quantity);
  const quantityLabel = `${preview.totalQuantity} ${preview.totalQuantity === 1 ? presentation.singular : presentation.plural}`;
  quickDialog.querySelector('[data-quick-price]').textContent = currency(preview.price);
  quickDialog.querySelector('[data-quick-summary-label]').textContent = `${preview.includesCart ? 'Carrito al agregar' : 'Subtotal'} · ${quantityLabel}`;
  quickDialog.querySelector('[data-quick-total]').textContent = currency(preview.total);
  const unitPrice = quickDialog.querySelector('[data-quick-unit]');
  unitPrice.hidden = !preview.includesCart;
  if (!unitPrice.hidden) {
    const current = cartQuantity(product, formatIndex);
    unitPrice.textContent = `Incluye ${current} ${current === 1 ? presentation.singular : presentation.plural} que ya tienes de esta presentación.`;
  }
  quickDialog.querySelector('output').value = quantity;
  quickDialog.querySelector('[data-delta="-1"]').disabled = quantity <= 1;
  quickDialog.querySelector('[data-delta="1"]').disabled = quantity >= 99;
}

function selectTier(minimum, inQuickBuy) {
  if (inQuickBuy) {
    const {product, formatIndex} = quickPurchase;
    quickPurchase.quantity = Math.max(1, minimum - cartQuantity(product, formatIndex));
    updateQuickBuy();
  } else {
    state.qty = Math.max(1, minimum - cartQuantity(state.product, state.format));
    updateDetail();
  }
}

function changeCart(action, key, delta) {
  const item = state.cart.get(key);
  if (!item) return;
  item.qty = action === 'remove' ? 0 : Math.max(0, Math.min(99, item.qty + delta));
  if (item.qty === 0) state.cart.delete(key);
  updateCount();
  if (state.view === 'product' && item.product === state.product && item.formatIndex === state.format) updateDetail();
  renderCart();
  const replacement = Array.from(cartDrawer.querySelectorAll('[data-key]')).find(button => button.dataset.key === key && Number(button.dataset.delta) === delta && !button.disabled);
  (replacement ?? cartDrawer.querySelector('[data-action=close-cart]')).focus({preventScroll:true});
}

function fillDemo() {
  Object.assign(state.contact, sample);
  const form = main.querySelector('form');
  for (const [field, value] of Object.entries(sample)) form.elements[field].value = value;
  live('Se agregaron datos de prueba.');
}

let orderNumber = 1;
function approve() {
  state.receipt = {id:`CEA-DEMO-${String(orderNumber++).padStart(3,'0')}`, items:rows(), total:subtotal(), email:state.contact.email, firstName:state.contact.first};
  state.cart.clear();
  state.contact = {};
  state.error = false;
  updateCount();
  go('confirmation');
}

document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus({preventScroll:true});
  main.scrollIntoView({block:'start'});
});

shop.addEventListener('click', event => {
  const control = event.target.closest('button[data-action], a[data-action]');
  if (!control) return;
  if (control instanceof HTMLAnchorElement) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
  }
  const data = control.dataset;
  switch (data.action) {
    case 'home': go('home'); break;
    case 'section': go('home', {anchor:data.section}); break;
    case 'uses': showUse(data.use, control.closest('.home-use, .use-zone')); break;
    case 'use-line': {
      const current = tasks.find(([id]) => id === state.use);
      if (getProduct(current[2]).line !== data.useLine) {
        showUse(data.useLine === 'hogar' ? 'ropa' : 'llantas', control.closest('.use-zone'));
      }
      break;
    }
    case 'catalog': showCatalog(data.line); break;
    case 'factory-family': {
      const family = factoryFamilies.find(item => item.id === data.id);
      if (family && family !== activeFamily) {
        activeFamily = family;
        renderFactoryFamily();
      }
      break;
    }
    case 'factory-option':
      factoryChoices.set(activeFamily.id, Number(data.index));
      resetAddition(main.querySelector('[data-action=factory-buy]'));
      updateFactoryOffer();
      break;
    case 'factory-buy': {
      const product = getProduct(activeFamily.id);
      const index = factoryChoices.get(product.id) ?? 0;
      const {format, quantity} = factoryOptions(product)[index];
      openQuickBuy(product.id, control, format, quantity);
      break;
    }
    case 'market-line': state.line = data.line; renderProducts(); break;
    case 'finder': toggleFinder(); break;
    case 'reset-filters': {
      Object.assign(state, {line:'todos', mode:'todos', query:''});
      const search = main.querySelector('[data-search]');
      search.value = '';
      renderProducts();
      search.focus();
      break;
    }
    case 'quick-buy': openQuickBuy(data.id, control); break;
    case 'tier-quantity': selectTier(Number(data.minimum), quickDialog.contains(control)); break;
    case 'close-quick': quickDialog.close(); break;
    case 'quick-quantity':
      quickPurchase.quantity = Math.max(1, Math.min(99, quickPurchase.quantity + Number(data.delta)));
      updateQuickBuy();
      break;
    case 'quick-submit':
      addToCart({...quickPurchase, animationSource:control});
      quickDialog.close();
      break;
    case 'preview-email': window.ceaOrderEmailPreview.open(state.receipt); break;
    case 'dismiss-toast': cartToast.hidden = true; cartLink.focus(); break;
    case 'product': {
      const product = getProduct(data.id);
      if (!product) break;
      const formatIndex = Number(data.format);
      state.product = product;
      state.format = product.formats[formatIndex] ? formatIndex : 0;
      state.qty = 1;
      go('product');
      break;
    }
    case 'variant': {
      const formatIndex = Number(data.index);
      if (state.format === formatIndex) break;
      state.format = formatIndex;
      if (promotionPricing.hasOffer(state.product)) state.qty = 1;
      const fragment = productFragment(state.product, formatIndex);
      history.replaceState(null, '', '#' + fragment);
      renderPurchasePresentation(main, state.product, formatIndex);
      updateDetail();
      break;
    }
    case 'quantity': state.qty = Math.max(1, Math.min(99, state.qty + Number(data.delta))); updateDetail(); break;
    case 'add': addToCart({source:control}); break;
    case 'cart': openCart(); break;
    case 'close-cart': cartDrawer.close(); break;
    case 'adjust':
    case 'remove': changeCart(data.action, data.key, Number(data.delta)); break;
    case 'checkout': if (subtotal() >= minimum) go('checkout'); break;
    case 'fill': fillDemo(); break;
    case 'approve': approve(); break;
    case 'reject': state.error = true; go('payment', {focus:false,scroll:false}); main.querySelector('[data-action="approve"]').focus({preventScroll:true}); break;
  }
});

quickDialog.addEventListener('change', event => {
  if (!event.target.matches('[data-quick-format]')) return;
  const formatIndex = Number(event.target.value);
  if (quickPurchase.formatIndex === formatIndex) return;
  quickPurchase.formatIndex = formatIndex;
  if (promotionPricing.hasOffer(quickPurchase.product)) quickPurchase.quantity = 1;
  renderPurchasePresentation(quickDialog, quickPurchase.product, formatIndex);
  updateQuickBuy();
});
quickDialog.addEventListener('close', () => {
  if (!quickDialog.open) quickPurchase = undefined;
});

cartDrawer.addEventListener('click', event => {
  if (event.target !== cartDrawer) return;
  const bounds = cartDrawer.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right) cartDrawer.close();
});
cartDrawer.addEventListener('close', () => {
  if (cartDrawer.open) return;
  cartLink.setAttribute('aria-expanded','false');
  if (['shop','product'].includes(state.view) && cartOpener?.isConnected) cartOpener.focus({preventScroll:true});
  cartOpener = undefined;
});

main.addEventListener('input', event => {
  if (event.target.matches('[data-search]')) {
    state.query = event.target.value;
    renderProducts();
  } else if (event.target.matches('[data-sort]')) {
    state.sort = event.target.value;
    renderProducts();
  } else if (event.target.matches('[data-mode]')) {
    state.mode = event.target.value;
    renderProducts();
  } else if (event.target.form?.id === 'checkout-form') {
    state.contact[event.target.name] = event.target.value;
  }
});

main.addEventListener('submit', event => {
  if (event.target.id === 'catalog-search-form') {
    event.preventDefault();
    jump('catalog-zone');
    return;
  }
  if (event.target.id !== 'checkout-form') return;
  event.preventDefault();
  if (subtotal() < minimum || !event.target.reportValidity()) return;
  state.contact = Object.fromEntries(new FormData(event.target));
  state.error = false;
  go('payment');
});

updateCount();
restoreRoute(false);
window.addEventListener('popstate', () => restoreRoute(true));
window.addEventListener('scroll', () => {
  if (state.view !== 'home' || scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0;
    updateLandingNavigation();
  });
}, {passive:true});
window.addEventListener('resize', () => highlightNavigation(activeNavigation, true));
document.fonts?.ready.then(() => highlightNavigation(activeNavigation, true));
