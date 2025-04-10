/** 
 * @file The Best Engine Ever!
 * 
 * @version 0.3
 * @author Jeremy Lin
 * @copyright 2025
 */

let debug = true;
let canvaX = 1280; // Global variable for fixed canvas width
let canvaY = 720; // Global variable for fixed canvas height
const canvasEl = document.getElementById('canvasEl');
canvasEl.style.width = canvaX + 'px';
canvasEl.style.height = canvaY + 'px';
const ctx = canvasEl.getContext('2d');

let backgroundImg = null;

/** 
 * The above code is defining an object named `cursor` with properties `x`, `y`, `isDown`, `left`,
 * and `right`. The `x` and `y` properties are initialized to 0, `isDown` is initialized to false,
 * and `left` and `right` are initialized to false as well. This object can be used to store and 
 * be accessed with cursor.x for example.
 */
const cursor = {
    x: 0,
    y: 0,
    isDown: false,
    left: false,
    right: false
};

// Track previous key states
const prevKeys = {};

function setBackground(src) {
    if (!src) {
        backgroundImg = null;
        document.body.style.backgroundColor = 'black';
        return;
    }

    const img = new Image();
    img.onload = () => {
        backgroundImg = img;
        document.body.style.backgroundColor = '';
    };
    img.onerror = () => {
        console.warn(`Failed to load background image: ${src}`);
        backgroundImg = null;
        document.body.style.backgroundColor = 'white';
    };
    img.src = src;
}

const mousePosEl = document.getElementById('mousePos');
const hoverInfoEl = document.getElementById('hoverInfo');

const keys = {};
const drawables = []; // Holds both sprites and text

// Base class for all drawable objects
class Drawable {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hidden = false;
    }

    draw() {
        // To be overridden by subclasses
    }
}

// Sprite class, inheriting from Drawable
class Sprite extends Drawable {
    constructor(x = 0, y = 0, color = 'white', ...imageSrcs) {
        super(x, y);
        this.color = color;
        this.prevX = this.x;
        this.prevY = this.y;
        this.size = 30;
        this.speed = 5;
        this.border = false;
        this.touching = [];
        this.touchCallbacks = [];
        this.touchOnceCache = new Set();
        this.touchOnceCallbacks = [];
        this.touchEndCallbacks = [];
        this.costumes = [];
        this.currentCostume = 0;
        this.loadedCostumes = [];
        this.events = {};
        this.useOriginalSize = true;
        this.scale = 1.0; // New scale property, defaults to 100%
        this.controls = null;
        this.gravity = 0;
        this.hitbox = false;
        this.penDown = false;          // Tracks if the pen is down
        this.penTrails = [];           // Array of paths
        this.currentPath = null;       // Current path being drawn
        this.penColor = this.color;    // Pen color, defaults to sprite's color
        this.penThickness = 1;

        for (const src of imageSrcs) {
            const img = new Image();
            img.onload = () => this.loadedCostumes.push(img);
            img.onerror = () => console.warn(`Failed to load image: ${src}`);
            img.src = src;
            this.costumes.push(img);
        }
    }

    update() {
        // Default does nothing; override in specific sprites as needed
    }

    on(eventName, callback) {
        if (!this.events[eventName]) this.events[eventName] = [];
        this.events[eventName].push(callback);
    }

    onTouch(target, callback) {
        this.touchCallbacks.push({ target, callback });
    }

    onTouchOnce(target, callback) {
        this.touchOnceCallbacks.push({ target, callback });
    }

    onTouchEnd(target, callback) {
        this.touchEndCallbacks.push({ target, callback });
    }

    startDrawing() {
        if (!this.penDown) {
            this.penDown = true;
            this.currentPath = [{ x: this.x, y: this.y }];
            this.penTrails.push(this.currentPath);
        }
    }

    goTo(x, y) {
        this.x = x;
        this.y = y;
    }

    stopDrawing() {
        this.penDown = false;
        this.currentPath = null;
    }

    clearPen() {
        this.penTrails = [];
        this.currentPath = null;
    }

    trigger(eventName, eventObject) {
        if (this.events[eventName]) {
            for (const cb of this.events[eventName]) {
                cb(eventObject);
            }
        }
    }

