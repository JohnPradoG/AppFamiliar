import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_RECEIPT_BYTES, mimeFromName, receiptPath, validateReceipt } from './receipts.ts';

test('mimeFromName', () => {
  assert.equal(mimeFromName('foto.JPG'), 'image/jpeg');
  assert.equal(mimeFromName('a.jpeg'), 'image/jpeg');
  assert.equal(mimeFromName('a.png'), 'image/png');
  assert.equal(mimeFromName('recibo.pdf'), 'application/pdf');
  assert.equal(mimeFromName('virus.exe'), null);
  assert.equal(mimeFromName('sin_extension'), null);
});
test('validateReceipt', () => {
  assert.ok(validateReceipt({ name: 'a.jpg', mime: 'image/jpeg', size: 1000 }).ok);
  assert.ok(validateReceipt({ name: 'a.pdf', mime: null, size: 1000 }).ok);                 // deduce por extensión
  assert.equal(validateReceipt({ name: 'a.html', mime: 'text/html', size: 10 }).ok, false);
  assert.equal(validateReceipt({ name: 'a.jpg', mime: 'image/jpeg', size: MAX_RECEIPT_BYTES + 1 }).ok, false);
  assert.equal(validateReceipt({ name: 'a.jpg', mime: 'image/jpeg', size: MAX_RECEIPT_BYTES }).ok, true);
  assert.equal(validateReceipt({ name: 'a.jpg', mime: 'image/jpeg', size: 0 }).ok, false);
  assert.equal(validateReceipt({ name: 'a.jpg', mime: 'image/jpeg', size: undefined }).ok, false);
});
test('receiptPath empieza por la cuenta y el movimiento', () => {
  assert.equal(receiptPath('acc', 'mov', 'uuid', 'application/pdf'), 'acc/mov/uuid.pdf');
  assert.equal(receiptPath('acc', 'mov', 'u', 'image/jpeg'), 'acc/mov/u.jpg');
});
