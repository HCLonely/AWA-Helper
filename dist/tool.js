"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.time = exports.random = exports.sleep = exports.log = void 0;
const chalk = require("chalk");
const dayjs = require("dayjs");
const log = (text, newLine = true) => {
    if (newLine)
        console.log(text);
    else
        process.stdout.write(text);
};
exports.log = log;
const sleep = (time) => new Promise((resolve) => {
    const timeout = setTimeout(() => {
        clearTimeout(timeout);
        resolve(true);
    }, time * 1000);
});
exports.sleep = sleep;
const random = (minNum, maxNum) => Math.floor((Math.random() * (maxNum - minNum + 1)) + minNum);
exports.random = random;
const time = () => chalk.gray(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] `);
exports.time = time;
