/*
 * Simple RPG demo using MGB Canvas Engine.
 * Features a start screen, NPC dialog and a win condition.
 */

debug = false;
setBackground();

// ----- start screen -----
let state = 'start';
let stage = 'intro';

const startTitle = createText(
  canvaX / 2,
  canvaY / 2 - 60,
  'yellow',
  '🗺️ Mini RPG',
  '36px monospace',
  true,
);
const startPrompt = createText(
  canvaX / 2,
  canvaY / 2,
  '#ccc',
  'Press Enter to Start',
  '24px monospace',
  true,
);

let player,
  npc,
  door,
  message,
  spacePrev = false;

forever(() => {
  if (state === 'start' && keys['Enter']) startGame();
});

function startGame() {
  state = 'play';
  hide(startTitle);
  hide(startPrompt);

  message = createText(
    canvaX / 2,
    40,
    '#0f0',
    '',
    '24px monospace',
    true,
  );

  player = createSprite(100, canvaY - 80, 'cyan');
  player.size = 40;
  player.setControlScheme({
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
  });
  player.doHitbox(true);
  player.doStopAtBorder = true;

  npc = createSprite(canvaX / 2, canvaY / 2, 'orange');
  npc.size = 40;
  npc.doHitbox(true);

  door = createSprite(canvaX - 80, 80, 'green');
  door.size = 50;
  door.doHitbox(true);

  forever(gameLoop);
}

async function startDialogue() {
  state = 'dialogue';
  await showMessage('Old Man: Welcome, hero!');
  await showMessage('Use arrow keys to move.');
  await showMessage('Find the green door to escape.');
  state = 'play';
  stage = 'afterTalk';
}

async function showMessage(txt) {
  message.text = txt;
  await wait(2000);
  message.text = '';
  await wait(300);
}

function gameLoop() {
  const spaceNow = keys[' '];

  if (state === 'play') {
    if (!spacePrev && spaceNow && stage === 'intro' && player.isTouching(npc)) {
      stage = 'talking';
      startDialogue();
    }

    if (stage === 'afterTalk' && player.isTouching(door)) {
      state = 'end';
      message.setColor('yellow');
      message.text = 'You escaped! Refresh to play again.';
    }
  }

  spacePrev = spaceNow;
}
