/**
 * roadhog命令所执行的脚本，根据传入的参数，确定调用build dev test 等不同的脚本
 */
import chalk from 'chalk';
import { fork } from 'child_process';

// graceful-process优雅退出进程（即使是父进程收到kill信号）
require('graceful-process')({ logLevel: 'warn' });

// script：node roadhog.js 后的一个参数
const script = process.argv[2];
// args：node roadhog.js [script] [...args]
const args = process.argv.slice(3);

const nodeVersion = process.versions.node;
const versions = nodeVersion.split('.');
const major = versions[0];
const minor = versions[1];

if (major * 10 + minor * 1 < 65) {
  console.log(`Node version must >= 6.5, but got ${major}.${minor}`);
  process.exit(1);
}

// Notify update when process exits
const updater = require('update-notifier'); // update-notifier：检查当前版本与最新版本，提示可以升级
const pkg = require('../package.json');
updater({ pkg: pkg }).notify({ defer: true });

const scriptAlias = {
  server: 'dev',
};
// 获取传入的script，如果是server，则转为dev, 其他按照原值
const aliasedScript = scriptAlias[script] || script;
switch (aliasedScript) {
  case '-v':
  case '--version':
    const pkg = require('../package.json');
    console.log(pkg.version);
    if (!(pkg._from && pkg._resolved)) {
      console.log(chalk.cyan('@local'));
    }
    break;
  case 'build':
  case 'dev':
  case 'test':
    const proc = fork(
      require.resolve(`../lib/scripts/${aliasedScript}`),
      args,
      {
        stdio: 'inherit',
      },
    );
    proc.once('exit', code => {
      process.exit(code);
    });
    process.once('exit', () => {
      proc.kill();
    });
    break;
  default:
    console.log(`Unknown script ${chalk.cyan(script)}.`);
    break;
}
