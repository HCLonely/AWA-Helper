/**
 * @file src/tools/config/YamlConfig.ts
 * @description 校验 YAML 文本，定位错误字段，并以原子方式更新配置文件。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { isMap, LineCounter, parseDocument } from 'yaml';

type ValidationErrorWithLocation = Error & {
  mark?: {
    line: number
  }
  issues: Array<{
    field: string,
    line?: number,
    message: string
  }>
};

/**
 * 同步原子写入文件。
 * @param filePath - 待读取或写入文件的路径，类型为 `string`。
 * @param content - 需要解析、校验或写入的文本内容，类型为 `string`。
 * @returns `void`，该函数仅执行副作用，不返回值。
 */
const atomicWriteFileSync = (filePath: string, content: string): void => {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporaryPath, content, {
      encoding: 'utf8',
      mode: 0o600
    });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, {
      force: true
    });
  }
};

/**
 * 校验 YAML 内容。
 * @param content - 需要解析、校验或写入的文本内容，类型为 `string`。
 * @returns `void`，该函数仅执行副作用，不返回值。
 */
const validateYaml = (content: string): void => {
  const document = parseDocument(content);
  if (document.errors.length > 0) {
    throw document.errors[0];
  }
};

/**
 * 获取 YAML 字段所在行。
 * @param content - 需要解析、校验或写入的文本内容，类型为 `string`。
 * @param field - 需要读取、校验或更新的字段，类型为 `string`。
 * @returns `number | undefined`，getYamlFieldLine 获取到的数据。
 */
const getYamlFieldLine = (content: string, field: string): number | undefined => {
  const lineCounter = new LineCounter();
  const document = parseDocument(content, {
    lineCounter
  });
  if (document.errors.length > 0) {
    return undefined;
  }
  let current = document.contents;
  let nearestOffset: number | undefined;
  for (const segment of field.split('.')) {
    if (!isMap(current)) {
      break;
    }
    const pair = current.items.find((item) => String((item.key as {
      value?: unknown
    } | null)?.value) === segment);
    if (!pair) {
      break;
    }
    const keyRange = (pair.key as {
      range?: [number, number, number]
    } | null)?.range;
    const valueRange = (pair.value as {
      range?: [number, number, number]
    } | null)?.range;
    nearestOffset = keyRange?.[0] ?? valueRange?.[0] ?? nearestOffset;
    current = pair.value;
  }
  return nearestOffset === undefined ? undefined : lineCounter.linePos(nearestOffset).line;
};

/**
 * 创建配置校验错误。
 * @param content - 需要解析、校验或写入的文本内容，类型为 `string`。
 * @param errors - 配置校验过程中收集的错误信息列表，类型为 `string[]`。
 * @returns `ValidationErrorWithLocation`，createConfigValidationError 创建的对象或数据。
 */
const createConfigValidationError = (content: string, errors: Array<string>): ValidationErrorWithLocation => {
  const issues = errors.map((message) => {
    const [field] = message.split(' ');
    return {
      field,
      line: getYamlFieldLine(content, field),
      message
    };
  });
  const details = issues.map((issue) => `- ${issue.line ? `line ${issue.line} (${issue.field})` : issue.field}: ${issue.message}`).join('\n');
  const error = new Error(`Invalid configuration:\n${details}`) as ValidationErrorWithLocation;
  error.issues = issues;
  const firstLocatedIssue = issues.find((issue) => issue.line !== undefined);
  if (firstLocatedIssue?.line !== undefined) {
    error.mark = {
      line: firstLocatedIssue.line - 1
    };
  }
  return error;
};

/**
 * 同步更新 YAML 字段。
 * @param filePath - 待读取或写入文件的路径，类型为 `string`。
 * @param fields - 需要读取、校验或更新的字段，类型为 `Record<string, unknown>`。
 * @returns `void`，该函数仅执行副作用，不返回值。
 */
const updateYamlFieldsSync = (filePath: string, fields: Record<string, unknown>): void => {
  const document = parseDocument(fs.readFileSync(filePath, 'utf8'));
  if (document.errors.length > 0) {
    throw document.errors[0];
  }
  Object.entries(fields).forEach(([name, value]) => {
    const path = name.split('.');
    if (path.length === 1) {
      document.set(name, value);
    } else {
      document.setIn(path, value);
    }
  });
  atomicWriteFileSync(filePath, document.toString());
};

/** 仅在此作业仍拥有磁盘上的 Cookie 时提交会话刷新结果。 */
const createCookieCommit = (filePath: string, initialCookie: string): ((cookie: string) => boolean) => {
  let expectedCookie = initialCookie;
  let superseded = false;
  return (cookie) => {
    if (superseded) {
      return false;
    }
    const document = parseDocument(fs.readFileSync(filePath, 'utf8'));
    if (document.errors.length) {
      throw document.errors[0];
    }
    if (document.get('awaCookie') !== expectedCookie) {
      superseded = true;
      return false;
    }
    if (cookie !== expectedCookie) {
      document.set('awaCookie', cookie);
      atomicWriteFileSync(filePath, document.toString());
      expectedCookie = cookie;
    }
    return true;
  };
};

export { atomicWriteFileSync, createConfigValidationError, createCookieCommit, getYamlFieldLine, updateYamlFieldsSync, validateYaml };
