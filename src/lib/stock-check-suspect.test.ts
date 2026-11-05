import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSuspectProfile, suspectCsv, suspectReason } from './stock-check-suspect';

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

test('reason names the missing photo, not the verification', () => {
  assert.equal(suspectReason({ photos: [], office_verified: false }, sizes), 'No photos');
  assert.equal(suspectReason({ photos: [base + 'thumb.jpg'], office_verified: false }, sizes), 'Old photos only');
  assert.equal(suspectReason({ photos: [base + 'big.jpg'], office_verified: false }, sizes), null);
});

test('suspect CSV lists one row per bin with its reason', () => {
  const csv = suspectCsv(
    [
      {
        asset_number: 'SK41', asset_type: 'skip', size: '6 CU YD', condition: 'Poor',
        tags: ['Damaged'], photos: [base + 'thumb.jpg'], last_location: 'Yard',
        last_skiptrak_ticket: '12345', last_cataloged_at: '2026-11-05T09:12:00Z', last_reported_by: 'Jamie',
      },
      { asset_number: 'RO93', asset_type: 'roro', photos: [], office_verified: false },
    ] as any,
    sizes,
  );
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '"Number","Type","Size","Condition","Tags","Photos","Why flagged","Last location","Skiptrak ticket","Last catalogued","Logged by"');
  assert.equal(lines[1], '"SK41","Skip","6 CU YD","Poor","Damaged","1","Old photos only","Yard","12345","2026-11-05","Jamie"');
  assert.equal(lines[2], '"RO93","RoRo","","","","0","No photos","","","",""');
});

test('suspect CSV escapes quotes in locations', () => {
  const csv = suspectCsv(
    [{ asset_number: 'SK1', asset_type: 'skip', photos: [], last_location: 'St "Main" St' }],
    sizes,
  );
  assert.ok(csv.includes('"St ""Main"" St"'));
});
