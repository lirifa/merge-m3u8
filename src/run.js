const fs = require('fs');
const path = require('path');
const { parseArgs, HELP_TEXT } = require('./args');
const { scanSegments, resolveSkips, segmentSizes } = require('./scanner');
const { findFFmpeg, runFFmpeg, makeConcatList } = require('./ffmpeg');
const { MergerUI } = require('./progress');
const { formatSize } = require('./format');

function listFilePath(workDir) {
    return path.join(workDir, `concat.${process.pid}.${Date.now()}.txt`);
}

function uniquifyOutputPath(workDir, fileName) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    let name = fileName;
    let candidate = path.join(workDir, name);
    let counter = 1;

    while (fs.existsSync(candidate)) {
        name = `${base} (${counter})${ext}`;
        candidate = path.join(workDir, name);
        counter++;
    }

    return { name, path: candidate };
}

function resolveWorkDir(dir) {
    return dir ? path.resolve(dir) : process.cwd();
}

function validateSegments(files, workDir, prefix) {
    if (files.length === 0) {
        throw new Error(`No segments matching "${prefix}<number>" found in ${workDir}`);
    }
}

async function merge(opts) {
    if (opts.help) {
        console.log(HELP_TEXT);
        return { help: true };
    }

    const workDir = resolveWorkDir(opts.dir);
    if (!fs.existsSync(workDir) || !fs.statSync(workDir).isDirectory()) {
        throw new Error(`Directory not found: ${workDir}`);
    }
    process.chdir(workDir);

    console.log(`Directory: ${workDir}\n`);

    const files = scanSegments(workDir, opts.prefix);
    validateSegments(files, workDir, opts.prefix);

    console.log(`Found ${files.length} segments (${opts.prefix}${files[0].num} ~ ${opts.prefix}${files[files.length - 1].num})`);

    const skipSet = await resolveSkips(files, workDir, opts);
    const validFiles = files.filter(f => !skipSet.has(f.name));
    const skippedCount = files.length - validFiles.length;

    if (validFiles.length === 0) {
        throw new Error('All segments were skipped, nothing to merge.');
    }

    const sizeMap = segmentSizes(validFiles, workDir);
    let totalSize = 0;
    validFiles.forEach(f => {
        totalSize += sizeMap.get(f.name);
    });

    process.stdout.write(`\nMerging ${validFiles.length} segments (${formatSize(totalSize)})`);
    if (skippedCount > 0) process.stdout.write(` [skipped ${skippedCount}]`);
    console.log('\n');

    const ffmpegPath = findFFmpeg();
    if (!ffmpegPath) {
        throw new Error('ffmpeg not found. Install ffmpeg and add to PATH.');
    }

    const output = uniquifyOutputPath(workDir, opts.output);
    const listPath = listFilePath(workDir);
    const listName = path.basename(listPath);

    const cleanupList = () => {
        if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
    };

    console.log('Step 1/2: Building concat list...');
    const buildUI = new MergerUI(`Listing ${validFiles.length} segment(s)`).start();
    makeConcatList(validFiles, workDir, listName);
    await new Promise(r => setTimeout(r, 250));
    buildUI.stop();
    console.log(`  ${validFiles.length} segment(s) listed`);

    console.log(`\nStep 2/2: Concatenating & packaging to ${output.name}...`);

    const mergeUI = new MergerUI(`  Merging ${validFiles.length} segment(s)`).start(totalSize);

    const success = await runFFmpeg(ffmpegPath, listName, workDir, output.path, {
        totalBytes: totalSize,
        onProgress: payload => mergeUI.handleProgress(payload),
    });

    mergeUI.stop();

    if (!success) {
        cleanupList();
        throw new Error('ffmpeg concatenation failed.');
    }

    console.log(`\nDone: ${output.name} (${formatSize(fs.statSync(output.path).size)})`);

    if (!opts.keepTemp) {
        cleanupList();
    }

    return { output: output.path, name: output.name };
}

module.exports = { merge };
