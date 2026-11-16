// Офлайн-режим гри. Онлайн сторінки завжди беруться з мережі (і оновлюють збережену копію),
// без інтернету — зі збереженої копії. Параметри адреси (?boost, ?zvuk=…) на копію не впливають.
// Після зміни списку FILES збільшити номер у CACHE, щоб браузери забрали нову копію.
const CACHE = 'word-bricks-kids-v4';
const FILES = ['./', './index.html', './guide/', './guide/index.html', './fonts/fonts.css',
               './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
// Спільні файли сайту, які гра підключає з кореня: замок уроку, акаунт, «Разом», «Клас», повний екран
FILES.push('/lock.js', '/account.js', '/duel.js', '/classrace.js', '/fullscreen.js');

const TIMEOUT = 5000;   // повільна мережа в класі — після 5 с беремо збережену копію
const STABLE = /\/(fonts|icons|img|audio)\//;   // шрифти, значки, картинки й звуки змінюються рідко: спершу збережена копія

// Файл з мережі, лише якщо він змінився: умовний запит з міткою збереженої копії (ETag, Last-Modified), тож незмінений файл
// не завантажується вдруге. null — не змінився. На кеш браузера тут не покладаємось: на комп'ютерах класу він часто порожній
async function fetchIfChanged(f, saved){
  const headers = new Headers();
  if(saved){
    const tag = saved.headers.get('ETag'), mod = saved.headers.get('Last-Modified');
    if(tag) headers.set('If-None-Match', tag);
    if(mod) headers.set('If-Modified-Since', mod);
  }
  const res = await fetch(new Request(f, { cache:'no-store', headers }));
  if(res.status === 304 && saved) return null;
  if(!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
  return res;
}

// Встановлення по файлу: що вже завантажилось, лишається в новому сховищі, і наступне відкриття докачує решту,
// навіть якщо інтернет щоразу пропадає на півдорозі. Файл, що не змінився з попередньої версії, береться з неї
async function fill(){
  const c = await caches.open(CACHE);
  const missing = (await Promise.all(FILES.map(async f=>{
    if(await c.match(f)) return 0;
    try{
      const old = await caches.match(f);
      const res = await fetchIfChanged(f, old);
      await c.put(f, res || old);
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
  const net = ()=>fetch(req).then(res=>{
    if(!res.ok) throw new Error('HTTP ' + res.status);
    if(res.status === 200){ const copy = res.clone(); caches.open(CACHE).then(c=>c.put(req.url.split('?')[0], copy)); }
    return res;
  });
  if(STABLE.test(url.pathname)){   // свіжу копію принесе оновлення від каталогу
    e.respondWith(fromCache().then(r=>r || net()).catch(()=>Response.error()));
    return;
  }
  const fromNet = net();
  const slow = new Promise((_, reject)=>setTimeout(()=>reject(new Error('timeout')), TIMEOUT));
  // Немає збереженої копії — чекаємо на мережу й далі: повільно, але відкриється
  e.respondWith(Promise.race([fromNet, slow]).catch(()=>fromCache().then(r=>r || fromNet)).catch(()=>Response.error()));
});

// Оновлення збереженої копії на прохання каталогу: лише змінені файли, і записуються всі разом, коли завантажено все —
// напівоновленої копії не буває. Каталогу відповідаємо, чи вдалося
async function refresh(){
  const c = await caches.open(CACHE);
  const got = await Promise.all(FILES.map(async f=>[f, await fetchIfChanged(f, await c.match(f))]));
  await Promise.all(got.filter(([, res])=>res).map(([f, res])=>c.put(f, res)));
}
self.addEventListener('message', e=>{
  if(e.data !== 'refresh') return;
  const port = e.ports[0];
  e.waitUntil(refresh().then(()=>true, ()=>false).then(ok=>{ if(port) port.postMessage(ok); }));
});
