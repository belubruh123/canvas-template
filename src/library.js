/** 
 * @file The Best Engine Ever!
 * 
 * @version 0.3
 * @author Jeremy Lin
 * @copyright 2025
 */

/** @type {boolean} Enables debug mode to show mouse position and hover info */
let debug = true;

/** @type {number} Fixed canvas width in pixels */
let canvaX = 1280;

/** @type {number} Fixed canvas height in pixels */
let canvaY = 720;

/** @type {HTMLCanvasElement} The main canvas element */
const canvasEl = document.getElementById('canvasEl');
canvasEl.width = canvaX; // Set drawing buffer width
canvasEl.height = canvaY; // Set drawing buffer height
canvasEl.style.width = canvaX + 'px'; // Set display width
canvasEl.style.height = canvaY + 'px'; // Set display height

/** @type {CanvasRenderingContext2D} The 2D rendering context for the canvas */
const ctx = canvasEl.getContext('2d');

/** @type {HTMLImageElement|null} The background image, if set */
let backgroundImg = null;

/** 
 * The cursor object tracks mouse position and button states.
 * @type {{x: number, y: number, isDown: boolean, left: boolean, right: boolean}}
 */
const cursor = {
    x: 0,
    y: 0,
    isDown: false,
    left: false,
    right: false
};

/** @type {Object.<string, boolean>} Tracks previous keyboard states */
const prevKeys = {};

/**
 * Sets the background image or clears it.
 * @param {string} [src] - The path to the image source. If falsy, clears the background.
 */
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
        document.body.style.backgroundColor = 'black';
    };
    img.src = src;
}

/** @type {HTMLElement} Element displaying mouse position */
const mousePosEl = document.getElementById('mousePos');

/** @type {HTMLElement} Element displaying hover information */
const hoverInfoEl = document.getElementById('hoverInfo');

/** @type {Object.<string, boolean>} Tracks current keyboard states */
const keys = {};

/** @type {Array.<Drawable>} Array of drawable objects (sprites and text) */
const drawables = [];

/**
 * Base class for all drawable objects.
 * @class
 */
class Drawable {
    /**
     * Creates a drawable object.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     */
    constructor(x, y) {
        /** @type {number} X position */
        this.x = x;
        /** @type {number} Y position */
        this.y = y;
        /** @type {boolean} Whether the object is hidden */
        this.hidden = false;
    }

    /**
     * Draws the object on the canvas. To be overridden by subclasses.
     */
    draw() {
        // To be overridden
    }
}

/**
 * Controls everything related to objects on canvas that move.
 * @class
 * @extends Drawable
 */
class Sprite extends Drawable {
    /**
     * Creates a sprite. Use {@link createSprite} for instantiation.
     * @param {number} [x=0] - The starting x-coordinate.
     * @param {number} [y=0] - The starting y-coordinate.
     * @param {string} [color='white'] - The sprite's color.
     * @param {...string} imageSrcs - Optional image sources for costumes.
     */
    constructor(x = 0, y = 0, color = 'white', ...imageSrcs) {
        super(x, y);
        /** @type {string} Sprite color */
        this.color = color;
        /** @type {number} Previous x position */
        this.prevX = this.x;
        /** @type {number} Previous y position */
        this.prevY = this.y;
        /** @type {number} Sprite size in pixels */
        this.size = 30;
        /** @type {number} Movement speed in pixels per frame */
        this.speed = 5;
        /** @type {boolean} Whether sprite is touching a border */
        this.border = false;
        /** @type {Array.<Sprite>} List of sprites currently touching */
        this.touching = [];
        /** @type {Array.<{target: Sprite, callback: Function}>} Touch event callbacks */
        this.touchCallbacks = [];
        /** @type {Set.<Sprite>} Cache for touch-once events */
        this.touchOnceCache = new Set();
        /** @type {Array.<{target: Sprite, callback: Function}>} Touch-once callbacks */
        this.touchOnceCallbacks = [];
        /** @type {Array.<{target: Sprite, callback: Function}>} Touch-end callbacks */
        this.touchEndCallbacks = [];
        /** @type {Array.<HTMLImageElement>} List of costume images */
        this.costumes = [];
        /** @type {number} Index of the current costume */
        this.currentCostume = 0;
        /** @type {Array.<HTMLImageElement>} Loaded costume images */
        this.loadedCostumes = [];
        /** @type {Object.<string, Array.<Function>>} Event listeners */
        this.events = {};
        /** @type {boolean} Use original image size for rendering */
        this.useOriginalSize = true;
        /** @type {number} Scaling factor for size */
        this.scale = 1.0;
        /** @type {Object|null} Control scheme for movement */
        this.controls = null;
        /** @type {number} Gravity effect in pixels per frame */
        this.gravity = 0;
        /** @type {boolean} Whether sprite acts as a hitbox */
        this.hitbox = false;
        /** @type {boolean} Whether the pen is down for drawing */
        this.penDown = false;
        /** @type {Array.<Array.<{x: number, y: number}>>} Array of pen paths */
        this.penTrails = [];
        /** @type {Array.<{x: number, y: number}>|null} Current pen path */
        this.currentPath = null;
        /** @type {string} Pen color */
        this.penColor = this.color;
        /** @type {number} Pen thickness in pixels */
        this.penThickness = 1;

        for (const src of imageSrcs) {
            const img = new Image();
            img.onload = () => this.loadedCostumes.push(img);
            img.onerror = () => console.warn(`Failed to load image: ${src}`);
            img.src = src;
            this.costumes.push(img);
        }
    }

