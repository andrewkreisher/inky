import { INTERPOLATION_DELAY_MS } from '../constants';

const MAX_SAMPLES = 32;

/**
 * Buffers timestamped positions from server snapshots and returns a position
 * `INTERPOLATION_DELAY_MS` in the past, linearly interpolated between the two
 * bracketing samples. Timestamps are local receive times, so no clock sync is
 * needed. Never extrapolates: if we're past the newest sample we hold it.
 */
export class Interpolator {
    constructor(delay = INTERPOLATION_DELAY_MS) {
        this.delay = delay;
        this.samples = [];
    }

    push(x, y, t) {
        this.samples.push({ x, y, t });
        if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    }

    /** Replace history (teleports such as respawns). */
    reset(x, y, t) {
        this.samples.length = 0;
        this.push(x, y, t);
    }

    get latest() {
        return this.samples[this.samples.length - 1] || null;
    }

    sample(now) {
        const s = this.samples;
        if (s.length === 0) return null;
        const renderT = now - this.delay;

        if (renderT >= s[s.length - 1].t) return s[s.length - 1];
        if (renderT <= s[0].t) return s[0];

        // Find the pair bracketing renderT (search from the end; it's usually near).
        for (let i = s.length - 1; i > 0; i--) {
            const a = s[i - 1];
            const b = s[i];
            if (a.t <= renderT && renderT <= b.t) {
                const span = b.t - a.t;
                const f = span > 0 ? (renderT - a.t) / span : 1;
                return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
            }
        }
        return s[s.length - 1];
    }
}
