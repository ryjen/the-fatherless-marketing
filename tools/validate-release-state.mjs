#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RELEASE_STATES = new Set(['development', 'announced', 'preorder', 'released', 'superseded', 'withdrawn']);
const FORMAT_TYPES = new Set(['ebook', 'paperback', 'hardcover', 'audiobook']);
const FORMAT_STATES = new Set(['unavailable', 'preorder', 'available', 'sold-out']);
const DESTINATION_KINDS = new Set(['retailer', 'direct', 'distributor']);
const COLLECTOR_STATES = new Set(['disabled', 'planned', 'preorder', 'available', 'sold-out', 'closed']);

function fail(message) {
  throw new Error(message);
}

function nonempty(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validatePublicUrl(value, field, { allowRootRelative = false } = {}) {
  const url = nonempty(value, field);
  if (allowRootRelative && /^\/(?:[a-z0-9._~-]+\/)*[a-z0-9._~-]*$/i.test(url)) return url;
  let parsed;
  try { parsed = new URL(url); } catch { fail(`${field} must be an HTTPS URL${allowRootRelative ? ' or root-relative public path' : ''}`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail(`${field} must be a credential-free HTTPS URL`);
  return url;
}

function validateDestination(destination, label) {
  if (!destination || typeof destination !== 'object' || Array.isArray(destination)) fail(`${label} must be an object`);
  if (!DESTINATION_KINDS.has(destination.kind)) fail(`${label}.kind is invalid`);
  nonempty(destination.label, `${label}.label`);
  validatePublicUrl(destination.url, `${label}.url`);
}

function validateFormat(format, index) {
  const label = `formats[${index}]`;
  if (!format || typeof format !== 'object' || Array.isArray(format)) fail(`${label} must be an object`);
  if (!FORMAT_TYPES.has(format.type)) fail(`${label}.type is invalid`);
  if (!FORMAT_STATES.has(format.state)) fail(`${label}.state is invalid`);
  if (!Array.isArray(format.destinations)) fail(`${label}.destinations must be an array`);
  format.destinations.forEach((destination, destinationIndex) => validateDestination(destination, `${label}.destinations[${destinationIndex}]`));

  const active = format.state === 'preorder' || format.state === 'available';
  if (active && format.destinations.length === 0) fail(`${label} active state requires at least one destination`);
  if (!active && format.destinations.length !== 0) fail(`${label} inactive state must not retain purchase destinations`);
}

function validateEdition(edition) {
  if (!edition || typeof edition !== 'object' || Array.isArray(edition)) fail('edition must be an object outside development state');
  nonempty(edition.title, 'edition.title');
  if (edition.release_date !== null && !isIsoDate(edition.release_date)) fail('edition.release_date must be null or YYYY-MM-DD');
}

export function validateReleaseConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('release config must be an object');
  if (config.schema_version !== 1) fail('unsupported release schema_version');
  if (!RELEASE_STATES.has(config.state)) fail('invalid release state');
  if (!Array.isArray(config.formats)) fail('formats must be an array');

  const seenFormats = new Set();
  config.formats.forEach((format, index) => {
    validateFormat(format, index);
    if (seenFormats.has(format.type)) fail(`duplicate format type: ${format.type}`);
    seenFormats.add(format.type);
  });

  if (!config.collector || typeof config.collector !== 'object' || Array.isArray(config.collector)) fail('collector must be an object');
  if (!COLLECTOR_STATES.has(config.collector.state)) fail('invalid collector state');
  if (config.collector.destination !== null) validatePublicUrl(config.collector.destination, 'collector.destination');

  if (!config.press || typeof config.press !== 'object' || Array.isArray(config.press)) fail('press must be an object');
  const pressUrl = validatePublicUrl(config.press.canonical_url, 'press.canonical_url', { allowRootRelative: true });
  if (pressUrl !== '/press/') fail('press.canonical_url must remain /press/');

  if (config.replacement_url !== null) validatePublicUrl(config.replacement_url, 'replacement_url', { allowRootRelative: true });

  const activeFormats = config.formats.filter(format => format.state === 'preorder' || format.state === 'available');
  const preorderFormats = config.formats.filter(format => format.state === 'preorder');
  const availableFormats = config.formats.filter(format => format.state === 'available');

  if (config.state === 'development') {
    if (config.edition !== null) fail('development state must not publish edition facts');
    if (config.formats.length !== 0) fail('development state must not publish commercial formats');
    if (config.collector.state !== 'disabled' || config.collector.destination !== null) fail('development state must keep collector support disabled');
    if (config.replacement_url !== null) fail('development state must not define replacement_url');
    return config;
  }

  validateEdition(config.edition);

  if (config.state === 'announced') {
    if (activeFormats.length) fail('announced state must not expose preorder/available destinations');
    if (config.collector.state === 'preorder' || config.collector.state === 'available') fail('announced state cannot activate collector sales');
  }

  if (config.state === 'preorder') {
    if (!isIsoDate(config.edition.release_date)) fail('preorder state requires edition.release_date');
    if (preorderFormats.length === 0) fail('preorder state requires at least one preorder format');
    if (availableFormats.length) fail('preorder state cannot claim released formats');
  }

  if (config.state === 'released') {
    if (!isIsoDate(config.edition.release_date)) fail('released state requires edition.release_date');
    if (availableFormats.length === 0) fail('released state requires at least one available format');
  }

  if (config.state === 'superseded' || config.state === 'withdrawn') {
    if (activeFormats.length) fail(`${config.state} state must remove active purchase destinations`);
    if (config.collector.state === 'preorder' || config.collector.state === 'available') fail(`${config.state} state must disable active collector sales`);
  }

  if (config.state === 'superseded' && config.replacement_url === null) fail('superseded state requires replacement_url');
  if (config.state === 'withdrawn' && config.replacement_url !== null) fail('withdrawn state must not imply a replacement');

  if (config.collector.state === 'preorder') {
    if (config.state !== 'preorder' && config.state !== 'released') fail('collector preorder requires preorder/released edition state');
    if (config.collector.destination === null) fail('collector preorder requires a destination');
  } else if (config.collector.state === 'available') {
    if (config.state !== 'released') fail('collector availability requires released edition state');
    if (config.collector.destination === null) fail('collector availability requires a destination');
  } else if (config.collector.destination !== null) {
    fail('inactive collector state must not retain a purchase destination');
  }

  return config;
}

export function validateReleaseFile(root = process.cwd()) {
  const file = path.join(root, 'src', 'release.json');
  let config;
  try { config = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { fail(`invalid src/release.json: ${error.message}`); }
  return validateReleaseConfig(config);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    validateReleaseFile();
    console.log('Public release-state contract passed.');
  } catch (error) {
    console.error(`release-state validation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
