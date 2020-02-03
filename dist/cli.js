#!/usr/bin/env node
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

// import notifier from './notifier';


var _cliSpinner = require('cli-spinner');

var _meow = require('meow');

var _meow2 = _interopRequireDefault(_meow);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _ = require('./');

var _2 = _interopRequireDefault(_);

var _log = require('./log');

var _log2 = _interopRequireDefault(_log);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _icon = require('./icon');

var _report = require('./report');

var _report2 = _interopRequireDefault(_report);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var spinner = new _cliSpinner.Spinner();
spinner.setSpinnerString(18);

var cli = (0, _meow2.default)('\n  Usage\n    $ reg-cli /path/to/actual-dir /path/to/expected-dir /path/to/diff-dir\n  Options\n    -U, --update Update expected images.(Copy `actual images` to `expected images`).\n    -J, --json Specified json report path. If omitted ./reg.json.\n    -I, --ignoreChange If true, error will not be thrown when image change detected.\n    -E, --extendedErrors If true, also added/deleted images will throw an error. If omitted false.\n    -R, --report Output html report to specified directory.\n    -P, --urlPrefix Add prefix to all image src.\n    -M, --matchingThreshold Matching threshold, ranges from 0 to 1. Smaller values make the comparison more sensitive. 0 by default.\n    -T, --thresholdRate Rate threshold for detecting change. When the difference ratio of the image is larger than the set rate detects the change.\n    -S, --thresholdPixel Pixel threshold for detecting change. When the difference pixel of the image is larger than the set pixel detects the change. This value takes precedence over `thresholdRate`.\n    -C, --concurrency How many processes launches in parallel. If omitted 4.\n    -A, --enableAntialias. Enable antialias. If omitted false.\n    -X, --additionalDetection. Enable additional difference detection(highly experimental). Select "none" or "client" (default: "none").\n    -F, --from Generate report from json. Please specify json file. If set, only report will be output without comparing images.\n  Examples\n    $ reg-cli /path/to/actual-dir /path/to/expected-dir /path/to/diff-dir -U -D ./reg.json\n', {
  alias: {
    U: 'update',
    J: 'json',
    I: 'ignoreChange',
    E: 'extendedErrors',
    R: 'report',
    P: 'urlPrefix',
    M: 'matchingThreshold',
    T: 'thresholdRate',
    S: 'thresholdPixel',
    C: 'concurrency',
    A: 'enableAntialias',
    X: 'additionalDetection',
    F: 'from'
  }
});
if (!cli.flags.from) {
  if (!process.argv[2] || !process.argv[3] || !process.argv[4]) {
    _log2.default.fail('please specify actual, expected and diff images directory.');
    _log2.default.fail('e.g.: $ reg-cli /path/to/actual-dir /path/to/expected-dir /path/to/diff-dir');
    process.exit(1);
  }
}

var json = cli.flags.json ? cli.flags.json.toString() : './reg.json'; // default output path

var urlPrefix = typeof cli.flags.urlPrefix === 'string' ? cli.flags.urlPrefix : './';

var report = typeof cli.flags.report === 'string' ? cli.flags.report : !!cli.flags.report ? './report.html' : '';

var actualDir = process.argv[2];
var expectedDir = process.argv[3];
var diffDir = process.argv[4];
var update = !!cli.flags.update;
var extendedErrors = !!cli.flags.extendedErrors;
var ignoreChange = !!cli.flags.ignoreChange;
var enableClientAdditionalDetection = cli.flags.additionalDetection === 'client';
var from = String(cli.flags.from || '');

// If from option specified, generate report from json and exit.
if (from) {
  var _json = '';
  try {
    _json = _fs2.default.readFileSync(from, { encoding: 'utf8' });
  } catch (e) {
    _log2.default.fail('Failed to read specify json.');
    _log2.default.fail(e);
    process.exit(1);
  }

  try {
    var params = JSON.parse(_json);
    (0, _report2.default)(_extends({}, params, {
      json: _json || './reg.json',
      report: report || './report.html',
      urlPrefix: urlPrefix || '',
      enableClientAdditionalDetection: enableClientAdditionalDetection,
      fromJSON: true
    }));
    process.exit(0);
  } catch (e) {
    _log2.default.fail('Failed to parse json. Please specify valid json.');
    _log2.default.fail(e);
    process.exit(1);
  }
}

var observer = (0, _2.default)({
  actualDir: actualDir,
  expectedDir: expectedDir,
  diffDir: diffDir,
  update: update,
  report: report,
  json: json,
  urlPrefix: urlPrefix,
  matchingThreshold: Number(cli.flags.matchingThreshold),
  thresholdRate: Number(cli.flags.thresholdRate),
  thresholdPixel: Number(cli.flags.thresholdPixel),
  concurrency: Number(cli.flags.concurrency) || 4,
  enableAntialias: !!cli.flags.enableAntialias,
  enableClientAdditionalDetection: enableClientAdditionalDetection
});

observer.once('start', function () {
  return spinner.start();
});

observer.on('compare', function (params) {
  spinner.stop(true);
  var file = _path2.default.join('' + actualDir, '' + params.path);
  switch (params.type) {
    case 'delete':
      return _log2.default.warn(_icon.MINUS + ' delete  ' + file);
    case 'new':
      return _log2.default.info(_icon.GREEK_CROSS + ' append  ' + file);
    case 'pass':
      return _log2.default.success(_icon.CHECK_MARK + ' pass    ' + file);
    case 'fail':
      return _log2.default.fail(_icon.BALLOT_X + ' change  ' + file);
  }
  spinner.start();
});

observer.once('update', function () {
  return _log2.default.success('\u2728 your expected images are updated \u2728');
});

observer.once('complete', function (_ref) {
  var failedItems = _ref.failedItems,
      deletedItems = _ref.deletedItems,
      newItems = _ref.newItems,
      passedItems = _ref.passedItems;

  spinner.stop(true);
  _log2.default.info('\n');
  if (failedItems.length) _log2.default.fail(_icon.BALLOT_X + ' ' + failedItems.length + ' file(s) changed.');
  if (deletedItems.length) _log2.default.warn(_icon.MINUS + ' ' + deletedItems.length + ' file(s) deleted.');
  if (newItems.length) _log2.default.info(_icon.GREEK_CROSS + ' ' + newItems.length + ' file(s) appended.');
  if (passedItems.length) _log2.default.success(_icon.CHECK_MARK + ' ' + passedItems.length + ' file(s) passed.');
  if (!update && (failedItems.length > 0 || extendedErrors && (newItems.length > 0 || deletedItems.length > 0))) {
    _log2.default.fail('\nInspect your code changes, re-run with `-U` to update them. ');
    if (!ignoreChange) process.exit(1);
  }
  return process.exit(0);
});

observer.once('error', function (error) {
  _log2.default.fail(error);
  process.exit(1);
});