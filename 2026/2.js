// Demo animation setup
let width = 240;
let height = 160;
let animation = new CanvasAnimation('display', width, height, 4);

const palette = Object.values(getCanvasPalette());
// Filter to unique colors to avoid duplicate color issues in weight calculation
const uniquePalette = [...new Set(palette)];
console.log('Unique colors:', uniquePalette.length);
const uniqueHexPalette = uniquePalette.map(hexToRgb)
const rgbPalette = createPaletteMatcher(uniqueHexPalette);
// Log to see what colors map where
window.testColor = (hex) => {
    const [r,g,b] = hexToRgb(hex);
    const result = rgbPalette(r,g,b);
    const resultHex = '#' + result.map(v => v.toString(16).padStart(2,'0')).join('');
    console.log(`${hex} -> ${resultHex}`, result);
};


let imageData;

if (Math.random() < 0.8) {
    let sections = [];
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 2; col++) {
            let data = {
                x: row * 40,
                y: col * 80,
                w: 40,
                h: 80,
                color: palette.shift()
            };
            sections.push(data);
        }
    }

    sections.forEach(section => {
        animation.ctx.beginPath();
        animation.ctx.rect(section.x, section.y, section.w, section.h);
        animation.ctx.fillStyle = section.color;
        animation.ctx.fill();
    });
    imageData = animation.ctx.getImageData(0, 0, width, height);
} else {
    imageData = paletteRandomization(animation.ctx.getImageData(0, 0, width, height), uniqueHexPalette);
}

let count = 0;

animation.onDraw((ctx, frame) => {
    if (Math.random() < 1 && count % 20 == 0) {
        let filter;
        let last;
        if (Math.random() < 0.1) {
            // blur
            filter = [
                1 / 9, 1 / 9, 1 / 9,
                1 / 9, 1 / 9, 1 / 9,
                1 / 9, 1 / 9, 1 / 9
            ];
            //
        } else if (Math.random() < 0.5) {
            // sharpen
            filter = [
                0, -1, 0,
                -1, 5, -1,
                0, -1, 0
            ];
        } else {
            let embossSize = 2 * Math.floor(Math.random() *(count % 11)) + 5;
            console.log(embossSize);
            filter = randomEmbossKernel(embossSize);
        }
        if (Math.random() < 0.6) {
            imageData = convolve(imageData, filter, rgbPalette);
            ctx.putImageData(imageData, 0, 0);
        } else {
            imageData = convolve(imageData, filter, rgbPalette);
            ctx.putImageData(imageData, 0, 0);
        }
    }
    count++;
});

for (let k in palette) {
    console.log(`${palette[k]}`);
}
// Start animation automatically
animation.start();
