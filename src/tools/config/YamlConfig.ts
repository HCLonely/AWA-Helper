/**
 * @file YamlConfig
 * @description Validates, atomically writes, and selectively updates YAML configuration files.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { isMap, LineCounter, parseDocument } from 'yaml';

type ValidationErrorWithLocation = Error & {
  mark?: { line: number }
  issues: Array<{ field: string, line?: number, message: string }>
};

const atomicWriteFileSync = (filePath: string, content: string): void => {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporaryPath, content, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
};

const validateYaml = (content: string): void => {
  const document = parseDocument(content);
  if (document.errors.length > 0) {
    throw document.errors[0];
  }
};

const getYamlFieldLine = (content: string, field: string): number | undefined => {
  const lineCounter = new LineCounter();
  const document = parseDocument(content, { lineCounter });
  if (document.errors.length > 0) return undefined;
  let current = document.contents;
  let nearestOffset: number | undefined;
  for (const segment of field.split('.')) {
    if (!isMap(current)) break;
    const pair = current.items.find((item) => String((item.key as { value?: unknown } | null)?.value) === segment);
    if (!pair) break;
    const keyRange = (pair.key as { range?: [number, number, number] } | null)?.range;
    const valueRange = (pair.value as { range?: [number, number, number] } | null)?.range;
    nearestOffset = keyRange?.[0] ?? valueRange?.[0] ?? nearestOffset;
    current = pair.value;
  }
  return nearestOffset === undefined ? undefined : lineCounter.linePos(nearestOffset).line;
};

const createConfigValidationError = (content: string, errors: Array<string>): ValidationErrorWithLocation => {
  const issues = errors.map((message) => {
    const [field] = message.split(' ');
    return { field, line: getYamlFieldLine(content, field), message };
  });
  const details = issues.map((issue) => `- ${issue.line ? `line ${issue.line} (${issue.field})` : issue.field}: ${issue.message}`).join('\n');
  const error = new Error(`Invalid configuration:\n${details}`) as ValidationErrorWithLocation;
  error.issues = issues;
  const firstLocatedIssue = issues.find((issue) => issue.line !== undefined);
  if (firstLocatedIssue?.line !== undefined) error.mark = { line: firstLocatedIssue.line - 1 };
  return error;
};

const updateYamlFieldsSync = (filePath: string, fields: Record<string, unknown>): void => {
  const document = parseDocument(fs.readFileSync(filePath, 'utf8'));
  if (document.errors.length > 0) {
    throw document.errors[0];
  }
  Object.entries(fields).forEach(([name, value]) => {
    const path = name.split('.');
    if (path.length === 1) document.set(name, value);
    else document.setIn(path, value);
  });
  atomicWriteFileSync(filePath, document.toString());
};

export { atomicWriteFileSync, createConfigValidationError, getYamlFieldLine, updateYamlFieldsSync, validateYaml };
