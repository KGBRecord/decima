/**
 * Runs in the page's own JS world (the isolated content script cannot see page XHR/fetch).
 * Reports when Discord's "create message" request finishes, so the uploader can wait for each
 * message to be really sent (attachments uploaded + message accepted) before starting the next.
 */
export default defineContentScript({
  matches: ['https://discord.com/*', 'https://*.discord.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const CREATE_MESSAGE = /\/api\/v\d+\/channels\/(\d+)\/messages(?:\?|$)/;
    const emit = (phase: 'start' | 'end', channelId: string, status = 0) =>
      window.dispatchEvent(new CustomEvent('dbu:msg', { detail: JSON.stringify({ phase, channelId, status }) }));

    // XMLHttpRequest
    const xhrOpen = XMLHttpRequest.prototype.open;
    const xhrSend = XMLHttpRequest.prototype.send;
    const meta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: any[]) {
      meta.set(this, { method: String(method).toUpperCase(), url: String(url) });
      return (xhrOpen as any).call(this, method, url, ...rest);
    } as typeof XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: any) {
      const m = meta.get(this);
      const ch = m && m.method === 'POST' ? CREATE_MESSAGE.exec(m.url)?.[1] : undefined;
      if (ch) {
        emit('start', ch);
        this.addEventListener('loadend', () => emit('end', ch, this.status), { once: true });
      }
      return xhrSend.call(this, body);
    };

    // fetch
    const realFetch = window.fetch;
    window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      let url = '';
      let method = (init?.method ?? 'GET').toUpperCase();
      if (typeof input === 'string') url = input;
      else if (input instanceof URL) url = input.href;
      else { url = input.url; if (!init?.method) method = input.method.toUpperCase(); }
      const ch = method === 'POST' ? CREATE_MESSAGE.exec(url)?.[1] : undefined;
      const p = realFetch.call(window, input as any, init);
      if (!ch) return p;
      emit('start', ch);
      p.then((r) => emit('end', ch, r.status), () => emit('end', ch, 0));
      return p;
    } as typeof window.fetch;

    const mark = () => document.documentElement?.setAttribute('data-dbu-hook', '1');
    mark();
    document.addEventListener('DOMContentLoaded', mark);
  },
});
