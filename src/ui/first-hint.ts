/** One line of plain text shown on the first visit until the visitor paints or clicks. */
export function showFirstHint(onSeen: () => void): void {
  const hint = document.createElement('p');
  hint.className = 'first-hint';
  hint.textContent = 'Drag to pour sand.';
  document.body.appendChild(hint);
  const dismiss = (): void => {
    hint.remove();
    window.removeEventListener('pointerdown', dismiss, true);
    window.removeEventListener('keydown', dismiss, true);
    onSeen();
  };
  window.addEventListener('pointerdown', dismiss, true);
  window.addEventListener('keydown', dismiss, true);
}
