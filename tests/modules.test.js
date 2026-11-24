import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Every module served to the phone must at least parse (main.js and the views are not all imported by other tests).
const files = ['src', 'src/views'].flatMap(dir => readdirSync(dir).filter(f => f.endsWith('.js')).map(f => `${dir}/${f}`));

test('every module parses', () => {
  assert.ok(files.includes('src/main.js'));
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}\n${r.stderr}`);
  }
});
