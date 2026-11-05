import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { totalReportTotals, totalReportType } from './stock-check-total-report';

describe('totalReportType', () => {
  test('scrapped and yard use bins come off the yard first', () => {
    const t = totalReportType({
      id: '12yd',
      name: '12 Yard',
      category: 'skip',
      inYard: 9,
      onSite: 6,
      ownOnSite: 0,
      outOfService: 2,
      catalogued: 10,
    });
    assert.equal(t.inYard, 7);
    assert.equal(t.onSiteClews, 6);
    assert.equal(t.fleet, 13);
    assert.equal(t.required, 3);
  });

  test('out-of-service bins beyond the yard count come off customer sites', () => {
    const t = totalReportType({
      id: '6yd',
      name: '6 Yard',
      category: 'skip',
      inYard: 1,
      onSite: 5,
      ownOnSite: 0,
      outOfService: 3,
      catalogued: 2,
    });
    assert.equal(t.inYard, 0);
    assert.equal(t.onSiteClews, 3);
    assert.equal(t.fleet, 3);
    // 3 working bins, 2 catalogued profiles → 1 still required
    assert.equal(t.required, 1);
  });

  test('customer-owned bins are never counted as Clews stock', () => {
    const t = totalReportType({
      id: 'roro20',
      name: '20 Yard',
      category: 'roro',
      inYard: 4,
      onSite: 9,
      ownOnSite: 9,
      outOfService: 0,
      catalogued: 1,
    });
    assert.equal(t.onSiteClews, 0);
    assert.equal(t.fleet, 4);
    assert.equal(t.required, 3);
  });

  test('own bins are removed before scrap, so scrap cannot hide them', () => {
    const t = totalReportType({
      id: '12yd',
      name: '12 Yard',
      category: 'skip',
      inYard: 0,
      onSite: 4,
      ownOnSite: 4,
      outOfService: 2,
      catalogued: 0,
    });
    assert.equal(t.onSiteClews, 0);
    assert.equal(t.fleet, 0);
    assert.equal(t.required, 0);
  });

  test('a bin is removed once, never from both yard and site', () => {
    const t = totalReportType({
      id: '12yd',
      name: '12 Yard',
      category: 'skip',
      inYard: 5,
      onSite: 5,
      ownOnSite: 0,
      outOfService: 1,
      catalogued: 9,
    });
    assert.equal(t.inYard + t.onSiteClews, 9);
  });

  test('negative or missing inputs fall back to zero', () => {
    const t = totalReportType({
      id: 'x',
      name: 'X',
      category: 'skip',
      inYard: -3,
      onSite: -1,
      ownOnSite: 0,
      outOfService: -2,
      catalogued: -5,
    });
    assert.equal(t.inYard, 0);
    assert.equal(t.onSiteClews, 0);
    assert.equal(t.fleet, 0);
    assert.equal(t.required, 0);
  });
});

describe('totalReportTotals', () => {
  const rows = [
    totalReportType({ id: 'a', name: 'A', category: 'skip', inYard: 7, onSite: 6, ownOnSite: 0, outOfService: 2, catalogued: 10 }),
    totalReportType({ id: 'b', name: 'B', category: 'roro', inYard: 2, onSite: 3, ownOnSite: 1, outOfService: 0, catalogued: 1 }),
  ];

  test('sums only the requested category', () => {
    // skip: yard 7-2 scrap = 5, out 6, fleet 11, catalogued 10 → 1 required
    assert.deepStrictEqual(totalReportTotals(rows, 'skip'), { out: 6, yard: 5, required: 1 });
    // roro: yard 2, out 3-1 own = 2, fleet 4, catalogued 1 → 3 required
    assert.deepStrictEqual(totalReportTotals(rows, 'roro'), { out: 2, yard: 2, required: 3 });
  });

  test('unknown category is all zero', () => {
    assert.deepStrictEqual(totalReportTotals(rows, 'artic'), { out: 0, yard: 0, required: 0 });
  });
});
