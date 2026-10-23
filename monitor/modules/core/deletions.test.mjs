import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecordDeletions, isRecordDeleted } from './deletions.js';

test('deletions survive old snapshots and hide nameless records by ID', () => {
  const deleted = { id: 'a', dtNumber: '', deletedAt: '2026-10-23T05:00:00Z' };
  const merged = mergeRecordDeletions([deleted], [], [{ ...deleted, deletedAt: '2026-10-22T05:00:00Z' }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].deletedAt, '2026-10-23T05:00:00.000Z');
  assert.equal(isRecordDeleted({ id: 'a' }, merged), true);
  assert.equal(isRecordDeleted({ id: 'b' }, merged), false);
});

test('old copies cannot return but a deliberate fresh import can', () => {
  const deleted = [{ id: 'a', dtNumber: '55411/221026/0027705', deletedAt: '2026-10-23T05:00:00Z' }];
  assert.equal(isRecordDeleted({ id: 'b', dtNumber: deleted[0].dtNumber, updatedAt: '2026-10-22T05:00:00Z' }, deleted), false);
  assert.equal(isRecordDeleted({ id: 'new', dtNumber: deleted[0].dtNumber, updatedAt: '2026-10-23T05:01:00Z' }, deleted), false);
  assert.equal(isRecordDeleted({ id: 'a', updatedAt: '2026-10-23T05:01:00Z' }, deleted), true);
  assert.deepEqual(mergeRecordDeletions([null, {}, { id: 'bad', deletedAt: 'bad' }]), []);
});
