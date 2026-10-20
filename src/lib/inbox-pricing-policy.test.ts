import { it } from 'node:test';
import assert from 'node:assert/strict';
import { inboxDraftRateCard } from '../../supabase/functions/_shared/inbox-pricing-policy';

it('defaults Inbox drafts to Trade Rates for ordinary, personal and website enquiries', () => {
  for (const request of ['40 yard mixed construction waste', 'Website enquiry: 8 yard skip for my home, customer@gmail.com', 'Please quote wood waste']) {
    assert.equal(inboxDraftRateCard(request, false), 'Trade Rates 2026');
  }
});

it('only uses residential skip rates when explicitly requested', () => {
  assert.equal(inboxDraftRateCard('Please quote residential skip rates', false), 'Residential Skip Rates 2026');
  assert.equal(inboxDraftRateCard('Please quote residential rates for a 40 yard RoRo', true), 'Trade Rates 2026');
});