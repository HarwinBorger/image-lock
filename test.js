#!/usr/bin/env node

import {ImageLock} from "./index.mjs";

const imageLock = new ImageLock({path: './images', action: 'webp', debug: false});
imageLock.run();
