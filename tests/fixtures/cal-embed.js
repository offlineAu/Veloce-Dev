// Test double fulfilled only by Playwright routing.
(() => {
  const original = window.Cal;
  const pending = original.q || [];
  const namespaces = original.ns || {};
  function sdk(queue = []) {
    const listeners = new Map();
    const emit = (action, data = {}) => (listeners.get(action) || []).forEach(callback => callback({ detail: { data, type: action } }));
    const api = function(action, arg) {
      if (action === 'on') listeners.set(arg.action, [...(listeners.get(arg.action) || []), arg.callback]);
      if (action === 'off') listeners.set(arg.action, (listeners.get(arg.action) || []).filter(f => f !== arg.callback));
      if (action === 'inline') {
        const node = arg.elementOrSelector;
        const reference = arg.config['metadata[veloceSession]'];
        const marker = document.createElement('div'); marker.setAttribute('data-calendar-fixture', '');
        marker.innerHTML = '<p>Test calendar: available times</p><button type="button">Confirm fixture meeting</button><button type="button">Request fixture approval</button>';
        marker.querySelectorAll('button').forEach((button, index) => {
          button.style.cssText = 'padding:16px;margin:8px;border:1px solid black;';
          button.onclick = () => emit('bookingSuccessfulV2', { uid: `${index ? 'pending' : 'accepted'}_${reference}` });
        });
        node.append(marker); setTimeout(() => emit('linkReady'), 0);
      }
    };
    for (const args of queue) api(...args);
    return api;
  }
  const cal = sdk(pending); cal.ns = {};
  for (const [name, stub] of Object.entries(namespaces)) cal.ns[name] = sdk(stub.q);
  const root = function(action, name) { if (action === 'init' && typeof name === 'string') cal.ns[name] ||= sdk(); else cal(...arguments); };
  root.ns = cal.ns; root.loaded = true;
  window.Cal = root;
})();