    isClicked(mouseX, mouseY) {
        const size = this.getCollisionSize();
        const w = size.width;
        const h = size.height;
        return (
            mouseX >= this.x - w / 2 &&
            mouseX <= this.x + w / 2 &&
            mouseY >= this.y - h / 2 &&
            mouseY <= this.y + h / 2
        );
    }

    isTouching(other) {
        if (this.hitboxPolygon && other.hitboxPolygon) {
            const poly1 = this.hitboxPolygon.map(vertex => ({
                x: vertex.x * this.scale + this.x,
                y: vertex.y * this.scale + this.y
            }));
            const poly2 = other.hitboxPolygon.map(vertex => ({
                x: vertex.x * other.scale + other.x,
                y: vertex.y * other.scale + other.y
            }));
            return polygonsIntersect(poly1, poly2);
        }
        const a = this.getCollisionSize();
        const b = other.getCollisionSize();
        return (
            Math.abs(this.x - other.x) < (a.width + b.width) / 2 &&
            Math.abs(this.y - other.y) < (a.height + b.height) / 2
        );
    }

    draw() {
        if (this.hidden) return;
        const img = this.costumes[this.currentCostume];
        if (img && img.complete && img.naturalWidth > 0) {
            let w, h;
            if (this.useOriginalSize) {
                w = img.naturalWidth * this.scale;
                h = img.naturalHeight * this.scale;
            } else {
                w = this.size;
                h = this.size;
            }
            ctx.drawImage(img, this.x - w / 2, this.y - h / 2, w, h);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        }
    }

    setCostume(index) {
        if (index >= 0 && index < this.costumes.length) this.currentCostume = index;
    }

    isHovered(mx, my) {
        return this.isClicked(mx, my);
    }

    setControlScheme(scheme) {
        this.controls = scheme;
    }

    getCollisionSize() {
        const img = this.costumes[this.currentCostume];
        if (this.useOriginalSize && img && img.complete && img.naturalWidth > 0) {
            return { width: img.naturalWidth * this.scale, height: img.naturalHeight * this.scale };
        }
        return { width: this.size, height: this.size };
    }

    isOnGround() {
        return this.touching.some(s => s.hitbox);
    }
}

class Text extends Drawable {
    constructor(x, y, color, text, font = "20px monospace") {
        super(x, y);
        this.color = color;
        this.text = text;
        this.font = font;
    }

    draw() {
        if (this.hidden) return;
        ctx.fillStyle = this.color;
        ctx.font = this.font;
        ctx.fillText(this.text, this.x, this.y);
    }
}

function createSprite(x = 0, y = 0, color = 'white', ...imageSrcs) {
    const sprite = new Sprite(x, y, color, ...imageSrcs);
    sprite.prevX = x;
    sprite.prevY = y;
    drawables.push(sprite);
    return sprite;
}

function createText(x, y, color, text, font = "20px monospace") {
    const textObj = new Text(x, y, color, text, font);
    drawables.push(textObj);
    return textObj;
}

function hide(object) {
    object.hidden = true;
}

function polygonsIntersect(poly1, poly2) {
    function getAxes(polygon) {
        const axes = [];
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
            const normal = { x: -edge.y, y: edge.x };
            const length = Math.hypot(normal.x, normal.y);
            axes.push({ x: normal.x / length, y: normal.y / length });
        }
        return axes;
    }

    function project(polygon, axis) {
        let min = Infinity, max = -Infinity;
        polygon.forEach(point => {
            const proj = point.x * axis.x + point.y * axis.y;
            min = Math.min(min, proj);
            max = Math.max(max, proj);
        });
        return { min, max };
    }

    function overlap(proj1, proj2) {
        return proj1.max >= proj2.min && proj2.max >= proj1.min;
    }

    const axes1 = getAxes(poly1);
    const axes2 = getAxes(poly2);
    const axes = axes1.concat(axes2);
    for (const axis of axes) {
        const proj1 = project(poly1, axis);
        const proj2 = project(poly2, axis);
        if (!overlap(proj1, proj2)) return false;
    }
    return true;
}

