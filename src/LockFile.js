import fs from 'fs';
import Stats from './Stats.js';
import chalk from "chalk";
import {difference} from "./utils.js";

export default class LockFile {
  file;
  stats;
  lockFilePath = './image-lock.json';

  constructor(argv) {
    /**
     * @type {{new: {}, current: {}, difference: {}}}
     */
    this.file = {
      current: {},
      new: {},
      difference: [],
    }

    /**
     * @type {(...data: any[]) => void}
     */
    if (argv) {
      this.isDebug = argv.debug;
    }

    /**
     * @type {Stats}
     */
    this.stats = new Stats();
  }

  resetStats() {
    this.stats = new Stats();
  }

  /**
   * Add Action
   * @param filePath
   * @param action
   * @param timeStamp
   */
  addAction(filePath, action, timeStamp) {
    if (!this.file.new.hasOwnProperty(filePath)) {
      // Create new file entry
      this.file.new[filePath] = {};

      // Write this.stats
      this.stats.imagesNew++;

      if (this.isDebug) {
        console.log(chalk.green(`New file found:`), filePath);
      }
    }

    // Log new action
    if (!this.file.new[filePath].hasOwnProperty(action)) {
      // Write this.stats
      this.stats.actionsNew++;

      if (this.isDebug) {
        console.log(chalk.magenta(`New action found for:`), filePath);
      }
    } else if (this.file.new[filePath][action] !== timeStamp) {
      // Write this.stats
      this.stats.actionsUpdated++;
      console.log(chalk.red('action updated' + filePath));

      if (this.isDebug) {
        console.log(chalk.magenta(`Updated action found for:`), filePath);
      }
    }

    // Create/Update action
    this.file.new[filePath][action] = timeStamp;
  }


  /**
   *
   * @param filePath
   * @param action
   * @param timeStamp
   * @returns {boolean}
   */
  isActionExists(filePath, action, timeStamp) {
    // does file exist?
    if (!this.file.current.hasOwnProperty(filePath)) {
      return false;
    }

    // does action exist?
    if (!this.file.current[filePath].hasOwnProperty(action)) {
      return false;
    }

    // does timestamp math?
    return this.file.current[filePath][action] === timeStamp;
  }

  /**
   * Get File
   */
  get() {
    if (fs.existsSync(this.lockFilePath)) {
      this.file.current = fs.readFileSync(this.lockFilePath);
      this.file.current = JSON.parse(this.file.current);
      this.file.difference = []
      this.file.new = this.file.current;
    }
  }

  /**
   * Write lock file
   */
  write() {
    fs.writeFile(this.lockFilePath, JSON.stringify(this.file.new, null, 2), err => {
      if (err) {
        console.error(err)
      } else {
        process.stdout.write('\n');
        console.log(`${chalk.yellow(this.lockFilePath)} successful written:`);
        console.log(`
------------------------------
  ${chalk.green(this.stats.imagesNew)}\t images new
  ${chalk.red(this.stats.imagesDeleted)}\t images deleted
  \t ------------
  ${chalk.magenta(this.stats.actionsNew)}\t actions registered
  ${chalk.cyan(this.stats.actionsUpdated)}\t actions updated
  ${chalk.yellow(this.stats.actionsExists)}\t actions ignored
  ${chalk.red('x')}\t actions removed (not supported yet)
  \t ------------
  ${chalk.green(this.stats.tasksPerformed)}\t ${chalk.bold('tasks performed')}
  ${chalk.green('x')}\t ${chalk.bold('removal tasks performed (not supported yet)')}
------------------------------
      `);
        console.log(chalk.green('✓ Done!', `${performance.now().toFixed(0)}ms`));
      }
      //file written successfully
    })
  }

  /**
   * Remove Old Entries
   */
  removeOldEntries() {
    const oldEntries = Object.keys(difference({ ...this.file.new }, this.file.difference));

    if (oldEntries.length > 0) {
      for (let entry of oldEntries) {
        if (this.file.new[entry]) {
          delete this.file.new[entry]
          this.stats.imagesDeleted++;
        } else {
        }
      }
    }
  }

  /**
   *
   * @param filePath
   */
  addDifferenceEntry(filePath){
    this.file.difference.push(filePath);
  }
}
