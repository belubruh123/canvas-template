/* =================================================================
   0.8-Ultimate – comprehensive smoke test
   ============================================================== */

    /* ---------- 1. global helpers ---------- */
    debug = true;           // turn on hover read-outs
    setBackground();        // clear any previous backdrop
    console.log("Library version", 0.7);
  
    /* ---------- 2. text & UI ---------- */
    const titleTxt = createText(canvaX/2, 40, "yellow",
        "⚙️ 0.8-Ultimate – All-features test", "28px monospace", true);
  
    const infoTxt  = createText(10, canvaY-10, "#ccc", "…", "16px monospace");
  
    /* interactive textbox */
    const tb = createTypeBox(20, 70, 360, 40);
    tb.onSubmit(t => alert("You typed: "+t));
  
    /* ---------- 3. sprites ---------- */
    //   player sprite
    const player = createSprite(100, 200, "cyan");
    player.name = "Player";
    player.size = 40;
    player.setControlScheme({left:"ArrowLeft", right:"ArrowRight",
                             up:"ArrowUp",    down:"ArrowDown"});
    player.speed = 5;
    player.gravity = 0;          // manual fix for lib typo
    player.startDrawing();       // leave a pen trail
    player.penColor = "cyan";
    player.penThickness = 2;
  
    //   ground platform
    const ground = createSprite(canvaX/2, canvaY-30, "#654321");
    ground.name   = "Ground";
    ground.size   = canvaX;      // wide rectangle
    ground.setSize(canvaX);
    ground.doHitbox(true);       // rigid body
    ground.hitbox = false;
    ground.setY(canvaY-20);
    hide(ground);
  
    //   bouncing target
    const target = createSprite(600, 120, "orange");
    target.name   = "Target";
    target.size   = 30;
    target.setSpeed(3);
    target.direction = 45;
    // simple “AI” update
    target.update = function(){
      // bounce at edges
      this.changeXBy(Math.cos((this.direction-90)*Math.PI/180)*this.speed);
      this.changeYBy(Math.sin((this.direction-90)*Math.PI/180)*this.speed);
      if(this.border) this.turnRight(180);
    };
  
    /* ---------- 4. collision callbacks ---------- */
    player.onTouch(ground, () => infoTxt.text = "Touching ground…");
    player.onTouchOnce(target, () => infoTxt.text = "Hit the target (first time)!");
    player.onTouchEnd(ground, () => infoTxt.text = "Left the ground!");
  
    /* ---------- 5. click → clone demo ---------- */
    player.on("click", () => {
      const c = player.clone();          // copy state
      c.setColor("magenta");
      c.setSpeed(8);
      c.turnRight( Math.random()*360 );
      // clones auto-delete on 5 s
      setTimeout(()=>c.delete(), 5000);
    });
  
    /* ---------- 6. layer manipulation ---------- */
    // rainbow stack to prove goForward/Back/Front/Back
    const colours = ["red","orange","yellow","green","blue","purple"];
    const stack = colours.map((col,i)=>
        createSprite(900, 120+i*35, col));
    // every ½ s shuffle layers
    forever(()=>{
      repeat(stack.length, j=>{
        stack[j].goForward(j%2?1:-1);
      });
      return wait(500);
    });
  
    /* ---------- 7. pen demo (spiral) ---------- */
    const penGuy = createSprite(canvaX/2, canvaY/2, "white");
    penGuy.startDrawing();
    penGuy.penColor = "lime";
    penGuy.penThickness = 1;
    let angle = 0, radius = 0;
    forever(()=>{
      angle += 8;
      radius += 0.8;
      penGuy.goTo(canvaX/2 + Math.cos(angle*Math.PI/180)*radius,
                  canvaY/2 + Math.sin(angle*Math.PI/180)*radius);
    });
  
    /* ---------- 8. hide / show ---------- */
    setTimeout(()=>hide(target), 7000);   // hide after 7 s
    setTimeout(()=>show(target), 9000);   // show again
  
    /* ---------- 9. repeat & wait ---------- */
    (async ()=>{
      await wait(3000);
      await repeat(5, i=>{
        titleTxt.setColor(i%2?"#ff0":"#0ff");
      });
    })();
  
    /* ---------- 10. playSound ---------- */
    // one-shot silent “beep” encoded inline (0-byte WAV)
    const SILENT_WAV = "data:audio/wav;base64,UklGRhIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    playSound(SILENT_WAV, 1, false);
  
    /* ---------- 11. constantly update HUD text ---------- */
    forever(()=>{
      infoTxt.text =
        `xy(${player.x|0},${player.y|0})  border:${player.border}  `+
        `ground:${player.isOnGround()}`;
    });