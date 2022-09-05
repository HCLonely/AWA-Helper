const { spawn } = require('child_process');
const path = require('path');

const green = (text) => `\x1B[32m${text}\x1B[0m`;
const red = (text) => `\x1B[31m${text}\x1B[0m`;

const npmCommand = process.argv[2] ? path.resolve(`${process.argv[2]}npm`) : 'npm';

// 安装模块
const installDependencies = () => {
  console.log('Installing dependencies...');
  const installProcess = spawn(npmCommand, ['install', '--save'], {
    shell: true
  });
  const stdout = [];
  const stderr = [];
  installProcess.stdout.on('data', (data) => {
    stdout.push(data);
  });

  installProcess.stderr.on('data', (data) => {
    stderr.push(data);
  });

  installProcess.on('close', (code) => {
    if (code === 0) {
      return console.log(green('All dependencies are installed!'));
    }
    console.log(`Stdout: \n${stdout.join('\n')}`);
    console.log(`Stderr: \n${stderr.join('\n')}`);
    console.log(red(`child process exited with code ${code}`));
  });
};

// 检测是否缺少模块
const checkDependencies = () => {
  const checkProcess = spawn(npmCommand, ['ls', '--omit=dev'], {
    shell: true
  });
  const stdout = [];
  const stderr = [];
  checkProcess.stdout.on('data', (data) => {
    stdout.push(data);
  });

  checkProcess.stderr.on('data', (data) => {
    stderr.push(data);
  });

  checkProcess.on('close', (code) => {
    if (code === 0) {
      return console.log(green('All dependencies are installed!'));
    }
    console.log(`Stdout: \n${stdout.join('\n')}`);
    console.log(`Stderr: \n${stderr.join('\n')}`);
    console.error(red('Missing dependencies!'));
    installDependencies();
  });
};

checkDependencies();
