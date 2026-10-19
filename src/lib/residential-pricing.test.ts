import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isResidentialEnquiry, quoteTotals, residentialRowMatches } from './residential-pricing';

it('uses residential rates for website enquiries', () => {
  assert.equal(isResidentialEnquiry({ text: '8 yard mixed waste CV21 1EA', website: true, email: 'forms@clewsrecycling.co.uk' }), true);
});
it('uses residential rates for personal email with no business', () => {
  assert.equal(isResidentialEnquiry({ text: '8 yard mixed waste CV21 1EA', email: 'customer@gmail.com' }), true);
});
it('does not give a business residential rates just for using Gmail', () => {
  assert.equal(isResidentialEnquiry({ text: 'For Smith Construction Ltd, 8 yard mixed waste', email: 'customer@gmail.com' }), false);
});
it('adds net fuel surcharge without charging VAT twice on £333 residential skip', () => {
  const totals = quoteTotals(333, true, 4.43);
  assert.equal(totals.gross.toFixed(2), '338.32');
  assert.equal(totals.totalNet.toFixed(2), '281.93');
});
it('matches residential 6-yard hardcore but not 8-yard hardcore', () => {
  assert.equal(residentialRowMatches('6 cubic yard — Inert / Hardcore', 6, 'inert'), true);
  assert.equal(residentialRowMatches('6 cubic yard — Inert / Hardcore', 8, 'inert'), false);
});
it('keeps 8-yard green separate from wood', () => {
  assert.equal(residentialRowMatches('8 cubic yard — Green Waste', 8, 'green'), true);
  assert.equal(residentialRowMatches('8 cubic yard — Wood Waste', 8, 'green'), false);
});