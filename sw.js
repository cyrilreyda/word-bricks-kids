// Офлайн-режим гри. Онлайн сторінки завжди беруться з мережі (і оновлюють збережену копію),
// без інтернету — зі збереженої копії. Параметри адреси (?boost, ?zvuk=…) на копію не впливають.
// Після зміни списку FILES збільшити номер у CACHE, щоб браузери забрали нову копію.
const CACHE = 'word-bricks-kids-v3';
const FILES = ['./', './index.html', './guide/', './guide/index.html', './fonts/fonts.css',
               './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
// Спільні файли сайту, які гра підключає з кореня: замок уроку, акаунт, «Разом», «Клас», повний екран
FILES.push('/lock.js', '/account.js', '/duel.js', '/classrace.js', '/fullscreen.js');

const TIMEOUT = 5000;   // повільна мережа в класі — після 5 с беремо збережену копію
const STABLE = /\/(fonts|icons|img|audio)\//;   // шрифти, значки, картинки й звуки змінюються рідко: спершу збережена копія

// Встановлення по файлу: що вже завантажилось, лишається в новому сховищі, і наступне відкриття докачує решту,
// навіть якщо інтернет щоразу пропадає на півдорозі. no-cache — не брати застарілу копію з кешу браузера
async function fill(){
  const c = await caches.open(CACHE);
  const missing = (await Promise.all(FILES.map(async f=>{
    if(await c.match(f)) return 0;
    try{
      const res = await fetch(new Request(f, { cache:'no-cache' }));
      if(!res.ok) return 1;
      await c.put(f, res);
      return 0;
    }catch(e){ return 1; }
  }))).reduce((a, b)=>a + b, 0);
  if(missing) throw new Error(`${CACHE}: ще не збережено ${missing}`);
}
self.addEventListener('install', e=>{
  e.waitUntil(fill().then(()=>self.skipWaiting()));
});
// Видаляємо лише старі версії цієї гри: усі ігри сайту cyrilreyda.github.io ділять одне сховище кешів.
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('word-bricks-kids-') && k !== CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin) return;   // чужі сайти — без змін
  const fromCache = ()=>caches.match(req, { ignoreSearch:true })
    .then(r=>r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
  // Відповідь з помилкою (буває, коли зв'язок ледь живий) не замінює збережену копію.
  // Зберігаємо лише повні відповіді (200): шматок звуку (206) у сховище не кладеться
  const fromNet = fetch(req).then(res=>{
    if(!res.ok) throw new Error('HTTP ' + res.status);
    if(res.status === 200){ const copy = res.clone(); caches.open(CACHE).then(c=>c.put(req.url.split('?')[0], copy)); }
    return res;
  });
  if(STABLE.test(url.pathname)){
    e.waitUntil(fromNet.catch(()=>{}));   // оновити копію на наступний раз
    e.respondWith(fromCache().then(r=>r || fromNet).catch(()=>Response.error()));
    return;
  }
  const slow = new Promise((_, reject)=>setTimeout(()=>reject(new Error('timeout')), TIMEOUT));
  // Немає збереженої копії — чекаємо на мережу й далі: повільно, але відкриється
  e.respondWith(Promise.race([fromNet, slow]).catch(()=>fromCache().then(r=>r || fromNet)).catch(()=>Response.error()));
});

// Каталог, відкритий з інтернетом, просить кожну гру оновити збережену копію й відповісти, чи вдалося: тоді для роботи
// без мережі досить відкрити каталог, а не кожну гру. no-cache — умовний запит: файл, що не змінився, не завантажується
// вдруге. addAll — усе або нічого: напівоновленої копії не буває
self.addEventListener('message', e=>{
  if(e.data !== 'refresh') return;
  const port = e.ports[0];
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f, { cache:'no-cache' }))))
    .then(()=>true, ()=>false).then(ok=>{ if(port) port.postMessage(ok); }));
});
