#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import process from 'process';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

const argv = yargs(hideBin(process.argv)).usage('Usage: $0 [options]')
                                         .example('$0 --key keyname', 'set a key for each different action you want to log')
                                         .alias('k', 'key').nargs('k', 1).describe('k', 'Set unique key')
                                         .demandOption(['k'])
                                         .alias('d', 'debug').describe('d', 'Debug')
                                         .alias('p', 'path').describe('p', 'Path')
                                         .demandOption(['k'])
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


if (fs.existsSync('image-lock.json')) {
  imageLock.current = fs.readFileSync('image-lock.json');
  imageLock.current = JSON.parse(imageLock.current);
  imageLock.new = imageLock.current;
}

const stats = {
  files: 0,
  new: 0,
  keysNew: 0,
  keysExists: 0,
  deleted: 0
}

console.clear();
console.log(chalk.cyan('Start image lock'));
createImageLock();


function createImageLock() {
  if (argv.file) {
    console.log(imageLock.current)
  }
  loopFolder(rootPath).then(() => {
    if (argv.file) {
      console.log(imageLock.new)
    }

    fs.writeFile('./image-lock.json', JSON.stringify(imageLock.new, null, 2), err => {
      process.stdout.write('\n');
      console.log('./image-lock.json written:');
      console.log('------------------------------');
      console.log(`${chalk.green(stats.new)}\t new image \n${chalk.magenta(stats.keysNew)}\t keys added \n${chalk.yellow(stats.keysExists)}\t keys ignored \n${chalk.red(stats.deleted)}\t deleted`);
      console.log('------------------------------');
      console.log(chalk.green('Done!'));
      if (err) {
        console.error(err)
      }
      //file written successfully
    })
  });
}

/**
 * LoopFolder
 * @param input
 * @param lvl
 * @returns {Promise<string[]>}
 */
async function loopFolder(input, lvl = 1) {
  const indent = '|'.repeat(lvl);

  const files = await fs.promises.readdir(input);
  let promises = files.map(async file => {
    if (file === '.DS_Store') {
      return;
    }

    const filePath = path.join(input, file)
    const stat = await fs.promises.stat(filePath);
    const timeStamp = stat.ctime.toISOString();
    if (stat.isFile()) {
      stats.files ++;
      if (!imageLockEntryExists(filePath, argv.key, timeStamp)) {
        createImageLockEntry(filePath, argv.key, timeStamp);
      } else {
        stats.keysExists ++;
        if (argv.debug) {
          console.log(chalk.yellow(`- key '${argv.key}' already exists:`), filePath);
        }
      }

      updateProcess();

    } else if (stat.isDirectory()) {
      await loopFolder(filePath, lvl + 1);
    }

    return filePath;
  })

  return await Promise.all(promises).then((files) => {
//    console.log(files);
  });
}

function imageLockEntryExists(filePath, key, timeStamp) {
  // does file exist?
  if (!imageLock.current.hasOwnProperty(filePath)) {
    return false;
  }

  // does key exist?
  if (!imageLock.current[filePath].hasOwnProperty(key)) {
    return false;
  }

  // does timestamp math?
  return imageLock.current[filePath][key] === timeStamp;
}

function createImageLockEntry(filePath, key, timeStamp) {

  if (!imageLock.new.hasOwnProperty(filePath)) {
    stats.new ++;
    imageLock.new[filePath] = {};

    if (argv.debug) {
      console.log(chalk.green(`New file found:`), filePath);
    }
  }

  if (!imageLock.new[filePath].hasOwnProperty(key)) {
    stats.keysNew ++;

    if (argv.debug) {
      console.log(chalk.magenta(`New key found for:`), filePath);
    }
  }

  imageLock.new[filePath][key] = timeStamp;
}

function updateProcess() {
  if (argv.debug) {
    return;
  }

  let currentProcess = '|';
  if (stats.files < 10) {
    currentProcess += '|'.repeat(stats.files);
  } else if (stats.files < 100) {
    currentProcess += '|'.repeat(10);
    currentProcess += '|'.repeat(stats.files / 10);
  } else if (stats.files < 1000) {
    currentProcess += '|'.repeat(20);
    currentProcess += '|'.repeat(stats.files / 100);
  } else if (stats.files < 10000) {
    currentProcess += '|'.repeat(30);
    currentProcess += '|'.repeat(stats.files / 1000);
  }
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(currentProcess + ' - ' + stats.files.toString() + ' files.');
}