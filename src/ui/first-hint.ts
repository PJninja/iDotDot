/** One line of plain text shown on the first visit until the visitor paints or presses a key. */
export function showFirstHint(onSeen: () => void): void {
  const hint = document.createElement('p');
  hint.className = 'first-hint';
  hint.textContent = 'Drag to pour sand.';
  document.body.appendChild(hint);
  const dismiss = (): void => {
    hint.remove();
    window.removeEventListener('pointerdown', onPress, true);
    window.removeEventListener('keydown', dismiss, true);
    onSeen();
  };
  const onPress = (e: PointerEvent): void => {
    const onUi = e.target instanceof Element && e.target.closest('#header, #overlay, .project-scrim') !== null;
    if (!onUi) dismiss();
  };
  window.addEventListener('pointerdown', onPress, true);
  window.addEventListener('keydown', dismiss, true);
}
