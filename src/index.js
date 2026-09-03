const { merge } = require('./run');
const { parseArgs, HELP_TEXT } = require('./args');
const { scanSegments, resolveSkips, segmentSizes } = require('./scanner');
const { findFFmpeg, findFFprobe, runFFmpeg, makeConcatList, probeDuration } = require('./ffmpeg');
const { MergerUI, isTTY } = require('./progress');
const { formatSize, formatDuration } = require('./format');

module.exports = {
    merge,
    parseArgs,
    HELP_TEXT,
    scanSegments,
    resolveSkips,
    segmentSizes,
    findFFmpeg,
    findFFprobe,
    runFFmpeg,
    makeConcatList,
    probeDuration,
    MergerUI,
    isTTY,
    formatSize,
    formatDuration,
};
