import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterTypesBySize, sizeOptionsFromValues } from './stock-check-size-filter';

const types = [
  { id: 'a', name: '6yd' },
  { id: 'b', name: '12yd' },
  { id: 'c', name: '20yd' },
];

test('No size selected keeps every size', () => {
  assert.deepEqual(filterTypesBySize(types, []), types);
});

test('Selected sizes keep the table order and drop the rest', () => {
  assert.deepEqual(filterTypesBySize(types, ['c', 'a']), [{ id: 'a', name: '6yd' }, { id: 'c', name: '20yd' }]);
});

test('An unknown size id is ignored rather than emptying the table', () => {
  assert.deepEqual(filterTypesBySize(types, ['nope']), []);
  assert.deepEqual(filterTypesBySize(types, ['b', 'nope']), [{ id: 'b', name: '12yd' }]);
});

test('Inventory size options are unique, blank-free and numerically sorted', () => {
  assert.deepEqual(
    sizeOptionsFromValues(['12 CU YD', '6 CU YD', ' 12 CU YD ', null, '', '40 CU YD']),
    ['6 CU YD', '12 CU YD', '40 CU YD'],
  );
});
