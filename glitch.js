const TARGETS = ['.hero-title', '.nav-title', '.section-heading', 'h3'];
const DURATION = 300;

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTextNodes(el) {
  const nodes = [];
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length >= 2) {
      nodes.push(node);
    }
  }
  return nodes;
}

function glitchElement(el) {
  if (el.querySelector('.glitch-char')) return;
  if (el.matches(':hover')) return;

  const textNodes = getTextNodes(el);
  if (!textNodes.length) return;

  const node = textNodes[rand(0, textNodes.length - 1)];
  const text = node.textContent.trim();
  if (text.length < 2) return;

  const len = rand(1, Math.min(3, text.length - 1));
  const start = rand(0, text.length - len);

  const before = document.createTextNode(text.slice(0, start));
  const span = document.createElement('span');
  span.className = 'glitch-char';
  span.textContent = text.slice(start, start + len);
  const after = document.createTextNode(text.slice(start + len));

  const parent = node.parentNode;
  parent.replaceChild(after, node);
  parent.insertBefore(span, after);
  parent.insertBefore(before, span);

  setTimeout(() => {
    parent.replaceChild(node, before);
    parent.removeChild(span);
    parent.removeChild(after);
  }, DURATION);
}

function schedule() {
  setTimeout(() => {
    const candidates = TARGETS.flatMap(s => [...document.querySelectorAll(s)]);
    if (candidates.length) glitchElement(candidates[rand(0, candidates.length - 1)]);
    schedule();
  }, rand(1000, 20000));
}

export function initGlitch() {
  schedule();
}
