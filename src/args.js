const HELP_TEXT = `
merge-m3u8 - Merge IDM download segments into MP4

Usage:
  m-m3u8 [directory] [options]

Options:
  -o, --output <file>     Output filename (default: output.mp4)
  -p, --prefix <prefix>   Segment file prefix (default: video.m3u8)
  -a, --auto              Auto-skip broken segments (size < threshold)
  -t, --threshold <MB>    Auto-skip threshold in MB (default: 0.1)
  -s, --skip <list>       Comma-separated segment numbers to skip (e.g. 1922,1923)
  -k, --keep-temp         Keep intermediate concat list file
  -h, --help              Show this help

Examples:
  m-m3u8                          # Use current directory
  m-m3u8 "D:\\Downloads\\video"   # Specify directory
  m-m3u8 -a                      # Auto mode, skip broken segments
  m-m3u8 -a -o my-video.mp4      # Auto mode with custom output name
  m-m3u8 -p "clip.m3u8"          # Custom segment prefix
  m-m3u8 -s 1922,1923,1924       # Skip specific segments
`;

const DEFAULTS = {
    dir: null,
    output: 'output.mp4',
    prefix: 'video.m3u8',
    auto: false,
    threshold: 0.1,
    skip: [],
    keepTemp: false,
    help: false,
};

function parseArgs(argv = process.argv.slice(2)) {
    const opts = { ...DEFAULTS };
    let positionalIndex = 0;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '-h': case '--help':
                opts.help = true;
                break;
            case '-o': case '--output':
                opts.output = argv[++i];
                break;
            case '-p': case '--prefix':
                opts.prefix = argv[++i];
                break;
            case '-a': case '--auto':
                opts.auto = true;
                break;
            case '-t': case '--threshold':
                opts.threshold = parseFloat(argv[++i]);
                break;
            case '-s': case '--skip':
                opts.skip = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
                break;
            case '-k': case '--keep-temp':
                opts.keepTemp = true;
                break;
            default:
                if (positionalIndex === 0 && !arg.startsWith('-')) {
                    opts.dir = arg;
                }
                positionalIndex++;
                break;
        }
    }

    return opts;
}

module.exports = { parseArgs, HELP_TEXT, DEFAULTS };