    /**
     * Updates the sprite state. Override in specific sprites.
     */
    update() {
        // Default does nothing
    }

    /**
     * Registers an event listener.
     * @param {string} eventName - The event name.
     * @param {Function} callback - The callback function.
     */
    on(eventName, callback) {
        if (!this.events[eventName]) this.events[eventName] = [];
        this.events[eventName].push(callback);
    }

    /**
     * Registers a callback for continuous touch with a target.
     * @param {Sprite} target - The sprite to check for touching.
     * @param {Function} callback - The callback to execute on touch.
     */
    onTouch(target, callback) {
        this.touchCallbacks.push({ target, callback });
    }

    /**
     * Registers a callback for a single touch event with a target.
     * @param {Sprite} target - The sprite to check for touching.
     * @param {Function} callback - The callback to execute once on touch.
     */
    onTouchOnce(target, callback) {
        this.touchOnceCallbacks.push({ target, callback });
    }

    /**
     * Registers a callback when touch with a target ends.
     * @param {Sprite} target - The sprite to check for touch ending.
     * @param {Function} callback - The callback to execute on touch end.
     */
    onTouchEnd(target, callback) {
        this.touchEndCallbacks.push({ target, callback });
    }

    /**
     * Starts drawing a pen trail at the current position.
     */
    startDrawing() {
        if (!this.penDown) {
            this.penDown = true;
        }
        if (this.penDown) {
            this.currentPath = [{ x: this.x, y: this.y }];
            this.penTrails.push(this.currentPath);
        }
    }

    /**
     * Sets the sprite’s position.
     * @param {number} x - The new x-coordinate.
     * @param {number} y - The new y-coordinate.
     */
    goTo(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Stops drawing the pen trail.
     */
    stopDrawing() {
        this.penDown = false;
    }

    /**
     * Clears all pen trails for this sprite.
     */
    clearPen() {
        this.penTrails = [];
        if (this.penDown) {this.startDrawing()}
    }

    /**
     * Triggers all callbacks for an event.
     * @param {string} eventName - The event name.
     * @param {Object} eventObject - The event data.
     */
    trigger(eventName, eventObject) {
        if (this.events[eventName]) {
            for (const cb of this.events[eventName]) {
                cb(eventObject);
            }
        }
    }

    /**
     * Checks if the sprite is clicked at the given coordinates.
     * @param {number} mouseX - The mouse x-coordinate.
     * @param {number} mouseY - The mouse y-coordinate.
     * @returns {boolean} True if clicked within the sprite’s bounds.
     */
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

    /**
     * Checks if this sprite is touching another sprite.
     * @param {Sprite} other - The other sprite to check collision with.
     * @returns {boolean} True if the sprites are touching.
     */
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

    /**
     * Draws the sprite on the canvas.
     */
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

    /**
     * Sets the current costume by index.
     * @param {number} index - The costume index.
     */
    setCostume(index) {
        if (index >= 0 && index < this.costumes.length) this.currentCostume = index;
    }

    /**
     * Checks if the sprite is hovered at the given coordinates.
     * @param {number} mx - The mouse x-coordinate.
     * @param {number} my - The mouse y-coordinate.
     * @returns {boolean} True if the mouse is over the sprite.
     */
    isHovered(mx, my) {
        return this.isClicked(mx, my);
    }

    /**
     * Sets the control scheme for the sprite.
     * @param {Object} scheme - The control scheme object.
     */
    setControlScheme(scheme) {
        this.controls = scheme;
    }

    /**
     * Gets the sprite’s collision size.
     * @returns {{width: number, height: number}} The collision dimensions.
     */
    getCollisionSize() {
        const img = this.costumes[this.currentCostume];
        if (this.useOriginalSize && img && img.complete && img.naturalWidth > 0) {
            return { width: img.naturalWidth * this.scale, height: img.naturalHeight * this.scale };
        }
        return { width: this.size, height: this.size };
    }

    /**
     * Checks if the sprite is on the ground (touching a hitbox).
     * @returns {boolean} True if touching a hitbox sprite.
     */
    isOnGround() {
        return this.touching.some(s => s.hitbox);
    }
}

/**
 * Creates text objects to display on the canvas.
 * @class
 * @extends Drawable
 */
class Text extends Drawable {
    /**
     * Creates a text object. Use {@link createText} for instantiation.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @param {string} color - The text color.
     * @param {string} text - The text content.
     * @param {string} [font="20px monospace"] - The font style.
     * @param {boolean} [doCenter=false] - Whether to center the text horizontally.
     */
    constructor(x, y, color, text, font = "20px monospace", doCenter = false) {
        super(x, y);
        /** @type {string} Text color */
        this.color = color;
        /** @type {string} Text content */
        this.text = text;
        /** @type {string} Font style */
        this.font = font;
        /** @type {boolean} Whether to center the text horizontally */
        this.doCenter = doCenter;
    }

