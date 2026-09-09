const cards = [...document.querySelectorAll('.chapter')];
const choice = document.querySelector('.choice');
let selected = null;

cards.forEach(card => card.addEventListener('click', () => {
  selected = card;
  cards.forEach(item => item.setAttribute('aria-pressed', String(item === card)));
  choice.textContent = `已选择 Chapter ${card.dataset.chapter} · 这一束微光，为你亮起。`;
}));

document.querySelector('.explore').addEventListener('click', () => {
  const target = selected || cards[0];
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: 'auto', block: 'center' });
});
