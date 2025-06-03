export const popupNotifier = {
  _show(message, type = 'info', title = '') {
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.textContent = title ? `${title}: ${message}` : message;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 3000);
  },
  success(msg, title) { this._show(msg, 'success', title); },
  error(msg, title) { this._show(msg, 'error', title); },
  info(msg, title) { this._show(msg, 'info', title); }
};
window.popupNotifier = popupNotifier;
