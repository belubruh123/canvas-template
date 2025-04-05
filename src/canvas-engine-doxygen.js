/**
 * @file mgb_canvas_engine.js
 * @brief API documentation for the MGB Canvas Engine.
 *
 * This file implements the MGB Canvas Engine which provides functionality
 * for drawing, sprite management, collision detection, and event handling
 * using the HTML5 Canvas.
 */

/** Debug mode flag */
let debug = true;

/** HTML canvas element */
const canvasEl = document.getElementById('canvasEl');

/** 2D rendering context for the canvas */
const ctx = canvasEl.getContext('2d');

/** Background image used for rendering the canvas */
let backgroundImg = null;

/**
 * @brief Object representing the state of the cursor.
 */
const cursor = {
  x: 0,
  y: 0,
  isDown: false,
  left: false,
  right: false
};

/** Tracks previous key states */
const prevKeys = {};

/**
 * @brief Sets the background image of the document.
 *
 * If the source is not provided or loading fails, the background will be set to black.
 * @param src The URL of the background image.
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

/** 
 * @brief HTML element to display the mouse position.
 */
const mousePosEl = document.getElementById('mousePos');

/**
 * @brief HTML element to display hover information.
 */
const hoverInfoEl = document.getElementById('hoverInfo');

/**
 * @brief Object for tracking key states.
 */
const keys = {};

/**
 * @brief Array that holds all drawable objects (sprites and text).
 */
const drawables = [];

/**
 * @class Drawable
 * @brief Base class for all drawable objects on the canvas.
 */
class Drawable {
  /**
   * @brief Constructs a new Drawable.
   * @param x The initial x-coordinate.
   * @param y The initial y-coordinate.
   */
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.hidden = false;
  }

  /**
   * @brief Draws the object.
   *
   * This method should be overridden by subclasses.
   */
  draw() {
    // To be overridden by subclasses
  }
}

/**
 * @class Sprite
 * @brief Represents a sprite with image costumes, collision detection, and event handling.
 * @extends Drawable
 */
class Sprite extends Drawable {
  /**
   * @brief Constructs a new Sprite.
   * @param x Initial x-coordinate (default is 0).
   * @param y Initial y-coordinate (default is 0).
   * @param color Color of the sprite (default is 'white').
   * @param imageSrcs One or more image source URLs for the sprite costumes.
   */
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
    this.scale = 1.0; // Scale factor for rendering the sprite
    this.controls = null;
    this.gravity = 0;
    this.hitbox = false;
    // Pen properties for drawing trails
    this.penDown = false;
    this.penTrails = [];
    this.currentPath = null;
    this.penColor = this.color;
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
   * @brief Updates the sprite.
   *
   * Override this method to define custom update behavior.
   */
  update() {
    // Default does nothing; override in specific sprites as needed
  }

  /**
   * @brief Registers an event callback for the sprite.
   * @param eventName The name of the event.
   * @param callback The callback function to invoke.
   */
  on(eventName, callback) {
    if (!this.events[eventName]) this.events[eventName] = [];
    this.events[eventName].push(callback);
  }

  /**
   * @brief Registers a continuous touch event callback.
   * @param target The target sprite to detect touch with.
   * @param callback The function to call when touching the target.
   */
  onTouch(target, callback) {
    this.touchCallbacks.push({ target, callback });
  }

  /**
   * @brief Registers a one-time touch event callback.
   * @param target The target sprite.
   * @param callback The function to call once when the sprite touches the target.
   */
  onTouchOnce(target, callback) {
    this.touchOnceCallbacks.push({ target, callback });
  }

  /**
   * @brief Registers a callback for when the sprite stops touching a target.
   * @param target The target sprite.
   * @param callback The function to call when touch ends.
   */
  onTouchEnd(target, callback) {
    this.touchEndCallbacks.push({ target, callback });
  }

  /**
   * @brief Starts drawing a pen trail.
   */
  startDrawing() {
    if (!this.penDown) {
      this.penDown = true;
      this.currentPath = [{ x: this.x, y: this.y }];
      this.penTrails.push(this.currentPath);
    }
  }

  /**
   * @brief Stops drawing a pen trail.
   */
  stopDrawing() {
    this.penDown = false;
    this.currentPath = null;
  }

  /**
   * @brief Clears all pen trails.
   */
  clearPen() {
    this.penTrails = [];
    this.currentPath = null;
  }

  /**
   * @brief Triggers an event.
   * @param eventName The event name.
   * @param eventObject Data associated with the event.
   */
  trigger(eventName, eventObject) {
    if (this.events[eventName]) {
      for (const cb of this.events[eventName]) {
        cb(eventObject);
      }
    }
  }

  /**
   * @brief Checks if the sprite is clicked based on mouse coordinates.
   * @param mouseX The x-coordinate of the mouse.
   * @param mouseY The y-coordinate of the mouse.
   * @return True if clicked; otherwise, false.
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
   * @brief Checks if this sprite is touching another sprite.
   * @param other The other sprite to check against.
   * @return True if touching; otherwise, false.
   */
  isTouching(other) {
    // Use custom hitbox polygon if available
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
    // Fallback to rectangular collision detection
    const a = this.getCollisionSize();
    const b = other.getCollisionSize();
    return (
      Math.abs(this.x - other.x) < (a.width + b.width) / 2 &&
      Math.abs(this.y - other.y) < (a.height + b.height) / 2
    );
  }

