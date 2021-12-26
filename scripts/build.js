const vfs = require('vinyl-fs');
const babel = require('@babel/core');
const through = require('through2');
const chalk = require('chalk');
const rimraf = require('rimraf');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
// 替代Node.js提供的文件系统的watch模式
const chokidar = require('chokidar');

const nodeBabelConfig = {
  presets: [
    [
      require.resolve('@babel/preset-env'),
      {
        targets: {
          node: 6,
        },
      },
    ],
  ],
  plugins: [
    require.resolve('@babel/plugin-proposal-export-default-from'),
    require.resolve('@babel/plugin-proposal-do-expressions'),
    require.resolve('@babel/plugin-proposal-class-properties'),
  ],
};
const browserBabelConfig = {
  presets: [
    [
      require.resolve('@babel/preset-env'),
      {
        browsers: ['last 2 versions', 'IE 10'],
      },
    ],
    require.resolve('@babel/preset-react'),
  ],
  plugins: [
    require.resolve('@babel/plugin-proposal-export-default-from'),
    require.resolve('@babel/plugin-proposal-do-expressions'),
    require.resolve('@babel/plugin-proposal-class-properties'),
  ],
};

const BROWSER_FILES = [];
const cwd = process.cwd();

function isBrowserTransform(path) {
  return BROWSER_FILES.includes(path.replace(`${cwd}/`, ''));
}

function transform(opts = {}) {
  const { content, path } = opts;
  const isBrowser = isBrowserTransform(path);
  console.log(
    chalk[isBrowser ? 'yellow' : 'blue'](
      `[TRANSFORM] ${path.replace(`${cwd}/`, '')}`,
    ),
  );
  const config = isBrowser ? browserBabelConfig : nodeBabelConfig;
  return babel.transform(content, config).code;
}

/**
 * 构建过程：
 * 使用vinyl-fs虚拟文件系统进行流式转换，读取源代码，转换源代码为目标代码，写入到目标文件夹下
 */
function build() {
  rimraf.sync(join(cwd, 'lib'));
  return vfs
    .src(`./src/**/*.js`)
    .pipe(
      through.obj((f, enc, cb) => {
        f.contents = new Buffer( // eslint-disable-line
          transform({
            content: f.contents,
            path: f.path,
          }),
        );
        cb(null, f);
      }),
    )
    .pipe(vfs.dest(`./lib/`));
}

/**
 * 初始化，完成以下工作
 * 1. 首次构建
 * 2. 如果使用了watch模式，则对更新的文件重新转换源代码，生成目标代码，写入到目标文件中
 *    因为构建过程是所有src下面的文件进行源代码转换并写入目标路径，而watch模式下只需要对
 *    更新的文件进行转换写入过程
 */
function init() {
  const arg = process.argv[2];
  const isWatch = arg === '-w' || arg === '--watch';
  build();
  if (isWatch) {
    const watcher = chokidar.watch(join(cwd, 'src'), {
      ignoreInitial: true,
    });
    watcher.on('all', (event, fullPath) => {
      const relPath = fullPath.replace(`${cwd}/src/`, '');
      const content = readFileSync(fullPath, 'utf-8');
      try {
        const code = transform({
          content,
          path: fullPath,
        });
        writeFileSync(join(cwd, 'lib', relPath), code, 'utf-8');
      } catch (e) {
        console.log(chalk.red('Compiled failed.'));
        console.log(chalk.red(e.message));
      }
    });
  }
}

init();
