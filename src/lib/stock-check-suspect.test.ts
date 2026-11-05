import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSuspectProfile } from './stock-check-suspect';

const base = 'https://x.supabase.co/storage/v1/object/public/contamination-photos/skip-tracker/';
const sizes = new Map([['skip-tracker/thumb.jpg', 21000], ['skip-tracker/big.jpg', 3_000_000]]);

test('thumbnail-only, unverified profile is suspect', () => {
  assert.equal(isSuspectProfile({ photos: [base + 'thumb.jpg'], office_verified: false }, sizes), true);
});
test('no photos and unverified is suspect', () => {
  assert.equal(isSuspectProfile({ photos: [], office_verified: false }, sizes), true);
});
test('a full-size photo clears it', () => {
  assert.equal(isSuspectProfile({ photos: [base + 'thumb.jpg', base + 'big.jpg'], office_verified: false }, sizes), false);
});
test('office verified clears it even with only thumbnails', () => {
  assert.equal(isSuspectProfile({ photos: [base + 'thumb.jpg'], office_verified: true }, sizes), false);
});
test('unknown photo size counts as old', () => {
  assert.equal(isSuspectProfile({ photos: [base + 'missing.jpg'], office_verified: false }, sizes), true);
});
