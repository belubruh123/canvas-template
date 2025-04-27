/* ===================================================================
   QUICK START EXAMPLE  ·  SQUARE FRENZY  (uncomment to play!)

   • Controls
       ← / →        move left / right
       Space        jump (gravity)
       Click player shoot a yellow bullet (clone)
   • Goal
       Hit as many falling red aliens as you can in 60 seconds.
   • How to use
       1. Keep this block at the very end of the engine file.
       2. Delete these two comment markers (/* … *\/) to enable.
       3. Refresh the browser and play.
       4. Re‑add the markers or delete the block to revert to a clean engine.
===================================================================*\/

/* -------------------------------------------------------------
   SETUP – black background & HUD
----------------------------------------------------------------*/
document.body.style.backgroundColor = '#000';

const scoreText = createText(10, 30, 'white', 'Score: 0');
const timerText = createText(canvaX - 10, 30, 'white', '60');
let score = 0;
const addScore = n => { score += n; scoreText.text = 'Score: ' + score; };
let bullet 

/* -------------------------------------------------------------
   PLAYER – cyan square with gravity & keyboard controls
----------------------------------------------------------------*/
const player = createSprite(canvaX / 2, canvaY - 60, 'cyan');
player.setSize(48);
player.gravity = 0.8;
player.setSpeed(6);
player.setControlScheme({ left: 'ArrowLeft', right: 'ArrowRight', up: 'Space' });
player.setPenThickness(2);      // lime trail
player.penColor = 'lime';
player.doHitbox = true;

/* Shoot a yellow square bullet (clone) on click */
player.on('click', () => {
    bullet = player.clone();
    bullet.setColor('yellow');
    bullet.setSize(10);
    bullet.penDown = false; bullet.gravity = 0;
    bullet.update = () => {
        bullet.changeYBy(-12);
        if (bullet.border) bullet.delete();
    };
});

/* -------------------------------------------------------------
   ALIENS – red squares falling from the top
----------------------------------------------------------------*/
function spawnAlien() {
    const x = 40 + Math.random() * (canvaX - 80);
    const alien = createSprite(x, -40, 'red');
    alien.setSize(42); alien.gravity = 0.4; alien.doHitbox(true);

    alien.update = () => { if (alien.y > canvaY + 40) alien.delete(); };
    if (alien.border = true && alien.y > 100) {
        alien.delete();
    }
    // One‑time bullet collision handler   
    alien.onTouch(bullet, () => { addScore(1); bullet.delete(); alien.delete(); })
}

/* Spawn ~3 aliens per second */
forever(() => { if (Math.random() < 0.05) spawnAlien(); });

/* -------------------------------------------------------------
   60‑SECOND COUNTDOWN then GAME OVER message
----------------------------------------------------------------*/
(async () => {
    for (let t = 60; t >= 0; t--) {
        timerText.text = String(t).padStart(2, '0');
        timerText.x = canvaX - ctx.measureText(timerText.text).width - 10;
        await wait(1000);
    }
    const msg = createText(canvaX / 2, canvaY / 2,
        'white', `Time!\nFinal score: ${score}`, '32px monospace', true);
    msg.doCenter = true;
})();
 /* ===================================================================
   END OF EXAMPLE  –  delete this block or re‑comment to disable again
=================================================================== */
