import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const markerStart = '/* CALM_BACKUP_VALIDATION_START */';
const markerEnd = '/* CALM_BACKUP_VALIDATION_END */';
assert.ok(html.includes(markerStart) && html.includes(markerEnd));
const logic = html.split(markerStart)[1].split(markerEnd)[0];
const { parseBackupForImport, applyBackupAtomically } = vm.runInNewContext(
  logic + '\n({parseBackupForImport, applyBackupAtomically})'
);
const saved = (value) => JSON.stringify(value);
test('accepts existing export string format and valid financial records', () => {
  const entries = parseBackupForImport(JSON.stringify({
    cc_ips_purpose: saved('Long-term plan'),
    cc_nw: saved([{ m: '2026-11', a: 123, l: 23, n: 100 }]),
    cc_lastView: saved('networth')
  }));
  assert.equal(entries.length, 3);
});
test('rejects malformed, executable, unknown, and mismatched data before writing', () => {
  const unsafe = [
    'null', '[]', '{}', '{"cc_ips_purpose":1}',
    JSON.stringify({ cc_nw: saved([{ m: '<img src=x onerror=alert(1)>', a: 1, l: 0, n: 1 }]) }),
    JSON.stringify({ cc_pc_day: saved('<script>') }),
    JSON.stringify({ cc_changeLog: saved([{ date: '<img>', reason: 'x' }]) }),
    JSON.stringify({ cc_unsafe: saved('x') }),
    JSON.stringify({ cc_rc: saved([{ event: 'event', drop: 1, time: '', note: '' }]) })
  ];
  for (const payload of unsafe) assert.throws(() => parseBackupForImport(payload), undefined, payload);
});
test('storage failure restores all previously held values and leaves unrelated keys intact', () => {
  const memory = new Map([['cc_ips_purpose', saved('Original')], ['cc_nw', saved([])], ['other_app', 'kept']]);
  let failOnce = true;
  const storage = {
    getItem: key => memory.has(key) ? memory.get(key) : null,
    setItem(key, value) {
      if (key === 'cc_nw' && failOnce) { failOnce = false; throw new Error('quota'); }
      memory.set(key, value);
    },
    removeItem: key => memory.delete(key)
  };
  const incoming = parseBackupForImport(JSON.stringify({
    cc_ips_purpose: saved('Replacement'), cc_nw: saved([{ m: '2026-11', a: 3, l: 1, n: 2 }])
  }));
  assert.throws(() => applyBackupAtomically(incoming, storage), /quota/);
  assert.equal(memory.get('cc_ips_purpose'), saved('Original'));
  assert.equal(memory.get('cc_nw'), saved([]));
  assert.equal(memory.get('other_app'), 'kept');
});
test('successful import updates only named settings without deleting others', () => {
  const map = new Map([['cc_ips_purpose', saved('Original')], ['cc_rc', saved([])], ['unrelated', 'yes']]);
  const storage = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  applyBackupAtomically(parseBackupForImport(JSON.stringify({ cc_ips_purpose: saved('New') })), storage);
  assert.equal(map.get('cc_ips_purpose'), saved('New'));
  assert.equal(map.get('cc_rc'), saved([]));
  assert.equal(map.get('unrelated'), 'yes');
});
