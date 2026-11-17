// Пише files.json: git-хеш кожного файлу репозиторію (перші 16 знаків, як у `git ls-files -s`).
// sw.js звіряє з ним збережені копії й завантажує лише файли з іншим хешем. ETag від GitHub Pages для цього
// не годиться: він містить час деплою й міняється в усіх файлів після кожного push.
// Хеші беруться з індексу git, тобто з того, що піде в коміт. Запускає .githooks/pre-commit.
const { execFileSync } = require('child_process');
const fs = require('fs');

const list = {};
for(const line of execFileSync('git', ['ls-files', '-s', '-z']).toString('utf8').split('\0')){
  const m = line.match(/^\d+ ([0-9a-f]{40}) \d\t([\s\S]+)$/);
  if(!m || m[2] === 'files.json' || m[2].startsWith('.')) continue;
  list[m[2]] = m[1].slice(0, 16);
}
const text = '{\n' + Object.keys(list).sort().map(f=>`  ${JSON.stringify(f)}: "${list[f]}"`).join(',\n') + '\n}\n';
fs.writeFileSync('files.json', text);
