const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { spawn } = require('child_process');

function findFFmpeg() {
    const isWin = os.platform() === 'win32';
    const binary = isWin ? 'ffmpeg.exe' : 'ffmpeg';
    const envPath = process.env.PATH || '';

    for (const p of envPath.split(path.delimiter)) {
        const candidate = path.join(p, binary);
        if (fs.existsSync(candidate)) return candidate;
    }

    const candidates = [];
    if (isWin) {
        candidates.push(
            'C:\\ffmpeg\\bin\\ffmpeg.exe',
            'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
            'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
            path.join(os.homedir(), 'ffmpeg', 'bin', 'ffmpeg.exe'),
            path.join(os.homedir(), 'scoop', 'apps', 'ffmpeg', 'current', 'bin', 'ffmpeg.exe')
        );
    } else if (os.platform() === 'darwin') {
        candidates.push(
            '/opt/homebrew/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            '/usr/bin/ffmpeg'
        );
    } else {
        candidates.push(
            '/usr/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            '/snap/bin/ffmpeg'
        );
    }

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function makeConcatList(files, dir, listFile) {
    const lines = files.map(f => `file '${f.name.replace(/(['\\])/g, '\\$1')}'`);
    fs.writeFileSync(path.join(dir, listFile), lines.join('\n') + '\n', 'utf8');
}

function probeDuration(ffprobePath, listFile, listDir) {
    return new Promise((resolve) => {
        const listPath = path.join(listDir, listFile);
        const args = [
            '-v', 'error',
            '-print_format', 'json',
            '-show_entries', 'format=duration',
            '-f', 'concat',
            '-safe', '0',
            '-i', listPath,
        ];
        const proc = spawn(ffprobePath, args, { stdio: ['ignore', 'pipe', 'ignore'] });
        let out = '';
        proc.stdout.on('data', d => { out += d; });
        proc.on('close', () => {
            try {
                const json = JSON.parse(out);
                const sec = parseFloat(json.format && json.format.duration);
                resolve(Number.isFinite(sec) ? sec * 1e6 : 0);
            } catch (_) {
                resolve(0);
            }
        });
        proc.on('error', () => resolve(0));
    });
}

function findFFprobe(ffmpegPath) {
    if (!ffmpegPath) return null;
    const dir = path.dirname(ffmpegPath);
    const ext = path.extname(ffmpegPath);
    const candidate = path.join(dir, `ffprobe${ext}`);
    return fs.existsSync(candidate) ? candidate : null;
}

function runFFmpeg(ffmpegPath, listFile, listDir, output, { onProgress, totalBytes = 0 } = {}) {
    return new Promise((resolve) => {
        const listPath = path.join(listDir, listFile);
        const args = [
            '-hide_banner',
            '-nostats',
            '-loglevel', 'warning',
            '-f', 'concat',
            '-safe', '0',
            '-i', listPath,
            '-c', 'copy',
            '-bsf:a', 'aac_adtstoasc',
            '-movflags', '+faststart',
            '-progress', 'pipe:1',
            '-y',
            output,
        ];
        const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'inherit'] });

        if (onProgress) {
            readline.createInterface({ input: proc.stdout }).on('line', line => {
                const idx = line.indexOf('=');
                if (idx === -1) return;
                const key = line.slice(0, idx);
                const value = line.slice(idx + 1);
                if (key === 'progress') return;
                if (key === 'out_bytes') {
                    const bytes = parseInt(value, 10) || 0;
                    onProgress({ bytes, totalBytes });
                }
            });
        } else {
            proc.stdout.resume();
        }

        proc.on('close', code => resolve(code === 0));
        proc.on('error', () => resolve(false));
    });
}

module.exports = { findFFmpeg, findFFprobe, runFFmpeg, makeConcatList, probeDuration };
