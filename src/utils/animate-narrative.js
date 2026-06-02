export function animateNarrative(bodyEl) {
  if (!bodyEl) return;
  bodyEl.querySelectorAll('p, li').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.animation = `narrativeFadeIn 0.4s ease ${i * 140}ms forwards`;
  });
}
