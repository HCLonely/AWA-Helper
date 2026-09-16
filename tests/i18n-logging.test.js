/**
 * @file tests/i18n-logging.test.js
 * @description 回归验证运行时日志的国际化行为。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const {
  parse
} = require('yaml');

const root = path.resolve(__dirname, '..');
const locale = (name) => parse(fs.readFileSync(path.join(root, 'src/locales', `${name}.yml`), 'utf8'));
const sourceFiles = (directory) => fs.readdirSync(directory, {
  withFileTypes: true
}).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  if (entry.isDirectory()) return sourceFiles(target);
  return entry.isFile() && entry.name.endsWith('.ts') ? [target] : [];
});

const walk = (node, visit) => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};

test('Chinese and English catalogs expose the same translation keys', () => {
  const zhKeys = Object.keys(locale('zh')).sort();
  const enKeys = Object.keys(locale('en')).sort();
  assert.deepEqual(zhKeys, enKeys);
});

test('literal runtime log messages and appended statuses use the i18n translator', () => {
  const violations = [];
  for (const filename of sourceFiles(path.join(root, 'src'))) {
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    walk(source, (node) => {
      const loggerConstruction = ts.isNewExpression(node) && node.expression.getText(source) === 'Logger';
      const loggerAppend = ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ['log', 'consoleLog'].includes(node.expression.name.text);
      if ((!loggerConstruction && !loggerAppend) || !node.arguments?.length) return;
      const argument = node.arguments[0];
      if (ts.isObjectLiteralExpression(argument)) return;
      let translated = false;
      let hasLiteralProse = false;
      walk(argument, (child) => {
        if (ts.isCallExpression(child) && child.expression.getText(source) === '__') translated = true;
        if ((ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) && /[A-Za-z\u3400-\u9fff]{3}/.test(child.text)) {
          hasLiteralProse = true;
        }
        if (ts.isTemplateExpression(child) && /[A-Za-z\u3400-\u9fff]{3}/.test(child.head.text)) hasLiteralProse = true;
      });
      if (hasLiteralProse && !translated) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        violations.push(`${path.relative(root, filename)}:${position.line + 1}`);
      }
    });
  }
  assert.deepEqual(violations, []);
});
