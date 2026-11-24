import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWrite } from '../src/write.js';
import { AuthError, WriteError, ApiError } from '../src/github.js';

function spy(fn = () => {}) { const s = async (...a) => { s.calls.push(a); return fn(...a); }; s.calls = []; return s; }

test('demo writes change memory only', async () => {
  const demoChange = spy(); const realWrite = spy(); const reload = spy();
  assert.deepEqual(await runWrite({ demo: true, demoChange, realWrite, reload }), { error: null, auth: false });
  assert.equal(demoChange.calls.length, 1);
  assert.equal(realWrite.calls.length + reload.calls.length, 0);
});

test('a successful write reloads once', async () => {
  const reload = spy();
  assert.deepEqual(await runWrite({ demo: false, demoChange: spy(), realWrite: spy(), reload }), { error: null, auth: false });
  assert.equal(reload.calls.length, 1);
});

test('a read-only token gives a clear message and no reload', async () => {
  const reload = spy();
  const r = await runWrite({ demo: false, demoChange: spy(), realWrite: spy(() => { throw new WriteError(403); }), reload });
  assert.equal(r.error, 'Ce jeton ne peut pas écrire dans les issues (GitHub a répondu 403).');
  assert.equal(reload.calls.length, 0);
});

test('401 sends to the settings, other errors are reported', async () => {
  assert.deepEqual(await runWrite({ demo: false, demoChange: spy(), realWrite: spy(() => { throw new AuthError(); }), reload: spy() }), { error: null, auth: true });
  const r = await runWrite({ demo: false, demoChange: spy(), realWrite: spy(() => { throw new ApiError('GitHub a répondu 502', 502); }), reload: spy() });
  assert.equal(r.error, 'Envoi impossible : GitHub a répondu 502');
});