function generateHitboxFromImage(image, alphaThreshold = 10) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = image.naturalWidth;
    offCanvas.height = image.naturalHeight;
    const offCtx = offCanvas.getContext('2d');
    offCtx.drawImage(image, 0, 0);
    const imageData = offCtx.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
    const data = imageData.data;

    const points = [];
    for (let y = 0; y < image.naturalHeight; y++) {
        for (let x = 0; x < image.naturalWidth; x++) {
            const index = (y * image.naturalWidth + x) * 4;
            const alpha = data[index + 3];
            if (alpha > alphaThreshold) {
                let isEdge = false;
                for (let ny = -1; ny <= 1 && !isEdge; ny++) {
                    for (let nx = -1; nx <= 1; nx++) {
                        const x2 = x + nx;
                        const y2 = y + ny;
                        if (x2 < 0 || x2 >= image.naturalWidth || y2 < 0 || y2 >= image.naturalHeight) {
                            isEdge = true;
                            break;
                        }
                        const index2 = (y2 * image.naturalWidth + x2) * 4;
                        const neighborAlpha = data[index2 + 3];
                        if (neighborAlpha <= alphaThreshold) {
                            isEdge = true;
                            break;
                        }
                    }
                }
                if (isEdge) {
                    points.push({ x, y });
                }
            }
        }
    }

    const hull = convexHull(points);
    return hull;
}

function convexHull(points) {
    if (points.length < 3) return points;

    let start = points[0];
    for (const point of points) {
        if (point.y < start.y || (point.y === start.y && point.x < start.x)) {
            start = point;
        }
    }

    const sorted = points.slice().sort((a, b) => {
        const angleA = Math.atan2(a.y - start.y, a.x - start.x);
        const angleB = Math.atan2(b.y - start.y, b.x - start.x);
        return angleA - angleB;
    });

    const hull = [];
    for (const point of sorted) {
        while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
            hull.pop();
        }
        hull.push(point);
    }
    return hull;
}

