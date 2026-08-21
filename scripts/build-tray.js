const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
  '/verbosity:minimal'
], { stdio: 'inherit' });
