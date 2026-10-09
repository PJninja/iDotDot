const MESSAGE = "Oh no! We need a GPU to run the simulation, and can't find one :(";

let dialog: HTMLDivElement | null = null;

/**
 * Show a blocking popup when WebGPU is unavailable or the GPU device is lost.
 * Try Again reloads the page, which rebuilds the device, canvas context and
 * world from scratch (a lost device cannot be revived in place).
 */
export function showGpuErrorDialog(reason: string): void {
  console.error('[gpu]', reason);
  if (dialog !== null) return;

  dialog = document.createElement('div');
  dialog.className = 'gpu-error-backdrop';

  const box = document.createElement('div');
  box.className = 'gpu-error-dialog';
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', MESSAGE);

  const text = document.createElement('p');
  text.className = 'gpu-error-message';
  text.textContent = MESSAGE;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gpu-error-retry';
  button.textContent = 'Try Again';
  button.addEventListener('click', () => window.location.reload());

  box.append(text, button);
  dialog.appendChild(box);
  document.body.appendChild(dialog);
  button.focus();
}
