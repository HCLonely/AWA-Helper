const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const version = require('../package.json').version;
const numericVersion = version.split('-')[0].split('.').map(Number);
if (numericVersion.length !== 3 || numericVersion.some((part) => !Number.isInteger(part) || part < 0 || part > 65535)) {
  throw new Error('Invalid Windows resource version');
}
fs.mkdirSync('native/windows-tray/obj', { recursive: true });
fs.writeFileSync('native/windows-tray/obj/version.h', `#define AWA_VERSION "${version}"\n#define AWA_FILE_VERSION ${numericVersion.join(',')},0\n`);

const vswhere = path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
if (!fs.existsSync(vswhere)) {
  throw new Error('Visual Studio Build Tools were not found; cannot build AWA-Manager.exe');
}

const installationPath = execFileSync(vswhere, [
  '-latest',
  '-products', '*',
  '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
  '-property', 'installationPath'
], { encoding: 'utf8' }).trim();
if (!installationPath) {
  throw new Error('The Visual C++ x64 toolchain is required to build AWA-Manager.exe');
}

const msbuild = path.join(installationPath, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
fs.rmSync(path.resolve('output/AWA-Manager.pdb'), { force: true });
execFileSync(msbuild, [
  path.resolve('native/windows-tray/AWA-Manager.vcxproj'),
  '/m',
  '/restore',
  '/p:Configuration=Release',
  '/p:Platform=x64',
  ...(process.argv.includes('--test') ? ['/p:NativeTests=true'] : []),
  '/verbosity:minimal'
], { stdio: 'inherit' });
if (process.argv.includes('--test')) {
  execFileSync(path.resolve('output/AWA-Updater-tests.exe'), [], { stdio: 'inherit' });
}
