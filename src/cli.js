#!/usr/bin/env node

const { parseArgs } = require('./args');
const { merge } = require('./run');

const opts = parseArgs();

merge(opts).catch(err => {
    console.error(`\nError: ${err.message || err}`);
    process.exit(1);
});
