import fs from 'fs';
import path from 'path';
import chokidar from "chokidar";
import chalk from "chalk";
import imagemin from "imagemin";
import imageminWebp from "imagemin-webp";
import LockFile from "../src/LockFile.mjs";

export default class ImageLock {
  path;
  action;
  debug;
  timer = false;
  rootPath = "./images";
  actions = [];

  /**
   * @param path
   * @param action
   * @param debug
   */
  constructor({ path = "./images", action = false, debug = false }) {
    this.lockFile = new LockFile({ debug: debug });
    this.rootPath = path;
    this.action = action;
    this.debug = debug;
  }

  /**
   * Init
   */
  run() {
    console.clear();
    console.log(chalk.cyan('Start image lock'));
    console.info('Run through files');
    this.lockFile.resetStats();
    this.lockFile.get();

    this.loopFiles(this.rootPath).then(() => {
      this.lockFile.removeOldEntries();
      this.lockFile.write();
    });
  }

  /**
   * Watch
   */
  watch() {
    console.info('start watching...');
    const watcher = chokidar.watch(this.rootPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
    });

    // Something to use when events are received.
    const log = console.log.bind(console);

    // Add event listeners.
    watcher
      .on('add', path => {
        log(`File ${path} has been added`)
        this.captureEventAndRun();
      })
      .on('change', path => {
        log(`File ${path} has been changed`)
        this.captureEventAndRun();
      })
      .on('unlink', path => {
        log(`File ${path} has been removed`)
        this.captureEventAndRun();
      })
      .on('ready', () => {
        this.run();
      });

    process.on('SIGINT', () => {
      watcher.close().then(() => {
        console.log('\nWatching Image Lock successful stopped...');
        console.log(`${chalk.red('If you stopped the watch while performing tasks, then `image-lock.json` is not saved.')}`);
      });
    });
  }

  /**
   * Capture event and run
   */
  captureEventAndRun() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), 100);
  }


  /**
   * Loop Files§
   * @param inputPath
   * @returns {Promise<string[]>}
   */
  async loopFiles(inputPath) {
    const files = await fs.promises.readdir(inputPath);
    let promises = files.map(async file => {
      if (file === '.DS_Store') {
        return;
      }

      const filePath = path.join(inputPath, file)
      const stat = await fs.promises.stat(filePath);
      const timeStamp = stat.mtime.toISOString();

      if (stat.isFile()) {
        this.lockFile.stats.files++;

        if (!this.lockFile.isActionExists(filePath, this.action, timeStamp)) {
          this.updateProcess();
          this.lockFile.stats.actionsFound++;

          await this.runAction(inputPath, file).then(() => {
            this.lockFile.stats.tasksPerformed++;
            this.updateProcess();
          });

          this.lockFile.addAction(filePath, this.action, timeStamp);
        } else {
          this.lockFile.stats.actionsExists++;

          if (this.debug) {
            console.log(chalk.yellow(`- action '${this.action}' already exists:`), filePath);
          }
        }

        this.lockFile.addDifferenceEntry(filePath);
        this.updateProcess();
      } else if (stat.isDirectory()) {
        await this.loopFiles(filePath);
      }

      return filePath;
    })

    return await Promise.all(promises).then((files) => {
//    console.log(files);
    });
  }

  /**
   * Add action
   * @param key
   * @param callback
   * @param reverseCallback
   * @returns {Promise<ImageLock>}
   */
  async addAction(key, callback, reverseCallback) {
    console.log(key, callback);
    this.actions[key] = callback;

    return this;
  }

  /**
   * Run Action
   * @param inputPath
   * @param file
   * @returns {Promise<void>}
   */
  async runAction(inputPath, file) {
    const filePath = path.join(inputPath, file);

    console.log(this.actions);
    this.actions.forEach((action)=>{
      console.log(action, filePath);
      action(filePath);
    });

    if (this.action !== 'webp') {
      return;
    }

    await imagemin([filePath], {
      destination: path.join('build', inputPath),
      plugins: [
        imageminWebp({ quality: 80 })
      ]
    });
  }

  async runActionDeleted(inputPath, file) {
    // perform action for removal of file
  }


  /**
   * Update process
   */
  updateProcess() {
    if (this.debug) {
      return;
    }

    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`${this.lockFile.stats.files.toString()} files found. Of which ${this.lockFile.stats.actionsFound} new actions. Performing tasks: ${this.lockFile.stats.tasksPerformed.toString()}/${this.lockFile.stats.actionsFound.toString()}...`);
  }
}
