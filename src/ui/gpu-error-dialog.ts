export const MESSAGE_NO_WEBGPU = 'WebGPU is not available in this browser, so the simulation cannot run.';
const MESSAGE_DEVICE_LOST = 'The GPU device was lost.';

let dialog: HTMLDivElement | null = null;

/**
 * Show a blocking popup when the GPU device is lost mid-session. Reload rebuilds the device,
 * canvas context and world from scratch (a lost device cannot be revived in place); the
 * link opens the plain page, which needs no GPU.
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
  box.setAttribute('aria-label', MESSAGE_DEVICE_LOST);

  const text = document.createElement('p');
  text.className = 'gpu-error-message';
  text.textContent = MESSAGE_DEVICE_LOST;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gpu-error-retry';
  button.textContent = 'Reload';
  button.addEventListener('click', () => window.location.reload());

  const plain = document.createElement('a');
  plain.className = 'gpu-error-plain';
  plain.href = '?view=plain';
  plain.textContent = 'Open the plain view';

  box.append(text, button, plain);
  dialog.appendChild(box);
  document.body.appendChild(dialog);
  button.focus();
}
