import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settingsView } from '../src/views/settings.js';
import { fakeDocument, text } from './fakedom.js';

const view = badge => text(settingsView({ doc: fakeDocument(), hasToken: true, board: null, badge, enableBadge() {}, saveToken() {}, forgetToken() {} }));

test('settings explain the badge in each case', () => {
  assert.match(view('unsupported'), /titre de la page/);
  assert.match(view('needs-permission'), /Activer la pastille/);
  assert.match(view('ready'), /Active/);
});
