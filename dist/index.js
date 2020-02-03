'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; // $FlowIgnore
// $FlowIgnore
// $FlowIgnore

// $FlowIgnore


var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _makeDir = require('make-dir');

var _makeDir2 = _interopRequireDefault(_makeDir);

var _del = require('del');

var _del2 = _interopRequireDefault(_del);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lodash = require('lodash');

var _log = require('./log');

var _log2 = _interopRequireDefault(_log);

var _report = require('./report');

var _report2 = _interopRequireDefault(_report);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _processAdaptor = require('./process-adaptor');

var _processAdaptor2 = _interopRequireDefault(_processAdaptor);

var _imageFinder = require('./image-finder');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var copyImages = function copyImages(actualImages, _ref) {
  var expectedDir = _ref.expectedDir,
      actualDir = _ref.actualDir;

  return Promise.all(actualImages.map(function (image) {
    return new Promise(function (resolve, reject) {
      try {
        _makeDir2.default.sync(_path2.default.dirname(_path2.default.join(expectedDir, image)));
        var writeStream = _fs2.default.createWriteStream(_path2.default.join(expectedDir, image));
        _fs2.default.createReadStream(_path2.default.join(actualDir, image)).pipe(writeStream);
        writeStream.on('finish', function (err) {
          if (err) reject(err);
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }));
};

var compareImages = function compareImages(emitter, _ref2) {
  var expectedImages = _ref2.expectedImages,
      actualImages = _ref2.actualImages,
      dirs = _ref2.dirs,
      matchingThreshold = _ref2.matchingThreshold,
      thresholdPixel = _ref2.thresholdPixel,
      thresholdRate = _ref2.thresholdRate,
      concurrency = _ref2.concurrency,
      enableAntialias = _ref2.enableAntialias;

  var images = actualImages.filter(function (actualImage) {
    return expectedImages.includes(actualImage);
  });
  concurrency = images.length < 20 ? 1 : concurrency || 4;
  var processes = (0, _lodash.range)(concurrency).map(function () {
    return new _processAdaptor2.default(emitter);
  });
  return _bluebird2.default.map(images, function (image) {
    var p = processes.find(function (p) {
      return !p.isRunning();
    });
    if (p) {
      return p.run(_extends({}, dirs, {
        image: image,
        matchingThreshold: matchingThreshold,
        thresholdRate: thresholdRate,
        thresholdPixel: thresholdPixel,
        enableAntialias: enableAntialias
      }));
    }
  }, { concurrency: concurrency }).then(function (result) {
    processes.forEach(function (p) {
      return p.close();
    });
    return result;
  }).filter(function (r) {
    return !!r;
  });
};

var cleanupExpectedDir = function cleanupExpectedDir(expectedDir, changedFiles) {
  var paths = changedFiles.map(function (image) {
    return _path2.default.join(expectedDir, image);
  });
  (0, _del2.default)(paths);
};

var aggregate = function aggregate(result) {
  var passed = result.filter(function (r) {
    return r.passed;
  }).map(function (r) {
    return r.image;
  });
  var failed = result.filter(function (r) {
    return !r.passed;
  }).map(function (r) {
    return r.image;
  });
  var diffItems = failed.map(function (image) {
    return image.replace(/\.[^\.]+$/, '.png');
  });
  return { passed: passed, failed: failed, diffItems: diffItems };
};

var updateExpected = function updateExpected(_ref3) {
  var actualDir = _ref3.actualDir,
      expectedDir = _ref3.expectedDir,
      diffDir = _ref3.diffDir,
      deletedImages = _ref3.deletedImages,
      newImages = _ref3.newImages,
      diffItems = _ref3.diffItems;

  cleanupExpectedDir(expectedDir, [].concat(_toConsumableArray(deletedImages), _toConsumableArray(diffItems)));
  return copyImages([].concat(_toConsumableArray(newImages), _toConsumableArray(diffItems)), {
    actualDir: actualDir,
    expectedDir: expectedDir,
    diffDir: diffDir
  }).then(function () {
    _log2.default.success('\nAll images are updated. ');
  });
};

module.exports = function (params) {
  var actualDir = params.actualDir,
      expectedDir = params.expectedDir,
      diffDir = params.diffDir,
      json = params.json,
      concurrency = params.concurrency,
      update = params.update,
      report = params.report,
      urlPrefix = params.urlPrefix,
      threshold = params.threshold,
      matchingThreshold = params.matchingThreshold,
      thresholdRate = params.thresholdRate,
      thresholdPixel = params.thresholdPixel,
      enableAntialias = params.enableAntialias,
      enableClientAdditionalDetection = params.enableClientAdditionalDetection;

  var dirs = { actualDir: actualDir, expectedDir: expectedDir, diffDir: diffDir };
  var emitter = new _events2.default();

  var _findImages = (0, _imageFinder.findImages)(expectedDir, actualDir),
      expectedImages = _findImages.expectedImages,
      actualImages = _findImages.actualImages,
      deletedImages = _findImages.deletedImages,
      newImages = _findImages.newImages;

  _makeDir2.default.sync(expectedDir);
  _makeDir2.default.sync(diffDir);

  setImmediate(function () {
    return emitter.emit('start');
  });
  compareImages(emitter, {
    expectedImages: expectedImages,
    actualImages: actualImages,
    dirs: dirs,
    matchingThreshold: matchingThreshold,
    thresholdRate: thresholdRate || threshold,
    thresholdPixel: thresholdPixel,
    concurrency: concurrency,
    enableAntialias: !!enableAntialias
  }).then(function (result) {
    return aggregate(result);
  }).then(function (_ref4) {
    var passed = _ref4.passed,
        failed = _ref4.failed,
        diffItems = _ref4.diffItems;

    return (0, _report2.default)({
      passedItems: passed,
      failedItems: failed,
      newItems: newImages,
      deletedItems: deletedImages,
      expectedItems: update ? actualImages : expectedImages,
      actualItems: actualImages,
      diffItems: diffItems,
      json: json || './reg.json',
      actualDir: actualDir,
      expectedDir: expectedDir,
      diffDir: diffDir,
      report: report || '',
      urlPrefix: urlPrefix || '',
      enableClientAdditionalDetection: !!enableClientAdditionalDetection
    });
  }).then(function (result) {
    deletedImages.forEach(function (image) {
      return emitter.emit('compare', { type: 'delete', path: image });
    });
    newImages.forEach(function (image) {
      return emitter.emit('compare', { type: 'new', path: image });
    });
    if (update) {
      return updateExpected({
        actualDir: actualDir,
        expectedDir: expectedDir,
        diffDir: diffDir,
        deletedImages: deletedImages,
        newImages: newImages,
        diffItems: result.diffItems
      }).then(function () {
        emitter.emit('update');
        return result;
      });
    }
    return result;
  }).then(function (result) {
    return emitter.emit('complete', result);
  }).catch(function (err) {
    return emitter.emit('error', err);
  });

  return emitter;
};