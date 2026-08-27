import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = path.join(ROOT, 'examples', 'decide-in-ci');

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

test('migrated example reconstructs the exact legacy files', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(EXAMPLE, 'migration-manifest.json'), 'utf8'),
  );

  assert.equal(manifest.issue, 'TIN-369');
  assert.equal(manifest.text_normalization, 'lf');
  assert.equal(manifest.files.length, 3);

  for (const spec of manifest.files) {
    // Git stores these text files with LF. Normalize the Windows working-tree
    // representation before comparing content hashes and reconstructing source.
    const canonical = (
      await readFile(path.join(ROOT, spec.canonical_path), 'utf8')
    ).replaceAll('\r\n', '\n');
    assert.equal(sha256(Buffer.from(canonical)), spec.canonical_sha256);

    let legacy = canonical;
    for (const replacement of spec.reverse_text_replacements) {
      assert.ok(legacy.includes(replacement.canonical));
      legacy = legacy.replaceAll(replacement.canonical, replacement.legacy);
    }
    assert.equal(sha256(Buffer.from(legacy)), spec.legacy_sha256);
  }
});

test('copy-ready workflow uses the maintained action and stays inert here', async () => {
  const workflow = await readFile(path.join(EXAMPLE, 'decide.yml'), 'utf8');
  const readme = await readFile(path.join(EXAMPLE, 'README.md'), 'utf8');
  const actionReadme = await readFile(path.join(ROOT, 'decide', 'README.md'), 'utf8');

  assert.match(workflow, /TinyEdgeAI\/tinyedge-actions\/decide@v1/);
  assert.doesNotMatch(workflow, /tinyedge-agent\/actions/);
  assert.match(actionReadme, /TinyEdgeAI\/tinyedge-actions\/decide@v1/);
  assert.doesNotMatch(actionReadme, /tinyedge-agent\/actions/);
  assert.match(workflow, /secrets\.TINYEDGE_API_KEY/);
  assert.match(readme, /\.github\/workflows\/decide\.yml/);
  assert.ok(!path.relative(ROOT, path.join(EXAMPLE, 'decide.yml')).startsWith('.github'));
});
