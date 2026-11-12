const scenes = {
  inicio: 'Inicio',
  empresa: 'Empresa',
  tienda: 'Tienda',
  carrito: 'Carrito',
  movil: 'Inicio en móvil'
};

const comparison = document.querySelector('.proposals');
const buttons = document.querySelectorAll('.scenes button');

for (const button of buttons) {
  button.addEventListener('click', () => {
    const scene = button.dataset.scene;
    const mobile = scene === 'movil';
    comparison.dataset.scene = scene;

    for (const option of buttons) {
      option.setAttribute('aria-pressed', option === button);
    }

    for (const version of comparison.querySelectorAll('.proposal')) {
      const name = version.querySelector('h3').textContent;
      const link = version.querySelector('.preview');
      const image = link.querySelector('img');
      const capture = `capturas/${version.dataset.version}-${scene}.jpg`;
      link.href = capture;
      link.setAttribute('aria-label', `Ampliar ${scenes[scene]} de ${name}`);
      image.width = mobile ? 390 : 1366;
      image.height = mobile ? 844 : 880;
      image.alt = `${scenes[scene]} de ${name}`;
      image.src = capture;
    }
  });
}