    /**
     * Draws the text on the canvas.
     */
    draw() {
        if (this.hidden) return;
        ctx.fillStyle = this.color;
        ctx.font = this.font;
        let x = this.x;
        if (this.doCenter) {
            const textWidth = ctx.measureText(this.text).width;
            x = (canvaX - textWidth) / 2; // Center horizontally based on canvas width
        }
        ctx.fillText(this.text, x, this.y);
    }
}

/**
 * Creates a new text object and adds it to drawables.
 * @param {number} x - The x-coordinate.
 * @param {number} y - The y-coordinate.
 * @param {string} color - The text color.
 * @param {string} text - The text content.
 * @param {string} [font="20px monospace"] - The font style.
 * @param {boolean} [doCenter=false] - Whether to center the text horizontally.
 * @returns {Text} The created text object.
 */
function createText(x, y, color, text, font = "20px monospace", doCenter = false) {
    const textObj = new Text(x, y, color, text, font, doCenter);
    drawables.push(textObj);
    return textObj;
}

/**
 * Hides a drawable object.
 * @param {Drawable} object - The object to hide.
 */
function hide(object) {
    object.hidden = true;
}

/**
 * Shows a drawable object.
 * @param {Drawable} object - The object to show.
 */
function show(object) {
    object.hidden = false;
}

/**
 * Checks if two polygons intersect using SAT.
 * @param {Array.<{x: number, y: number}>} poly1 - First polygon vertices.
 * @param {Array.<{x: number, y: number}>} poly2 - Second polygon vertices.
 * @returns {boolean} True if the polygons intersect.
 */
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

/**
 * Generates a hitbox polygon from an image’s edge pixels.
 * @param {HTMLImageElement} image - The source image.
 * @param {number} [alphaThreshold=10] - Alpha value to detect edges.
 * @returns {Array.<{x: number, y: number}>} The hitbox polygon vertices.
 */
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

/**
 * Computes the convex hull of a set of points using Graham Scan.
 * @param {Array.<{x: number, y: number}>} points - The input points.
 * @returns {Array.<{x: number, y: number}>} The convex hull vertices.
 */
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

/**
 * Computes the cross product for three points.
 * @param {{x: number, y: number}} o - Origin point.
 * @param {{x: number, y: number}} a - First point.
 * @param {{x: number, y: number}} b - Second point.
 * @returns {number} The cross product value.
 */
function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Generates and assigns a hitbox for a sprite’s current costume.
 * @param {Sprite} sprite - The sprite to generate a hitbox for.
 * @param {number} [alphaThreshold=10] - Alpha value to detect edges.
 */
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

/**
 * The main game loop, handling updates and rendering.
 */
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

/**
 * Sets up keyboard event listeners.
 */
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

/**
 * Handles mouse movement and updates debug info.
 */
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

/**
 * Handles mouse clicks and triggers sprite events.
 */
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

/**
 * Tracks mouse button presses.
 */
canvasEl.addEventListener('mousedown', (e) => {
    cursor.isDown = true;
    if (e.button === 0) cursor.left = true;
    if (e.button === 2) cursor.right = true;
});

/**
 * Tracks mouse button releases.
 */
canvasEl.addEventListener('mouseup', (e) => {
    if (e.button === 0) cursor.left = false;
    if (e.button === 2) cursor.right = false;
    if (!cursor.left && !cursor.right) cursor.isDown = false;
});

/**
 * Prevents the context menu on right-click.
 */
canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

/**
 * Starts the game loop.
 */
setTimeout(() => {
    gameLoop();
}, 0);