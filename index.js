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

console.clear();
createImageLock();


function createImageLock() {
  console.log(chalk.cyan('----------imageLock current:----------'));
  console.log(imageLock.current)
  console.log(chalk.cyan('----------start looping:----------'));
  loopFolder(rootPath).then(() => {
    if (argv.debug) {
      console.log(chalk.cyan('----------imageLock new:----------'));
      console.log(imageLock.new)
    }

    fs.writeFile('./image-lock.json', JSON.stringify(imageLock.new, null, 2), err => {
      console.log('./image-lock.json written')
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
  console.log(chalk.blue(`${indent} Open folder:`), input);

  const files = await fs.promises.readdir(input);
  let promises = files.map(async file => {
    if (file === '.DS_Store') {
      return;
    }

    const filePath = path.join(input, file)
    const stat = await fs.promises.stat(filePath);
    const timeStamp = stat.ctime.toISOString();
    if (stat.isFile()) {
      if (!imageLockEntryExists(filePath, argv.key, timeStamp)) {
        createImageLockEntry(filePath, argv.key, timeStamp);
      } else {
        console.log(chalk.yellow(`- key '${argv.key}' already exists:`), filePath);
      }

    } else if (stat.isDirectory()) {
      await loopFolder(filePath, lvl + 1);
    }

    return filePath;
  })

  return await Promise.all(promises).then((files) => {
    console.log(chalk.blue(`${indent} Done folder:`), input);
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

function createImageLockEntry(filePath, key, timeStamp){

  if (!imageLock.new.hasOwnProperty(filePath)) {
    console.log(chalk.green(`New file found:`), filePath);
    imageLock.new[filePath] = {};
  }

  if (!imageLock.new[filePath].hasOwnProperty(key)) {
    console.log(chalk.magenta(`New key found for:`), filePath);
  }

  imageLock.new[filePath][key] = timeStamp;
}