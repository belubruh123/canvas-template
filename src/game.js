/* Example usage
debug = false;
canvaX = 1280; // Global variable for fixed canvas width
canvaY = 720; // Global variable for fixed canvas height
 const player = createSprite(30, 30, "red");
 player.name = "Player";
 player.setControlScheme({ up: 'w', down: 's', left: 'a', right: 'd' });
 player.gravity = 1.0;
 player.startDrawing();
 player.penThickness = 5;
 player.penColor = "white"
const text = createText(700, 40, "White", "Gravity Drawer", "30px Comic Sans MS");

function gameLogic() {
    if (keys["c"]) {player.clearPen()};
    requestAnimationFrame(gameLogic);
}

gameLogic();
*/


