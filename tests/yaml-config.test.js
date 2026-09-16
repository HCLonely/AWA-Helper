/**
 * @file tests/yaml-config.test.js
 * @description 验证 YAML 配置解析、校验与原子写入。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  parse
} = require('yaml');
const {
  createConfigValidationError, getYamlFieldLine, updateYamlFieldsSync, validateYaml
} = require('../dist/tools/config/YamlConfig');

test('updateYamlFieldsSync safely updates secrets and preserves unrelated fields', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'awa-helper-config-'));
  const configPath = path.join(directory, 'config.yml');
  t.after(() => fs.rmSync(directory, {
    recursive: true,
    force: true
  }));
  fs.writeFileSync(configPath, '# keep this comment\nawaCookie: old\nwebUI:\n  enable: true\n');

  const cookie = "name=value=with=equals;quoted='value'";
  updateYamlFieldsSync(configPath, {
    awaCookie: cookie
  });

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

test('configuration validation errors include exact or nearest YAML line', () => {
  const content = 'language: zh\nproxy:\n  enable: []\n  host: ""\n  port: 0\n';
  assert.equal(getYamlFieldLine(content, 'proxy.host'), 4);
  assert.equal(getYamlFieldLine(content, 'proxy.username'), 2);
  const error = createConfigValidationError(content, [
    'proxy.host must be a non-empty string',
    'proxy.port must be an integer between 1 and 65535'
  ]);
  assert.equal(error.mark.line, 3);
  assert.match(error.message, /line 4 \(proxy\.host\)/);
  assert.match(error.message, /line 5 \(proxy\.port\)/);
});
