(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function restart(element, frames, options) {
    for (const animation of element.getAnimations()) animation.cancel();
    element.animate(frames, options);
  }

  function play({source, image, target, toast}) {
    if (reducedMotion.matches) return;
    const count = target.querySelector('[data-count]');
    restart(toast, [
      {opacity: 0, transform: 'translateY(9px)'},
      {opacity: 1, transform: 'translateY(0)'}
    ], {duration: 230, easing: 'ease-out'});

    const targetRect = count.getBoundingClientRect();
    const context = source?.closest('.quick-dialog, .product, .product-view');
    const photo = context?.querySelector('[data-purchase-photo] img, .product-picture img, .detail-photo img');
    const photoRect = photo?.getBoundingClientRect();
    const originRect = photoRect?.bottom > 0 && photoRect.top < innerHeight
      ? photoRect
      : source?.getBoundingClientRect();
    const flightDuration = 540;
    if (originRect?.width && originRect.bottom > 0 && originRect.top < innerHeight && targetRect.width && image) {
      const fromX = Math.max(8, Math.min(innerWidth - 66, originRect.x + originRect.width / 2 - 29));
      const fromY = Math.max(8, Math.min(innerHeight - 76, originRect.y + originRect.height / 2 - 34));
      const dx = targetRect.x + targetRect.width / 2 - fromX - 29;
      const dy = targetRect.y + targetRect.height / 2 - fromY - 34;
      const thumbnail = document.createElement('img');
      thumbnail.className = 'cart-flight';
      thumbnail.src = image;
      thumbnail.alt = '';
      thumbnail.setAttribute('aria-hidden', 'true');
      thumbnail.style.left = fromX + 'px';
      thumbnail.style.top = fromY + 'px';
      document.body.append(thumbnail);
      const animation = thumbnail.animate([
        {transform: 'translate(0, 0) scale(1)', opacity: 1},
        {transform: `translate(${dx * .48}px, ${Math.min(-30, dy * .7)}px) scale(.72)`, opacity: .98, offset: .55},
        {transform: `translate(${dx}px, ${dy}px) scale(.18)`, opacity: 0}
      ], {duration: flightDuration, easing: 'cubic-bezier(.3,.1,.3,1)'});
      animation.finished.then(() => thumbnail.remove(), () => thumbnail.remove());
    }
    restart(count, [
      {transform: 'scale(1)'},
      {transform: 'scale(1.3)', offset: .45},
      {transform: 'scale(1)'}
    ], {duration: 300, delay: 320, easing: 'ease-out'});
    restart(target, [
      {boxShadow: '0 0 0 0 #b8d85600'},
      {boxShadow: '0 0 0 4px #b8d85655', offset: .4},
      {boxShadow: '0 0 0 0 #b8d85600'}
    ], {duration: 450, delay: 260, easing: 'ease-out'});
  }

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    for (const element of document.querySelectorAll('.cart-flight, .site-cart, [data-count], .cart-toast')) {
      for (const animation of element.getAnimations()) animation.cancel();
    }
  });

  window.ceaCartFeedback = {play};
})();
