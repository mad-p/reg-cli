/* @flow */

import { imgDiff } from 'img-diff-js'; // $FlowIgnore
import md5File from 'md5-file'; // $FlowIgnore
import path from 'path';

export type DiffCreatorParams = {
  actualDir: string;
  expectedDir: string;
  diffDir: string;
  image: string;
  matchingThreshold: number,
  thresholdRate?: number,
  thresholdPixel?: number,
  enableAntialias: boolean;
}

export type DiffResult = {
  image: string;
  ratio: number;
  passed: boolean;
}

const getMD5 = (file) => new Promise((resolve, reject) => {
  md5File(file, (err, hash) => {
    if (err) reject(err);
    resolve(hash);
  })
});

const isPassed = ({ width, height, diffCount, thresholdPixel, thresholdRate }: {
  width: number,
  height: number,
  diffCount: number,
  thresholdPixel?: number,
  thresholdRate?: number
}) => {
  if (typeof thresholdPixel === "number") {
    return diffCount <= thresholdPixel;
  } else if (typeof thresholdRate === "number") {
    const totalPixel = width * height;
    const ratio = (diffCount / totalPixel).toFixed(6);
    return ratio <= thresholdRate;
  }
  return diffCount === 0;
};

const createDiff = ({
  actualDir, expectedDir, diffDir, image, matchingThreshold, thresholdRate, thresholdPixel, enableAntialias
}: DiffCreatorParams) => {
  return Promise.all([
    getMD5(path.join(actualDir, image)),
    getMD5(path.join(expectedDir, image)),
  ]).then(([actualHash, expectedHash]) => {
    if (actualHash === expectedHash) {
      if (!process || !process.send) return;
      return process.send({ passed: true, image, ratio: 0 });
    }
    const diffImage = image.replace(/\.[^\.]+$/, ".png");
    return imgDiff({
      actualFilename: path.join(actualDir, image),
      expectedFilename: path.join(expectedDir, image),
      diffFilename: path.join(diffDir, diffImage),
      options: {
        threshold: matchingThreshold,
        includeAA: !enableAntialias,
      },
    })
      .then(({ width, height, diffCount }) => {
        const totalPixel = width * height;
        const ratio = diffCount / totalPixel;
        const passed = isPassed({ width, height, diffCount, thresholdPixel, thresholdRate });
        if (!process || !process.send) return;
        process.send({ passed, image, ratio });
      })
  })
};

process.on('message', (data) => {
  createDiff(data);
});
