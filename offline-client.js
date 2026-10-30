(() => {
  const source = document.currentScript?.src;
  if (!source || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  const base = new URL('./', source);
  const bar = document.createElement('aside');
  bar.setAttribute('aria-label', 'Automatic offline saving');
  bar.style.cssText = 'position:relative;z-index:10000;padding:10px 18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:#183d34;color:#fff;font:14px/1.6 system-ui,sans-serif';
  const status = document.createElement('span');status.setAttribute('role', 'status');status.setAttribute('aria-live', 'polite');
  const retry = document.createElement('button');retry.type = 'button';retry.textContent = 'Check offline copy';retry.style.cssText = 'font:inherit;color:inherit;background:transparent;border:1px solid #b9d8ca;border-radius:6px;padding:6px 10px;min-height:36px;cursor:pointer';
  bar.append(status, retry);document.body.prepend(bar);
  let timer, checking = false, ready = false;
  const limits = document.querySelector('meta[name="offline-limits"]')?.content || 'External websites and live services need internet.';
  function say(message) { status.textContent = message + ' ' + limits; }
  function request(worker, type='OFFLINE_STATUS') {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();const timeout = setTimeout(() => {channel.port1.close();reject(new Error('Still preparing'));}, 30000);
      channel.port1.onmessage = event => {clearTimeout(timeout);channel.port1.close();resolve(event.data);};
      worker.postMessage({type}, [channel.port2]);
    });
  }
  async function prepare() {
    if (checking) return;
    checking = true;retry.disabled = true;say(navigator.onLine ? 'Saving the full app automatically…' : 'Checking saved app files…');
    try {
      const registration = await navigator.serviceWorker.register(new URL('sw.js', base), {scope:base.pathname, updateViaCache:'none'});
      const active = (await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Still preparing')), 120000))])).active;
      let result = await request(active);
      if(!result.ready&&navigator.onLine)result=await request(active,'PREPARE_OFFLINE');
      ready = result.ready === true;
      if (ready) say(`${navigator.onLine ? 'Full app saved automatically.' : 'Offline · using the saved full app.'} ${result.saved} files checked. Keep this device charged.`);
      else throw new Error('Incomplete files');
      registration.update().catch(() => {});
    } catch {
      ready = false;say('Automatic saving is waiting for a working connection or free storage. It will retry.');
      clearTimeout(timer);timer = setTimeout(() => {if(navigator.onLine)prepare();},30000);
    } finally {checking = false;retry.disabled = false;}
  }
  retry.onclick = prepare;
  window.addEventListener('online', prepare);
  window.addEventListener('offline', () => say(ready ? 'Offline · full app files saved on this device.' : 'Offline saving has not finished on this device.'));
  navigator.serviceWorker.addEventListener('controllerchange', prepare);
  prepare();
})();
