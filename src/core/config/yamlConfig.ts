import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { parseDocument } from 'yaml';

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

const updateYamlFieldsSync = (filePath: string, fields: Record<string, unknown>): void => {
  const document = parseDocument(fs.readFileSync(filePath, 'utf8'));
  if (document.errors.length > 0) {
    throw document.errors[0];
  }
  Object.entries(fields).forEach(([name, value]) => document.set(name, value));
  atomicWriteFileSync(filePath, document.toString());
};

export { atomicWriteFileSync, updateYamlFieldsSync, validateYaml };
