const { spawn } = require('child_process');

const checkProcess = spawn('npm', ['ls', '--omit=dev'], {
  shell: true
});
checkProcess.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

checkProcess.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

checkProcess.on('close', (code) => {
  if (code === 0) {
    console.log('All dependencies are installed!');
  }
  console.error('Missing dependencies!');
  installDependencies();
});
function installDependencies() {
  console.log('Installing dependencies...');
  const installProcess = spawn('npm', ['install', '--save'], {
    shell: true
  });
  installProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  installProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  installProcess.on('close', (code) => {
    if (code === 0) {
      console.log('All dependencies are installed!');
    }
    console.log(`child process exited with code ${code}`);
  });
}