function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function autoGenerateHitbox(sprite, alphaThreshold = 10) {
    const img = sprite.costumes[sprite.currentCostume];
    if (img && img.complete && img.naturalWidth > 0) {
        const polygon = generateHitboxFromImage(img, alphaThreshold);
        sprite.hitboxPolygon = polygon.map(pt => ({
            x: pt.x - img.naturalWidth / 2,
            y: pt.y - img.naturalHeight / 2
        }));
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // Draw background
    if (backgroundImg) {
        ctx.drawImage(backgroundImg, 0, 0, canvasEl.width, canvasEl.height);
    } else {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    }

    // Handle movement and collisions for all sprites
    for (const sprite of drawables.filter(obj => obj instanceof Sprite)) {
        let dx = 0;
        let dy = 0;

        if (sprite.controls) {
            if (keys[sprite.controls.left]) dx -= sprite.speed;
            if (keys[sprite.controls.right]) dx += sprite.speed;
            if (keys[sprite.controls.up]) dy -= sprite.speed;
            if (keys[sprite.controls.down]) dy += sprite.speed;
        }

        if (sprite.gravity) {
            dy += sprite.gravity;
        }

        if (dx !== 0) {
            sprite.x += dx;
            for (const other of drawables.filter(obj => obj instanceof Sprite && obj.hitbox && obj !== sprite)) {
                if (sprite.isTouching(other)) {
                    const a = sprite.getCollisionSize();
                    const b = other.getCollisionSize();
                    if (dx > 0) {
                        sprite.x = other.x - b.width / 2 - a.width / 2;
                    } else if (dx < 0) {
                        sprite.x = other.x + b.width / 2 + a.width / 2;
                    }
                }
            }
        }

        if (dy !== 0) {
            sprite.y += dy;
            for (const other of drawables.filter(obj => obj instanceof Sprite && obj.hitbox && obj !== sprite)) {
                if (sprite.isTouching(other)) {
                    const a = sprite.getCollisionSize();
                    const b = other.getCollisionSize();
                    if (dy > 0) {
                        sprite.y = other.y - b.height / 2 - a.height / 2;
                    } else if (dy < 0) {
                        sprite.y = other.y + b.height / 2 + a.height / 2;
                    }
                }
            }
        }

        if (sprite.penDown && sprite.currentPath) {
            const lastPoint = sprite.currentPath[sprite.currentPath.length - 1];
            if (lastPoint.x !== sprite.x || lastPoint.y !== sprite.y) {
                sprite.currentPath.push({ x: sprite.x, y: sprite.y });
            }
        }

        const size = sprite.getCollisionSize();
        const w = size.width;
        const h = size.height;
        sprite.border = false;
        if (sprite.x - w / 2 < 0) { sprite.x = w / 2; sprite.border = true; }
        if (sprite.y - h / 2 < 0) { sprite.y = h / 2; sprite.border = true; }
        if (sprite.x + w / 2 > canvasEl.width) { sprite.x = canvasEl.width - w / 2; sprite.border = true; }
        if (sprite.y + h / 2 > canvasEl.height) { sprite.y = canvasEl.height - h / 2; sprite.border = true; }

        sprite.update();
    }

    const collisionSprites = drawables.filter(obj => obj instanceof Sprite);
    for (const sprite of collisionSprites) {
        const prevTouching = new Set(sprite.touching);
        sprite.touching = collisionSprites.filter(other => other !== sprite && sprite.isTouching(other));
        for (const { target, callback } of sprite.touchCallbacks) {
            sprite.touching.filter(s => s === target).forEach(() => callback());
        }
        for (const { target, callback } of sprite.touchOnceCallbacks) {
            sprite.touching.filter(s => s === target && !sprite.touchOnceCache.has(s)).forEach(t => {
                callback();
                sprite.touchOnceCache.add(t);
            });
        }
        for (const { target, callback } of sprite.touchEndCallbacks) {
            prevTouching.forEach(t => {
                if (t === target && !sprite.touching.includes(t)) {
                    callback();
                    sprite.touchOnceCache.delete(t);
                }
            });
        }
    }

    for (const sprite of drawables.filter(obj => obj instanceof Sprite)) {
        for (const path of sprite.penTrails) {
            if (path.length > 1) {
                ctx.beginPath();
                ctx.moveTo(path[0].x, path[0].y);
                for (let i = 1; i < path.length; i++) {
                    ctx.lineTo(path[i].x, path[i].y);
                }
                ctx.strokeStyle = sprite.penColor;
                ctx.lineWidth = sprite.penThickness;
                ctx.stroke();
            }
        }
    }

    for (const obj of drawables) {
        obj.draw();
    }

    requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

canvasEl.addEventListener('mousemove', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    cursor.x = mouseX;
    cursor.y = mouseY;

    if (debug) {
        let hovered = null;
        for (const obj of drawables) {
            if (obj instanceof Sprite && obj.isHovered(mouseX, mouseY)) {
                hovered = obj;
                break;
            }
        }
        mousePosEl.textContent = `x: ${Math.floor(mouseX)}, y: ${Math.floor(mouseY)}${hovered ? ' (hovering: ' + (hovered.name || 'Unnamed') + ')' : ''}`;
        if (hovered) {
            ctx.font = '12px monospace';
            ctx.fillStyle = 'white';
            ctx.fillText(hovered.name || 'Unnamed', hovered.x + hovered.getCollisionSize().width / 2 + 4, hovered.y - hovered.getCollisionSize().height / 2 - 4);
        }
        mousePosEl.style.display = 'block';
        hoverInfoEl.style.display = 'block';
        if (hovered) {
            hoverInfoEl.textContent = Object.entries(hovered)
                .filter(([key, val]) => typeof val !== 'function')
                .map(([key, val]) => {
                    if (Array.isArray(val)) return `${key}: [${val.length}]`;
                    if (val instanceof Set) return `${key}: Set(${val.size})`;
                    if (typeof val === 'object' && val !== null) return `${key}: {object}`;
                    return `${key}: ${val}`;
                }).join("\n");
        } else {
            hoverInfoEl.textContent = '';
        }
    } else {
        mousePosEl.style.display = 'none';
        hoverInfoEl.style.display = 'none';
    }
});

canvasEl.addEventListener('click', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    for (const obj of drawables) {
        if (obj instanceof Sprite && obj.isClicked(mouseX, mouseY)) {
            obj.trigger("click", e);
        }
    }
});

canvasEl.addEventListener('mousedown', (e) => {
    cursor.isDown = true;
    if (e.button === 0) cursor.left = true;
    if (e.button === 2) cursor.right = true;
});

canvasEl.addEventListener('mouseup', (e) => {
    if (e.button === 0) cursor.left = false;
    if (e.button === 2) cursor.right = false;
    if (!cursor.left && !cursor.right) cursor.isDown = false;
});

canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

setTimeout(() => {
    gameLoop();
}, 0);