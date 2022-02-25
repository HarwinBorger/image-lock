import imagemin from "imagemin";
import imageminWebp from "imagemin-webp";

export default class Action {
  constructor() {
  }

  async run(inputPath, file) {
    if (argv.action !== 'webp') {
      return;
    }

    const filePath = path.join(inputPath, file);
    await imagemin([filePath], {
      destination: path.join('build', inputPath),
      plugins: [
        imageminWebp({ quality: 80 })
      ]
    });
  }
}
