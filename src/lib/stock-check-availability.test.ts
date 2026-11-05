import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockCheckAvailability, stockMovementDelta, movementAfterTally, uniqueStockMovements, stockContainerKey, type StockMovement } from './stock-check-availability';

test('Without completed movements Yard equals the tally', () => {
  assert.equal(stockCheckAvailability({ in_yard: 4, runner: 2 }, 1).inYard, 4);
});

const collection: StockMovement = { id: '1', job_number: '123', source: 'routeone', container_type: '12 Yard', movement_type: 'collection', job_date: '2026-11-05', customer: null, site: null, ewc: null, completed: true, completedAt: '2026-11-05T09:37:00Z', updatedAt: null };
test('A completed collection adds one to the tally', () => {
  assert.equal(stockCheckAvailability({ in_yard: 4, runner: 2 }, 0, stockMovementDelta('collection')).inYard, 5);
});
test('A completed delivery subtracts one from the tally', () => {
  assert.equal(stockCheckAvailability({ in_yard: 4, runner: 2 }, 0, stockMovementDelta('delivery')).inYard, 3);
});
test('Exchanges leave Yard unchanged and preserve runners', () => {
  assert.equal(stockCheckAvailability({ in_yard: 4, runner: 2 }, 1, stockMovementDelta('Exchange')).bookingsAllowed, 1);
});
test('Same-day completion after tally contributes; outstanding and earlier completions do not', () => {
  assert.equal(movementAfterTally(collection, '2026-11-05T08:38:00Z', '2026-11-05'), true);
  assert.equal(movementAfterTally({ ...collection, completed: false }, '2026-11-05T08:38:00Z', '2026-11-05'), false);
  assert.equal(movementAfterTally(collection, '2026-11-05T10:00:00Z', '2026-11-05'), false);
});
test('Imports need completed status, post-tally upload and a current job date', () => {
  const imported = { ...collection, source: 'skiptrak' as const, completedAt: null, updatedAt: '2026-11-05T09:40:00Z' };
  assert.equal(movementAfterTally(imported, '2026-11-05T08:38:00Z', '2026-11-05'), true);
  assert.equal(movementAfterTally({ ...imported, job_date: '2026-11-04' }, '2026-11-05T08:38:00Z', '2026-11-05'), false);
});
test('A native job represented in Skiptrak counts only once', () => {
  assert.equal(uniqueStockMovements([collection, { ...collection, source: 'skiptrak', id: '2' }]).length, 1);
});
test('Native size labels match imported yard names', () => {
  assert.equal(stockContainerKey('12 yd enclosed'), stockContainerKey('12 Yard Enc'));
  assert.equal(stockContainerKey('14 / 16 yd'), stockContainerKey('14/16yd'));
});

test('Bookings reserve deliveries and runners from the tally only', () => {
  assert.equal(stockCheckAvailability({ in_yard: 4, runner: 2 }, 1).bookingsAllowed, 1);
});