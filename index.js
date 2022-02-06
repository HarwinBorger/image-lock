#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import process from 'process';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
import chokidar from 'chokidar';

const argv = yargs(hideBin(process.argv)).usage('Usage: $0 [options]')
                                         .example('$0 --action keyname', 'set a action for each different action you want to log')
                                         .describe('a', 'Set unique action').alias('a', 'action').nargs('a', 1).demandOption(['action'])
                                         .describe('d', 'Debug').alias('d', 'debug')
                                         .describe('p', 'Path').alias('p', 'path')
                                         .describe('watch', 'Watch')
                                         .help('h')
                                         .alias('h', 'help')
                                         .locale('en')
                                         .epilog('copyright 2022').argv;

let rootPath = argv.path;

if (rootPath === undefined) {
  rootPath = "./images";
}

const imageLock = {};
imageLock.current = {};
imageLock.new = {};
imageLock.difference = [];


if (fs.existsSync('image-lock.json')) {
  imageLock.current = fs.readFileSync('image-lock.json');
  imageLock.current = JSON.parse(imageLock.current);
  imageLock.new = imageLock.current;
}

const stats = {
  files: 0,
  imagesNew: 0,
  imagesDeleted: 0,
  actionsNew: 0,
  actionsUpdated: 0,
  actionsExists: 0,
  actionsFound: 0,
  actionsRemoved: 0, // TODO build in
  tasksPerformed: 0,
}

console.clear();
console.log(chalk.cyan('Start image lock'));
if (argv.watch) {
  watch();
} else {
  run();
}

/**
 * Init
 */
function run() {
  if (argv.file) {
    console.log(imageLock.current)
  }

  loopFiles(rootPath).then(() => {
    if (argv.file) {
      console.log(imageLock.new)
    }

    const oldEntries = difference({...imageLock.new}, imageLock.difference);
    imageLock.new = removeOldEntries(imageLock.new, Object.keys(oldEntries));

    createImageLockFile();
  });
}

function watch() {
  console.log('start watching...');
  console.error(chalk.yellow('Please note: Watch function not writing image-lock.json yet...'));
  const watcher = chokidar.watch(rootPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
  });

// Something to use when events are received.
  const log = console.log.bind(console);
// Add event listeners.
  watcher
    .on('add', path => log(`File ${path} has been added`))
    .on('change', path => log(`File ${path} has been changed`))
    .on('unlink', path => log(`File ${path} has been removed`))
    .on('ready', () => {
      run();
    });

  process.on('SIGINT', () => {
    watcher.close().then(() => {
      console.log('\nWatching Image Lock successful stopped...');
      console.log(`${chalk.red('image-lock.json not saved yet... ')} I am still working on it!`);
    });
  });
}

/**
 * Create Image Lock File
 */
function createImageLockFile() {
  fs.writeFile('./image-lock.json', JSON.stringify(imageLock.new, null, 2), err => {
    if (err) {
      console.error(err)
    } else {
      process.stdout.write('\n');
      console.log(`${chalk.yellow('./image-lock.json')} successful written:`);
      console.log(`
------------------------------
  ${chalk.green(stats.imagesNew)}\t images new
  ${chalk.red(stats.imagesDeleted)}\t images deleted
  \t ------------
  ${chalk.magenta(stats.actionsNew)}\t actions registered
  ${chalk.cyan(stats.actionsUpdated)}\t actions updated
  ${chalk.yellow(stats.actionsExists)}\t actions ignored
  ${chalk.red('x')}\t actions removed (not supported yet)
  \t ------------
  ${chalk.green(stats.tasksPerformed)}\t ${chalk.bold('tasks performed')}
------------------------------
      `);
      console.log(chalk.green('✓ Done!', `${performance.now().toFixed(0)}ms`));
    }
    //file written successfully
  })
}

/**
 * Loop Files§
 * @param inputPath
 * @returns {Promise<string[]>}
 */
async function loopFiles(inputPath) {
  const files = await fs.promises.readdir(inputPath);
  let promises = files.map(async file => {
    if (file === '.DS_Store') {
      return;
    }

    const filePath = path.join(inputPath, file)
    const stat = await fs.promises.stat(filePath);
    const timeStamp = stat.atime.toISOString();

    if (stat.isFile()) {
      stats.files ++;

      if (!imageLockActionExists(filePath, argv.action, timeStamp)) {
        updateProcess();
        stats.actionsFound ++;

        await runAction(inputPath, file).then(() => {
          stats.tasksPerformed ++;
          updateProcess();
        });

        addImageLockAction(filePath, argv.action, timeStamp);
      } else {
        stats.actionsExists ++;

        if (argv.debug) {
          console.log(chalk.yellow(`- action '${argv.action}' already exists:`), filePath);
        }
      }

      imageLock.difference.push(filePath);
      updateProcess();
    } else if (stat.isDirectory()) {
      await loopFiles(filePath);
    }

    return filePath;
  })

  return await Promise.all(promises).then((files) => {
//    console.log(files);
  });
}

/**
 * Run Action
 * @param inputPath
 * @param file
 * @returns {Promise<void>}
 */
async function runAction(inputPath, file) {
  if (argv.action !== 'webp') {
    return;
  }

  const filePath = path.join(inputPath, file);
  await imagemin([filePath], {
    destination: path.join('build/images', inputPath),
    plugins: [
      imageminWebp({quality: 50})
    ]
  });
}

async function runActionDeleted(inputPath, file) {
  // perform action for removal of file
}


function imageLockActionExists(filePath, action, timeStamp) {
  // does file exist?
  if (!imageLock.current.hasOwnProperty(filePath)) {
    return false;
  }

  // does action exist?
  if (!imageLock.current[filePath].hasOwnProperty(action)) {
    return false;
  }

  // does timestamp math?
  return imageLock.current[filePath][action] === timeStamp;
}

function addImageLockAction(filePath, action, timeStamp) {

  if (!imageLock.new.hasOwnProperty(filePath)) {
    // Create new file entry
    imageLock.new[filePath] = {};

    // Write stats
    stats.imagesNew ++;

    // Debug
    if (argv.debug) {
      console.log(chalk.green(`New file found:`), filePath);
    }
  }

  // Log new action
  if (!imageLock.new[filePath].hasOwnProperty(action)) {
    // Write stats
    stats.actionsNew ++;

    // Debug
    if (argv.debug) {
      console.log(chalk.magenta(`New action found for:`), filePath);
    }
  } else if (imageLock.new[filePath][action] !== timeStamp) {
    // Write stats
    stats.actionsUpdated ++;

    // Debug
    if (argv.debug) {
      console.log(chalk.magenta(`Updated action found for:`), filePath);
    }
  }

  // Create/Update action
  imageLock.new[filePath][action] = timeStamp;
}

/**
 * Update process
 */
function updateProcess() {
  if (argv.debug) {
    return;
  }

  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(`${stats.files.toString()} files found. Of which ${stats.actionsFound} new actions. Performing tasks: ${stats.tasksPerformed.toString()}/${stats.actionsFound.toString()}...`);
}

function difference(setA, setB) {
  let _difference = setA;
  for (let elem of setB) {
    delete _difference[elem];
  }
  return _difference
}

function removeOldEntries(newEntries, oldEntries) {
  if (oldEntries.length > 0) {
    for (let entry of oldEntries) {
      if (newEntries[entry]) {
        delete newEntries[entry]
        stats.imagesDeleted ++;
      } else {
      }
    }
  }
  return newEntries
}