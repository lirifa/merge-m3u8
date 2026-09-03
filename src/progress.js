const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function isTTY() {
    return Boolean(process.stdout.isTTY) && Boolean(process.stderr.isTTY);
}

/**
 * 合并过程动效。
 *  - 进行中：TTY 下显示旋转 spinner；非 TTY 每 2s 打一个点。
 *  - 收到 ffmpeg -progress 的 out_bytes 后，若有总输入字节数，切换为百分比进度条。
 *  - stop()：一律定格到 100% 并换行。
 */
class MergerUI {
    constructor(text, width = 40) {
        this.text = text;
        this.width = width;
        this.totalBytes = 0;
        this.percent = 0;
        this.frame = 0;
        this.timer = null;
        this.dotInterval = null;
        this.started = false;
        this.enabled = isTTY();
    }

    start(totalBytes = 0) {
        this.totalBytes = totalBytes;
        this.started = true;

        if (!this.enabled) {
            process.stderr.write(`${this.text}...`);
            this.dotInterval = setInterval(() => process.stderr.write('.'), 2000);
            return this;
        }

        this.timer = setInterval(() => {
            this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
            this.renderSpinner();
        }, 80);
        return this;
    }

    handleProgress({ bytes, totalBytes }) {
        if (totalBytes > 0) this.totalBytes = totalBytes;
        if (!this.started || this.totalBytes <= 0) return;
        this.percent = Math.min(1, bytes / this.totalBytes);
        this.renderBar();
    }

    renderSpinner() {
        process.stderr.write(`\r\x1b[2K${SPINNER_FRAMES[this.frame]} ${this.text}`);
    }

    renderBar() {
        if (!this.enabled) return;
        const filled = Math.round(this.percent * this.width);
        const bar = '█'.repeat(filled) + '░'.repeat(this.width - filled);
        const pct = (this.percent * 100).toFixed(1).padStart(6);
        process.stderr.write(`\r\x1b[2K${this.text} [${bar}] ${pct}%`);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        if (this.dotInterval) clearInterval(this.dotInterval);
        this.timer = null;
        this.dotInterval = null;

        if (!this.enabled) {
            process.stderr.write('\n');
        } else {
            this.percent = 1;
            this.renderBar();
            process.stderr.write('\n');
        }
        this.started = false;
    }
}

module.exports = { MergerUI, isTTY };
