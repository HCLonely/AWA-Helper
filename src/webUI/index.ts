/*
 * @Author       : HCLonely
 * @Date         : 2024-09-11 15:27:30
 * @LastEditTime : 2025-06-17 12:30:30
 * @LastEditors  : HCLonely
 * @FilePath     : /AWA-Helper/src/webUI/index.ts
 * @Description  :
 */
/* eslint-disable no-unused-vars */
/* global logs, __, language */
import express from 'express';
import expressWs from 'express-ws';
import type WebSocket from 'ws';
import { Logger, time } from '../tool';
import chalk from 'chalk';
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
  app.get('/health/live', (_, res) => {
    res.status(200).json({ status: 'live', version: globalThis.version });
  });
  app.get('/run-status', (req, res) => {
    const remoteAddress = req.socket.remoteAddress || '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress)) {
      res.status(404).end();
      return;
    }
    res.send(`${process.pid}`).end();
  });

  // @ts-ignore
  app.ws('/ws', (ws: WebSocket, _) => {
    new Logger(time() + chalk.blue(__('webUIConnect')));
    globalThis.wsClients.add(ws);
    ws.send(JSON.stringify(logs));
    /*
  ws.on('message', (msg:any) => {
    console.log(`receive message ${msg}`);
  });
  */

    ws.on('close', (e: any) => {
      globalThis.wsClients.delete(ws);
      new Logger(time() + chalk.blue(__('webUIDisconnect')));
    });
  });
  return server || app;
};
export { createServer };
