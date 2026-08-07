const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { parse } = require('yaml');
const { updateYamlFieldsSync, validateYaml } = require('../dist/core/config/yamlConfig');

test('updateYamlFieldsSync safely updates secrets and preserves unrelated fields', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-helper-config-'));
  const configPath = path.join(directory, 'config.yml');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(configPath, '# keep this comment\nawaCookie: old\nwebUI:\n  enable: true\n');

  const cookie = "name=value=with=equals;quoted='value'";
  updateYamlFieldsSync(configPath, { awaCookie: cookie });

  const output = fs.readFileSync(configPath, 'utf8');
  const parsed = parse(output);
  assert.equal(parsed.awaCookie, cookie);
  assert.equal(parsed.webUI.enable, true);
  assert.match(output, /keep this comment/);
  assert.equal(fs.readdirSync(directory).some((name) => name.endsWith('.tmp')), false);
});

test('validateYaml rejects malformed YAML', () => {
  assert.throws(() => validateYaml('key: [unterminated'));
});
