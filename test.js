#!/usr/bin/env node

import {ImageLock} from "./index.mjs";

const imageLock = new ImageLock({path: './images', action: '1235', debug: true});
imageLock.addAction('wefefafeabp',(path)=>{console.log(path)});
imageLock.run();

