#!/usr/bin/env node

import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import ImageLock from "../lib/ImageLock.mjs";

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

const imageLock = new ImageLock(argv);

// If --watch then start watch
argv.watch ? imageLock.watch() : imageLock.run();
