// Запуск системного Chrome для проверок и замеров. Сцене нужен настоящий WebGL 2: на Windows —
// через Direct3D 11 на видеокарте, на Linux без видеокарты (CI) — программный SwiftShader.
// AETHERIUM_GL=gpu|software переопределяет выбор.
const { chromium } = require('@playwright/test');

const GPU_ARGS = process.platform === 'win32'
  ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--enable-gpu', '--ignore-gpu-blocklist'];
const SOFTWARE_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

function graphicsArgs() {
  const choice = process.env.AETHERIUM_GL || (process.platform === 'linux' ? 'software' : 'gpu');
  return choice === 'software' ? SOFTWARE_ARGS : GPU_ARGS;
}

exports.launchChrome = (extraArgs = []) => chromium.launch({ channel: 'chrome', headless: true, args: [...graphicsArgs(), ...extraArgs] });
