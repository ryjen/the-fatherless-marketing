import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReleaseConfig } from '../tools/validate-release-state.mjs';

const base = () => ({
  schema_version: 1,
  state: 'development',
  edition: null,
  formats: [],
  collector: { state: 'disabled', destination: null },
  replacement_url: null,
  press: { canonical_url: '/press/' },
});

const edition = () => ({ title: 'The Fatherless', release_date: '2027-05-01' });
const destination = () => ({ kind: 'retailer', label: 'Example bookseller', url: 'https://books.example/the-fatherless' });

test('current safe development state contains no commercial facts', () => {
  assert.doesNotThrow(() => validateReleaseConfig(base()));
});

test('development state cannot be activated by merely adding product metadata', () => {
  const config = base();
  config.edition = edition();
  assert.throws(() => validateReleaseConfig(config), /development state must not publish edition facts/);
});

test('announced state may identify an edition but cannot expose an active purchase route', () => {
  const config = base();
  config.state = 'announced';
  config.edition = { title: 'The Fatherless', release_date: null };
  config.formats = [{ type: 'ebook', state: 'unavailable', destinations: [] }];
  assert.doesNotThrow(() => validateReleaseConfig(config));

  config.formats[0] = { type: 'ebook', state: 'preorder', destinations: [destination()] };
  assert.throws(() => validateReleaseConfig(config), /announced state must not expose preorder\/available destinations/);
});

test('preorder requires an explicit date and at least one preorder destination', () => {
  const config = base();
  config.state = 'preorder';
  config.edition = edition();
  config.formats = [{ type: 'ebook', state: 'preorder', destinations: [destination()] }];
  assert.doesNotThrow(() => validateReleaseConfig(config));

  config.edition.release_date = null;
  assert.throws(() => validateReleaseConfig(config), /preorder state requires edition.release_date/);
});

test('released requires at least one explicitly available format', () => {
  const config = base();
  config.state = 'released';
  config.edition = edition();
  config.formats = [{ type: 'paperback', state: 'available', destinations: [destination()] }];
  assert.doesNotThrow(() => validateReleaseConfig(config));

  config.formats[0] = { type: 'paperback', state: 'sold-out', destinations: [] };
  assert.throws(() => validateReleaseConfig(config), /released state requires at least one available format/);
});

test('configured destinations never count while a format is inactive', () => {
  const config = base();
  config.state = 'announced';
  config.edition = { title: 'The Fatherless', release_date: null };
  config.formats = [{ type: 'hardcover', state: 'unavailable', destinations: [destination()] }];
  assert.throws(() => validateReleaseConfig(config), /inactive state must not retain purchase destinations/);
});

test('superseded and withdrawn states cannot retain active sales', () => {
  const superseded = base();
  superseded.state = 'superseded';
  superseded.edition = edition();
  superseded.replacement_url = '/books/the-fatherless/';
  superseded.formats = [{ type: 'ebook', state: 'unavailable', destinations: [] }];
  assert.doesNotThrow(() => validateReleaseConfig(superseded));

  superseded.formats[0] = { type: 'ebook', state: 'available', destinations: [destination()] };
  assert.throws(() => validateReleaseConfig(superseded), /superseded state must remove active purchase destinations/);

  const withdrawn = base();
  withdrawn.state = 'withdrawn';
  withdrawn.edition = edition();
  assert.doesNotThrow(() => validateReleaseConfig(withdrawn));
  withdrawn.replacement_url = '/books/the-fatherless/';
  assert.throws(() => validateReleaseConfig(withdrawn), /withdrawn state must not imply a replacement/);
});

test('collector sales remain separately gated from ordinary edition state', () => {
  const config = base();
  config.state = 'released';
  config.edition = edition();
  config.formats = [{ type: 'ebook', state: 'available', destinations: [destination()] }];
  config.collector = { state: 'sold-out', destination: null };
  assert.doesNotThrow(() => validateReleaseConfig(config));

  config.collector = { state: 'available', destination: 'https://shop.example/collector' };
  assert.doesNotThrow(() => validateReleaseConfig(config));

  config.state = 'announced';
  config.formats = [{ type: 'ebook', state: 'unavailable', destinations: [] }];
  assert.throws(() => validateReleaseConfig(config), /announced state cannot activate collector sales/);
});

test('purchase destinations must be credential-free HTTPS URLs', () => {
  const config = base();
  config.state = 'preorder';
  config.edition = edition();
  config.formats = [{
    type: 'ebook',
    state: 'preorder',
    destinations: [{ kind: 'direct', label: 'Direct', url: 'https://user:secret@example.test/buy' }],
  }];
  assert.throws(() => validateReleaseConfig(config), /credential-free HTTPS URL/);
});
