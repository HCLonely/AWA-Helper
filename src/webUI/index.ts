/* eslint-disable no-unused-vars */
/* global WebSocket, logs, __, language */
import * as express from 'express';
import * as expressWs from 'express-ws';
import * as fs from 'fs';
import type WebSocket from 'ws';
import { Logger, time } from '../tool';
import * as chalk from 'chalk';
import * as https from 'https';
// @ts-ignore
import indexHtml from './dist/index.html';

// @ts-ignore
import * as zh from '../locales/zh.json';
// @ts-ignore
import * as en from '../locales/en.json';

const createServer = (options?: { key: Buffer, cert: Buffer }) => {
  let server;
  const app = express();
  // app.use(express.static(`${__dirname}/webUI/static`));
  if (options?.key && options?.cert) {
    server = https.createServer(options, app);
  }
  expressWs(app, server);
  const langs: {
    [name: string]: string
  } = {
    zh,
    en
  };

  app.get('/', (_, res) => {
    res.send(
      // fs.readFileSync(`${__dirname}/webUI/index.html`).toString()
      indexHtml.replace('__LANG__', language)
        .replaceAll('__VERSION__', globalThis.version)
        .replace('__I18N__', JSON.stringify(langs))
    ).end();
  });
  app.get('/run-status', (_, res) => {
    res.send(`${process.pid}`).end();
  });

  // @ts-ignore
  app.ws('/ws', (ws: WebSocket, _) => {
    new Logger(time() + chalk.blue(__('webUIConnect')));
    globalThis.ws = ws;
    ws.send(JSON.stringify(logs));
    /*
  ws.on('message', (msg:any) => {
    console.log(`receive message ${msg}`);
  });
  */

    ws.on('close', (e: any) => {
      globalThis.ws = null;
      new Logger(time() + chalk.blue(__('webUIDisconnect')));
    });
  });
  return server || app;
};
export { createServer };
