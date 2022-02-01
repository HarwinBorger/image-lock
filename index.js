import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import process from 'process';

let [, , rootPath, debug] = process.argv;

console.clear();

if (rootPath === undefined) {
  rootPath = "./images";
}

let lock = [];
if (fs.existsSync('image-lock.json')) {
  lock = fs.readFileSync('image-lock.json');
  lock = JSON.parse(lock);
}

const imageLock = [];
createImageLock();

function createImageLock() {
  loopFolder(rootPath).then(() => {
    if(debug){
      console.log(imageLock)
    }

    fs.writeFile('./image-lock.json', JSON.stringify(imageLock, null, 2), err => {
      console.log('./image-lock.json written')
      if (err) {
        console.error(err)
      }
      //file written successfully
    })
  });
}

async function loopFolder(input, lvl = 1) {
  var indent = '|'.repeat(lvl);
  console.log(chalk.blue(`${indent} Open folder:`), input);

  const files = await fs.promises.readdir(input);
  let promises = files.map(async file => {
    if (file === '.DS_Store') {
      return;
    }

    const filePath = path.join(input, file)
    const stat = await fs.promises.stat(filePath);

    if (stat.isFile()) {
      console.log(chalk.yellow(`${indent}- Found file:`), filePath, stat.ctime);

      if (!exists(filePath).length) {
        console.log(chalk.magenta('new file found'), filePath);
      } else {
        console.log(chalk.red('already exists'), filePath);
      }

      imageLock.push({'path': filePath, 'ctime': stat.ctime});
    } else if (stat.isDirectory()) {
      await loopFolder(filePath, lvl + 1);
    }

    return filePath;
  })

  return await Promise.all(promises).then((files) => {
    console.log(chalk.green(`${indent} Done folder:`), input);
  });
}

function exists(input) {
  return lock.filter(function (item) {
    return item.path === input;
  });
}