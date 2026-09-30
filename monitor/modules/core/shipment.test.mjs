import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedDeclarationParts, sameShipment } from './shipment.js';

const ett = {
  id: 'ett',
  dtNumber: '55302/030826/0056074',
  declarantBin: '170340020968',
  invoice: 'KZ04014-2',
  containers: ['NEPU4595931']
};

const vto = {
  id: 'vto',
  dtNumber: '55302/030826/1011567',
  declarantBin: '170340020968',
  invoice: 'KZ04014-2',
  containers: ['NEPU4595931']
};

test('links the sample ETT and VTO by their shared shipment', () => {
  assert.equal(sameShipment(ett, vto), true);
  assert.deepEqual(relatedDeclarationParts(ett, [ett, vto]), [vto]);
  assert.deepEqual(relatedDeclarationParts(vto, [ett, vto]), [ett]);
});

test('does not call a single declaration a split part', () => {
  assert.deepEqual(relatedDeclarationParts(ett, [ett]), []);
});

test('does not link two declarations of the same section', () => {
  const anotherEtt = { ...ett, id: 'ett-2', dtNumber: '55302/030826/0056075' };
  assert.deepEqual(relatedDeclarationParts(ett, [ett, anotherEtt]), []);
});
