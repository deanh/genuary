// get the palette that was defined in CSS
function getCanvasPalette() {
    const palette = {};
    const styles = getComputedStyle(document.documentElement);

    for (const sheet of document.styleSheets) {
        try {
            for (const rule of sheet.cssRules) {
                if (rule.selectorText === ':root') {
                    for (const prop of rule.style) {
                        if (prop.startsWith('--')) {
                            // Convert --dark-blue to darkBlue
                            const camelName = prop.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                            palette[camelName] = styles.getPropertyValue(prop).trim();
                        }
                    }
                }
            }
        } catch (e) {}
    }

    return palette;
}

// hex to RGB
function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// for mapping to a palette given an r,g,b triplet
function findNearestColor(r, g, b, palette) {
    let minDist = Infinity;
    let nearest = palette[0];

    for (const color of palette) {
        const dist = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2;
        if (dist < minDist) {
            minDist = dist;
            nearest = color;
        }
    }

    return nearest;
}

// random!
function randomKernel(size = 3, scale = 2) {
    const kernel = Array.from({ length: size * size }, () => (Math.random() - 0.5) * scale);
    // Normalize so weights sum to 1 to preserve brightness
    const sum = kernel.reduce((a, b) => a + b, 0);
    return sum !== 0 ? kernel.map(v => v / sum) : kernel;
}

let lastEmbossAngle = Math.random() * Math.PI * 2;

function randomEmbossKernel(size = 3) {
    const kernel = [];
    // Random angle for emboss direction
    const angle = Math.random() * 0.3 + lastEmbossAngle;
    const centerX = (size - 1) / 2;
    const centerY = (size - 1) / 2;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Calculate position relative to center
            const dx = x - centerX;
            const dy = y - centerY;
            // Project onto the random angle direction
            const projection = dx * Math.cos(angle) + dy * Math.sin(angle);
            kernel.push(projection * Math.random());
        }
    }

    // Normalize so weights sum to 1 to preserve brightness
    const sum = kernel.reduce((a, b) => a + b, 0);
    lastEmbossAngle = angle;
    return sum !== 0 ? kernel.map(v => v / sum) : kernel;
}

// generate random colors from within a palette
function paletteRandomization(imageData, palette) {
    const { data, width, height } = imageData;
    const output = new Uint8ClampedArray(data.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const color = palette[Math.floor(Math.random() * palette.length)];

            output[i] = color[0];
            output[i+1] = color[1];
            output[i+2] = color[2];
            output[i+3] = 255;
        }
    }
    return new ImageData(output, width, height);
}


function createPaletteMatcher(palette) {
    // Find each color's distance to its nearest neighbor
    const minDistances = palette.map((color, i) => {
        let min = Infinity;
        for (let j = 0; j < palette.length; j++) {
            if (i === j) continue;
            const dr = color[0] - palette[j][0];
            const dg = color[1] - palette[j][1];
            const db = color[2] - palette[j][2];
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (dist < min) min = dist;
        }
        return min;
    });

    // Use inverse of min distance as weight (tightly clustered colors get boosted)
    // Use square root dampening to prevent extreme weights that cause feedback loops
    const maxMinDist = Math.max(...minDistances);
    const weights = minDistances.map(d => Math.sqrt(maxMinDist / d));

    return function findNearest(r, g, b) {
        let minDist = Infinity;
        let nearest = palette[0];

        for (let i = 0; i < palette.length; i++) {
            const color = palette[i];
            const dr = r - color[0];
            const dg = g - color[1];
            const db = b - color[2];

            // Divide distance by weight to give clustered colors a larger "catchment area"
            const dist = (dr * dr + dg * dg + db * db) / weights[i];

            if (dist < minDist) {
                minDist = dist;
                nearest = color;
            }
        }

        return nearest;
    };
}

// apply convolution to image data
function convolve(imageData, kernel, palette = null) {
    const { data, width, height } = imageData;
    const output = new Uint8ClampedArray(data.length);
    const size = Math.sqrt(kernel.length) | 0;
    const half = (size / 2) | 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;

            for (let ky = 0; ky < size; ky++) {
                for (let kx = 0; kx < size; kx++) {
                    const px = Math.min(width - 1, Math.max(0, x + kx - half));
                    const py = Math.min(height - 1, Math.max(0, y + ky - half));
                    const i = (py * width + px) * 4;
                    const weight = kernel[ky * size + kx];
                    r += data[i] * weight;
                    g += data[i + 1] * weight;
                    b += data[i + 2] * weight;
                }
            }

            const i = (y * width + x) * 4;

            if (palette) {
                const nearest = typeof palette === 'function'
                    ? palette(r, g, b)
                    : findNearestColor(r, g, b, palette);

                output[i] = nearest[0];
                output[i + 1] = nearest[1];
                output[i + 2] = nearest[2];
            } else {
                output[i] = r;
                output[i + 1] = g;
                output[i + 2] = b;
            }

            output[i + 3] = data[i + 3];
        }
    }

    return new ImageData(output, width, height);
}


// Animation class definition
class CanvasAnimation {
    constructor(canvasId, width = 320, height = 240, scale = 2) {
        this.scale = scale;
        this.canvas = document.getElementById(canvasId);
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${width * scale}px`;
        this.canvas.style.height = `${height * scale}px`;
        this.ctx = this.canvas.getContext('2d');
        this.isRunning = false;
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 60;
        this.updateCallbacks = [];
        this.drawCallbacks = [];
    }
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
        return this;
    }
    onDraw(callback) {
        this.drawCallbacks.push(callback);
        return this;
    }

    loop(currentTime) {
        if (!this.isRunning) return;
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        for (const callback of this.updateCallbacks) {
            callback(deltaTime, this.frameCount);
        }
        //this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const callback of this.drawCallbacks) {
            callback(this.ctx, this.frameCount);
        }
        this.frameCount++;
        requestAnimationFrame(time => this.loop(time));
    }
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTime = performance.now();
            requestAnimationFrame(time => this.loop(time));
        }
        return this;
    }
    stop() {
        this.isRunning = false;
        return this;
    }
    reset() {
        this.frameCount = 0;
        return this;
    }
}
