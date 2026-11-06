// Офлайн-режим гри. Онлайн сторінки завжди беруться з мережі (і оновлюють збережену копію),
// без інтернету — зі збереженої копії. Параметри адреси (?boost, ?zvuk=…) на копію не впливають.
// Після зміни списку FILES збільшити номер у CACHE, щоб браузери забрали нову копію.
const CACHE = 'word-bricks-kids-v1';
const FILES = ['./', './index.html', './guide/', './guide/index.html', './fonts/fonts.css',
               './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const TIMEOUT = 5000;   // повільна мережа в класі — після 5 с беремо збережену копію

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
// Видаляємо лише старі версії цієї гри: усі ігри сайту cyrilreyda.github.io ділять одне сховище кешів.
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('word-bricks-kids-') && k !== CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;   // чужі сайти — без змін
  const fromCache = ()=>caches.match(req, { ignoreSearch:true })
    .then(r=>r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
  const fromNet = fetch(req).then(res=>{
    if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c=>c.put(req.url.split('?')[0], copy)); }
    return res;
  });
  const slow = new Promise((_, reject)=>setTimeout(()=>reject(new Error('timeout')), TIMEOUT));
  e.respondWith(Promise.race([fromNet, slow]).catch(fromCache));
});
