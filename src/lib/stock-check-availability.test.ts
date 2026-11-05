import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockCheckAvailability } from './stock-check-availability';

test('Yard is exactly the saved tally, without inferred returns', () => {
  assert.equal(stockCheckAvailability({ in_yard: 4, runner: 2 }, 1).inYard, 4);
});

test('Bookings reserve deliveries and runners from the tally only', () => {
  assert.equal(stockCheckAvailability({ in_yard: 4, runner: 2 }, 1).bookingsAllowed, 1);
});