  /**
   * @brief Draws the sprite on the canvas.
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
   * @brief Sets the sprite's costume.
   * @param index The index of the costume to display.
   */
  setCostume(index) {
    if (index >= 0 && index < this.costumes.length)
      this.currentCostume = index;
  }

  /**
   * @brief Checks if the sprite is hovered by the mouse.
   * @param mx Mouse x-coordinate.
   * @param my Mouse y-coordinate.
   * @return True if hovered; otherwise, false.
   */
  isHovered(mx, my) {
    return this.isClicked(mx, my);
  }

  /**
   * @brief Sets the control scheme for the sprite.
   * @param scheme An object mapping controls (e.g., left, right, up, down).
   */
  setControlScheme(scheme) {
    this.controls = scheme;
  }

  /**
   * @brief Retrieves the collision size of the sprite.
   * @return An object containing width and height.
   */
  getCollisionSize() {
    const img = this.costumes[this.currentCostume];
    if (this.useOriginalSize && img && img.complete && img.naturalWidth > 0) {
      return { width: img.naturalWidth * this.scale, height: img.naturalHeight * this.scale };
    }
    return { width: this.size, height: this.size };
  }

  /**
   * @brief Determines if the sprite is on the ground.
   * @return True if on ground; otherwise, false.
   */
  isOnGround() {
    return this.touching.some(s => s.hitbox);
  }
}

/**
 * @class Text
 * @brief Represents a text object to be drawn on the canvas.
 * @extends Drawable
 */
class Text extends Drawable {
  /**
   * @brief Constructs a new Text object.
   * @param x The x-coordinate.
   * @param y The y-coordinate.
   * @param color The text color.
   * @param text The string content.
   * @param font The font style (default "20px monospace").
   */
  constructor(x, y, color, text, font = "20px monospace") {
    super(x, y);
    this.color = color;
    this.text = text;
    this.font = font;
  }

  /**
   * @brief Draws the text on the canvas.
   */
  draw() {
    if (this.hidden) return;
    ctx.fillStyle = this.color;
    ctx.font = this.font;
    ctx.fillText(this.text, this.x, this.y);
  }
}

/**
 * @brief Creates a new sprite and adds it to the drawables list.
 * @param x Initial x-coordinate (default 0).
 * @param y Initial y-coordinate (default 0).
 * @param color Color of the sprite (default 'white').
 * @param imageSrcs One or more image source URLs.
 * @return The newly created sprite.
 */
function createSprite(x = 0, y = 0, color = 'white', ...imageSrcs) {
  const sprite = new Sprite(x, y, color, ...imageSrcs);
  sprite.prevX = x;
  sprite.prevY = y;
  drawables.push(sprite);
  return sprite;
}

/**
 * @brief Creates a new text object and adds it to the drawables list.
 * @param x x-coordinate.
 * @param y y-coordinate.
 * @param color Text color.
 * @param text The string content.
 * @param font Font style (default "20px monospace").
 * @return The newly created text object.
 */
function createText(x, y, color, text, font = "20px monospace") {
  const textObj = new Text(x, y, color, text, font);
  drawables.push(textObj);
  return textObj;
}

/**
 * @brief Resizes the canvas to fit the window dimensions.
 */
function resizeCanvas() {
  canvasEl.width = window.innerWidth;
  canvasEl.height = window.innerHeight;
}

/**
 * @brief Hides a drawable object.
 * @param object The object to hide.
 */
function hide(object) {
  object.hidden = true;
}

/**
 * @brief Checks if two polygons intersect using the Separating Axis Theorem.
 * @param poly1 An array of points defining the first polygon.
 * @param poly2 An array of points defining the second polygon.
 * @return True if the polygons intersect; otherwise, false.
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
 * @brief Generates a hitbox polygon from an image by scanning its pixels.
 * @param image The image element.
 * @param alphaThreshold The alpha threshold for detecting edges (default 10).
 * @return An array of points representing the convex hull of the hitbox.
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
 * @brief Computes the convex hull of a set of points using the Graham Scan algorithm.
 * @param points Array of points.
 * @return Array of points representing the convex hull.
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
 * @brief Computes the cross product of vectors OA and OB.
 * @param o The origin point.
 * @param a Point A.
 * @param b Point B.
 * @return The cross product value.
 */
function cross(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * @brief Automatically generates and assigns a hitbox polygon to a sprite.
 * @param sprite The sprite object.
 * @param alphaThreshold The alpha threshold for hitbox generation (default 10).
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
 * @brief Main game loop that updates and renders all sprites.
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

  // Update sprite positions and handle collisions
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

  // Handle collision events for touch callbacks
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

  // Draw pen trails
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

  // Draw all drawable objects (sprites and text)
  for (const obj of drawables) {
    obj.draw();
  }

  requestAnimationFrame(gameLoop);
}

// Event Listeners
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

canvasEl.addEventListener('mousemove', (e) => {
  const rect = canvasEl.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
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

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

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
