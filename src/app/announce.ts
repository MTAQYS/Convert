export function announce(message: string): void {
  const node = document.getElementById('status');
  if (!node) return;
  node.textContent = '';
  window.setTimeout(() => {
    node.textContent = message;
  }, 30);
}
