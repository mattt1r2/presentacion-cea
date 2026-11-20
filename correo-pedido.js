(() => {
  const money = new Intl.NumberFormat('es-CL', {style: 'currency', currency: 'CLP'});
  let dialog;
  let opener;

  function textElement(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = String(value ?? '');
    return element;
  }

  function nonnegativeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function demoReference(id) {
    const reference = String(id ?? '').trim();
    if (!reference) return 'CEA-DEMO';
    return reference.startsWith('CEA-DEMO') ? reference : 'CEA-DEMO-' + reference;
  }

  function createDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'cea-email-preview';
    dialog.setAttribute('aria-labelledby', 'cea-email-preview-title');
    dialog.setAttribute('aria-describedby', 'cea-email-preview-notice');
    dialog.innerHTML = `
      <div class="cep-topbar">
        <h2 id="cea-email-preview-title">Vista previa del correo</h2>
        <button class="cep-close" type="button" aria-label="Cerrar vista previa del correo">×</button>
      </div>
      <div class="cep-preview-info">
        <p id="cea-email-preview-notice">Demostración. El envío se habilita al conectar WooCommerce.</p>
        <dl>
          <div><dt>Para</dt><dd data-email-recipient></dd></div>
          <div><dt>Asunto</dt><dd data-email-subject></dd></div>
        </dl>
      </div>
      <article class="cep-email" aria-labelledby="cea-email-message-title">
        <header class="cep-brand">
          <img src="assets/logo.webp" alt="" width="46" height="46">
          <strong>Distribuidora CEA</strong>
          <span>Demostración</span>
        </header>
        <div class="cep-message">
          <h3 id="cea-email-message-title">Gracias por tu compra</h3>
          <p class="cep-greeting" data-email-greeting></p>
          <p>Este es el resumen de tu pedido de demostración.</p>
          <dl class="cep-order-details">
            <div><dt>Pedido</dt><dd data-email-reference></dd></div>
            <div><dt>Pago</dt><dd>Simulado</dd></div>
          </dl>
          <h4 class="cep-items-heading">Resumen del pedido</h4>
          <ul class="cep-items" data-email-items></ul>
          <p class="cep-total"><span>Total</span><strong data-email-total></strong></p>
          <p class="cep-payment-note">Pedido CEA-DEMO · Pago de demostración</p>
        </div>
        <footer class="cep-email-footer">
          <strong>Distribuidora CEA</strong>
          <span>Talca, Región del Maule</span>
          <a href="mailto:contacto@distribuidoracea.cl">contacto@distribuidoracea.cl</a>
        </footer>
      </article>
      <div class="cep-bottom">
        <p>La boleta electrónica y su envío se configuran en el sistema de emisión.</p>
        <button class="cep-done" type="button">Cerrar vista previa</button>
      </div>
    `;
    dialog.querySelector('.cep-close').addEventListener('click', close);
    dialog.querySelector('.cep-done').addEventListener('click', close);
    dialog.addEventListener('close', () => {
      const target = opener;
      opener = null;
      if (target instanceof HTMLElement && target.isConnected && !target.matches(':disabled')) {
        target.focus({preventScroll: true});
      }
    });
    document.body.append(dialog);
  }

  function itemRow(item) {
    const quantity = nonnegativeNumber(item.qty);
    const unitPrice = nonnegativeNumber(item.price);
    const row = document.createElement('li');
    row.className = 'cep-item';
    const detail = document.createElement('div');
    detail.className = 'cep-item-detail';
    detail.append(
      textElement('strong', 'cep-item-name', item.name),
      textElement('span', 'cep-item-format', item.format),
      textElement('span', 'cep-item-units', quantity + ' × ' + money.format(unitPrice))
    );
    row.append(detail, textElement('strong', 'cep-item-subtotal', money.format(quantity * unitPrice)));
    return row;
  }

  function open(order = {}) {
    if (!dialog) createDialog();
    const reference = demoReference(order.id);
    const firstName = String(order.firstName ?? '').trim();
    const items = Array.isArray(order.items) ? order.items.filter(item => item && typeof item === 'object') : [];
    dialog.querySelector('[data-email-recipient]').textContent = String(order.email ?? '');
    dialog.querySelector('[data-email-subject]').textContent = 'Confirmación del pedido ' + reference;
    dialog.querySelector('[data-email-reference]').textContent = reference;
    dialog.querySelector('[data-email-greeting]').textContent = firstName ? 'Hola ' + firstName + ',' : 'Hola,';
    dialog.querySelector('[data-email-total]').textContent = money.format(nonnegativeNumber(order.total));
    const rows = items.length ? items.map(itemRow) : [textElement('li', 'cep-empty', 'Sin productos en este pedido de demostración.')];
    dialog.querySelector('[data-email-items]').replaceChildren(...rows);
    if (!dialog.open) {
      opener = document.activeElement;
      dialog.showModal();
      dialog.querySelector('.cep-close').focus({preventScroll: true});
    }
  }

  function close() {
    if (dialog?.open) dialog.close();
  }

  window.ceaOrderEmailPreview = {open, close};
})();
