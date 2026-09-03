const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { formatSize } = require('./format');

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scanSegments(dir, prefix) {
    const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
    return fs.readdirSync(dir)
        .filter(f => pattern.test(f))
        .map(f => {
            const match = f.match(pattern);
            return { name: f, num: parseInt(match[1], 10) };
        })
        .sort((a, b) => a.num - b.num);
}

function segmentSizes(files, dir) {
    const sizeMap = new Map();
    files.forEach(f => {
        sizeMap.set(f.name, fs.statSync(path.join(dir, f.name)).size);
    });
    return sizeMap;
}

function resolveSkips(files, dir, opts) {
    const skipSet = new Set(opts.skip.map(s => `${opts.prefix}${s}`));

    if (opts.auto) {
        return resolveAutoSkips(files, dir, skipSet, opts);
    }

    if (opts.skip.length === 0 && !process.env.CI) {
        return resolveInteractiveSkips(files, dir, skipSet, opts);
    }

    return skipSet;
}

function resolveAutoSkips(files, dir, skipSet, opts) {
    const sizeMap = segmentSizes(files, dir);
    const sorted = [...files].sort((a, b) => sizeMap.get(a.name) - sizeMap.get(b.name));
    const medianSize = sizeMap.get(sorted[Math.floor(sorted.length / 2)]);
    const thresholdBytes = opts.threshold * 1024 * 1024;

    let autoSkipped = 0;
    for (const f of files) {
        const sz = sizeMap.get(f.name);
        const rel = medianSize > 0 ? sz / medianSize : 1;
        const belowAbsThreshold = sz < thresholdBytes;
        const tinyRelative = rel < 0.1 && sz < medianSize * 0.1;

        if (tinyRelative || (belowAbsThreshold && sz < 32 * 1024)) {
            skipSet.add(f.name);
            autoSkipped++;
        }
    }

    if (autoSkipped > 0) {
        console.log(`\nAuto mode: skipped ${autoSkipped} suspicious segment(s)`);
    } else {
        console.log('\nAuto mode: all segments look healthy');
    }

    return skipSet;
}

async function resolveInteractiveSkips(files, dir, skipSet, opts) {
    const sizeMap = segmentSizes(files, dir);

    console.log('\nTop 10 smallest segments (may be broken/incomplete):');
    const sizeInfo = files
        .map(f => ({
            num: f.num,
            segment: f.name,
            size: formatSize(sizeMap.get(f.name)),
            bytes: sizeMap.get(f.name),
        }))
        .sort((a, b) => a.bytes - b.bytes)
        .slice(0, 10);

    console.table(sizeInfo.map(({ num, segment, size }) => ({ num, segment, size })));

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
        rl.question('Skip any? (Enter=none, or 1922,1923): ', resolve);
    });
    rl.close();

    if (answer.trim()) {
        answer.split(',').forEach(s => {
            const num = s.trim();
            if (/^\d+$/.test(num)) skipSet.add(`${opts.prefix}${num}`);
        });
    }

    return skipSet;
}

module.exports = { scanSegments, segmentSizes, resolveSkips };
