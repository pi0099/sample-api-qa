import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOrderById, getOrderInfo } from './order-info';

test('getOrderById returns deterministic order for valid orderId', () => {
  const first = getOrderById('ORD-555555-1');
  const second = getOrderById('ord-555555-1');

  assert.equal(first.orderId, 'ORD-555555-1');
  assert.deepEqual(first, second);
});

test('getOrderById matches order from orderinfo list', () => {
  const list = getOrderInfo({ userId: 'alice' });
  const firstOrder = list.orders[0];

  assert.ok(firstOrder);

  const byId = getOrderById(firstOrder.orderId);

  assert.deepEqual(byId, firstOrder);
});

test('getOrderById rejects invalid format', () => {
  assert.throws(() => getOrderById('INVALID-1'), /Invalid orderId format/);
});
