import kaplay from "https://unpkg.com/kaplay@3001.0.0/dist/kaplay.mjs";

const k = kaplay({
    width: 1280,
    height: 720,
    background: [20, 20, 20],
    scale: 1,
    letterbox: true,
    canvas: document.querySelector("#game-container canvas") || undefined,
});

// Game State
let gameState = {
    score: 0,
    distance: 0,
    speed: 200,
    isAlive: true,
    hasShield: false,
    hyperRush: false,
    slowMotion: false,
    magnetActive: false,
    doubleJump: false,
    canDoubleJump: false,
    adrenalineBar: 0,
    colorRush: false,
    coins: 0,
};

const BASE_SPEED = 200;
const MAX_SPEED = 600;
const SPEED_INCREASE = 0.5;
const JUMP_FORCE = 650;
const HIGH_JUMP_FORCE = 850;
const GRAVITY = 2000;

// Power-up durations
const HYPER_RUSH_DURATION = 3;
const SLOW_MOTION_DURATION = 5;
const MAGNET_DURATION = 8;
const DOUBLE_JUMP_DURATION = 10;
const COLOR_RUSH_DURATION = 10;
const SPAWN_INTERVAL = 2;

k.scene("game", () => {
    // Reset state when entering game (new game or restart)
    gameState.score = 0;
    gameState.distance = 0;
    gameState.speed = BASE_SPEED;
    gameState.isAlive = true;
    gameState.hasShield = false;
    gameState.hyperRush = false;
    gameState.slowMotion = false;
    gameState.magnetActive = false;
    gameState.doubleJump = false;
    gameState.canDoubleJump = false;
    gameState.adrenalineBar = 0;
    gameState.colorRush = false;
    gameState.coins = 0;
    let spawnTimer = 0;
    let jumpStartTime = 0;
    let isJumpHeld = false;

    // Create ground
    k.add([
        k.rect(k.width(), 100),
        k.pos(0, k.height() - 100),
        k.area(),
        k.body({ isStatic: true }),
        k.color(60, 60, 60),
        "ground",
    ]);

    // Create player
    const player = k.add([
        k.rect(40, 60),
        k.pos(150, k.height() - 160),
        k.area(),
        k.body({ gravityScale: 1 }),
        k.color(255, 140, 0),
        k.opacity(1),
        k.anchor("center"),
        "player",
        {
            jumpCount: 0,
            trail: [],
        },
    ]);

    // Shield visual
    let shieldCircle = null;

    function createShield() {
        if (shieldCircle) shieldCircle.destroy();
        shieldCircle = k.add([
            k.circle(50),
            k.pos(player.pos),
            k.color(100, 150, 255),
            k.opacity(0.4),
            k.anchor("center"),
            k.z(player.z - 1),
            "shield",
        ]);
    }

    function removeShield() {
        if (shieldCircle) {
            shieldCircle.destroy();
            shieldCircle = null;
        }
        gameState.hasShield = false;
    }

    // UI Elements
    const scoreText = k.add([
        k.text("Score: 0", { size: 32 }),
        k.pos(20, 20),
        k.color(255, 255, 255),
        k.z(100),
    ]);

    const distanceText = k.add([
        k.text("Distance: 0m", { size: 24 }),
        k.pos(20, 60),
        k.color(200, 200, 200),
        k.z(100),
    ]);

    const speedText = k.add([
        k.text("Speed: x1.0", { size: 20 }),
        k.pos(20, 90),
        k.color(150, 150, 150),
        k.z(100),
    ]);

    // Adrenaline bar
    const adrenalineBarBg = k.add([
        k.rect(400, 30),
        k.pos(k.width() / 2 - 200, k.height() - 50),
        k.color(40, 40, 40),
        k.outline(2, k.rgb(100, 100, 100)),
        k.z(100),
    ]);

    const adrenalineBarFill = k.add([
        k.rect(0, 26),
        k.pos(k.width() / 2 - 198, k.height() - 48),
        k.color(255, 100, 0),
        k.z(101),
    ]);

    const adrenalineText = k.add([
        k.text("ADRENALINE", { size: 16 }),
        k.pos(k.width() / 2, k.height() - 35),
        k.color(255, 255, 255),
        k.anchor("center"),
        k.z(102),
    ]);

    // Background buildings
    function spawnBuilding() {
        const height = k.rand(100, 400);
        k.add([
            k.rect(k.rand(60, 120), height),
            k.pos(k.width(), k.height() - 100 - height),
            k.color(40, 40, 40),
            k.move(k.LEFT, gameState.speed * 0.3),
            k.offscreen({ destroy: true }),
            "building",
        ]);
    }

    // Spawn enemies
    function spawnEnemy() {
        const enemy = k.add([
            k.rect(50, 70),
            k.pos(k.width() + 50, k.height() - 170),
            k.area(),
            k.color(100, 100, 100),
            k.move(k.LEFT, gameState.speed),
            k.offscreen({ destroy: true }),
            "enemy",
            {
                shootTimer: k.rand(0.5, 1.5),
            },
        ]);

        // Enemy head
        enemy.add([
            k.circle(15),
            k.pos(0, -40),
            k.color(80, 80, 80),
            k.anchor("center"),
        ]);
    }

    // Spawn obstacles
    function spawnObstacle() {
        const types = ["box", "barrier", "trash"];
        const type = k.choose(types);

        let width = 60;
        let height = 80;
        let color = k.rgb(70, 70, 70);

        if (type === "barrier") {
            width = 80;
            height = 100;
            color = k.rgb(90, 90, 90);
        } else if (type === "trash") {
            width = 50;
            height = 70;
            color = k.rgb(60, 60, 60);
        }

        k.add([
            k.rect(width, height),
            k.pos(k.width() + 50, k.height() - 100 - height),
            k.area(),
            k.color(color.r, color.g, color.b),
            k.move(k.LEFT, gameState.speed),
            k.offscreen({ destroy: true }),
            "obstacle",
        ]);
    }

    // Spawn bullets
    function spawnBullet(fromX, fromY) {
        k.add([
            k.circle(5),
            k.pos(fromX, fromY),
            k.area(),
            k.color(255, 50, 50),
            k.move(k.LEFT, gameState.speed + 200),
            k.offscreen({ destroy: true }),
            "bullet",
        ]);
    }

    // Spawn power-ups
    function spawnPowerUp() {
        const types = ["shield", "hyperRush", "slowMotion", "magnet", "doubleJump"];
        const type = k.choose(types);

        let color = k.rgb(100, 150, 255); // Blue shield

        switch(type) {
            case "hyperRush":
                color = k.rgb(255, 50, 50);
                break;
            case "slowMotion":
                color = k.rgb(50, 255, 50);
                break;
            case "magnet":
                color = k.rgb(255, 255, 50);
                break;
            case "doubleJump":
                color = k.rgb(150, 50, 255);
                break;
        }

        k.add([
            k.circle(20),
            k.pos(k.width() + 50, k.height() - 250),
            k.area(),
            k.color(color.r, color.g, color.b),
            k.opacity(0.8),
            k.move(k.LEFT, gameState.speed),
            k.offscreen({ destroy: true }),
            "powerup",
            type,
            {
                floatOffset: k.rand(0, Math.PI * 2),
            },
        ]);
    }

    // Spawn coins
    function spawnCoin() {
        k.add([
            k.circle(12),
            k.pos(k.width() + 50, k.rand(k.height() - 400, k.height() - 200)),
            k.area(),
            k.color(255, 215, 0),
            k.move(k.LEFT, gameState.speed),
            k.offscreen({ destroy: true }),
            "coin",
            {
                floatOffset: k.rand(0, Math.PI * 2),
            },
        ]);
    }

    // Update functions
    k.onUpdate(() => {
        if (!gameState.isAlive) return;

        // Update distance and score
        gameState.distance += k.dt() * (gameState.speed / 100);
        gameState.score = Math.floor(gameState.distance * 10);

        if (gameState.colorRush) {
            gameState.score = Math.floor(gameState.distance * 20); // Double score
        }

        // Increase speed over time
        if (gameState.speed < MAX_SPEED) {
            gameState.speed = Math.min(BASE_SPEED + gameState.distance * SPEED_INCREASE, MAX_SPEED);
        }

        // Update UI
        scoreText.text = `Score: ${gameState.score}`;
        distanceText.text = `Distance: ${Math.floor(gameState.distance)}m`;
        speedText.text = `Speed: x${(gameState.speed / BASE_SPEED).toFixed(1)}`;

        // Update adrenaline bar
        adrenalineBarFill.width = (gameState.adrenalineBar / 100) * 396;
        if (gameState.adrenalineBar >= 100 && !gameState.colorRush) {
            activateColorRush();
        }

        // Update shield position
        if (shieldCircle && gameState.hasShield) {
            shieldCircle.pos = player.pos;
        }

        // Spawn timer
        spawnTimer += k.dt();
        if (spawnTimer > SPAWN_INTERVAL) {
            spawnTimer = 0;
            const rand = k.rand();
            if (rand < 0.4) {
                spawnEnemy();
            } else if (rand < 0.7) {
                spawnObstacle();
            } else if (rand < 0.85) {
                spawnCoin();
            } else {
                spawnPowerUp();
            }
        }

        // Spawn buildings
        if (k.rand() < 0.01) {
            spawnBuilding();
        }

        // Enemy shooting
        k.get("enemy").forEach(enemy => {
            enemy.shootTimer -= k.dt();
            if (enemy.shootTimer <= 0 && enemy.pos.x < k.width() - 100) {
                spawnBullet(enemy.pos.x, enemy.pos.y);
                enemy.shootTimer = k.rand(1, 2);
            }
        });

        // Powerup floating animation
        k.get("powerup").forEach(powerup => {
            if (powerup.floatOffset !== undefined) {
                powerup.floatOffset += k.dt() * 3;
                powerup.pos.y += Math.sin(powerup.floatOffset) * 2;
            }
        });

        // Coin floating animation
        k.get("coin").forEach(coin => {
            if (coin.floatOffset !== undefined) {
                coin.floatOffset += k.dt() * 4;
                coin.pos.y += Math.sin(coin.floatOffset) * 1.5;
            }

            // Magnet effect
            if (gameState.magnetActive) {
                const dx = player.pos.x - coin.pos.x;
                const dy = player.pos.y - coin.pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 300) {
                    coin.pos.x += (dx / dist) * 400 * k.dt();
                    coin.pos.y += (dy / dist) * 400 * k.dt();
                }
            }
        });

        // Update all moving objects speed (call move(dir, speed), do not assign to obj.move)
        k.get("enemy").forEach(obj => {
            obj.move(k.LEFT, gameState.speed);
        });
        k.get("obstacle").forEach(obj => {
            obj.move(k.LEFT, gameState.speed);
        });
        k.get("bullet").forEach(obj => {
            obj.move(k.LEFT, gameState.speed + 200);
        });
        k.get("powerup").forEach(obj => {
            obj.move(k.LEFT, gameState.speed);
        });
        k.get("coin").forEach(obj => {
            obj.move(k.LEFT, gameState.speed);
        });
        k.get("building").forEach(obj => {
            obj.move(k.LEFT, gameState.speed * 0.3);
        });

        // Player trail effect
        if (gameState.colorRush || gameState.hyperRush) {
            const trailColor = gameState.colorRush ?
                k.rgb(k.rand(100, 255), k.rand(100, 255), k.rand(100, 255)) :
                k.rgb(255, 100, 0);

            k.add([
                k.circle(gameState.hyperRush ? 25 : 20),
                k.pos(player.pos),
                k.color(trailColor.r, trailColor.g, trailColor.b),
                k.opacity(0.5),
                k.lifespan(0.3),
                k.z(player.z - 2),
            ]);
        }

        // Color Rush visual effect
        if (gameState.colorRush) {
            k.get("building").forEach(obj => {
                const t = k.time() * 3;
                obj.color = k.rgb(
                    Math.abs(Math.sin(t) * 255),
                    Math.abs(Math.sin(t + 2) * 255),
                    Math.abs(Math.sin(t + 4) * 255)
                );
            });
        }
    });

    // Jump controls
    k.onKeyPress("space", () => handleJump());
    k.onKeyRelease("space", () => {
        isJumpHeld = false;
    });
    k.onClick(() => handleJump());
    k.onTouchStart(() => handleJump());
    k.onTouchEnd(() => {
        isJumpHeld = false;
    });

    function handleJump() {
        if (!gameState.isAlive) return;

        if (player.isGrounded()) {
            jumpStartTime = k.time();
            isJumpHeld = true;
            player.jump(JUMP_FORCE);
            player.jumpCount = 1;
            gameState.canDoubleJump = gameState.doubleJump;
        } else if (gameState.canDoubleJump && player.jumpCount === 1) {
            player.jump(JUMP_FORCE);
            player.jumpCount = 2;
            gameState.canDoubleJump = false;
        }
    }

    // High jump mechanic
    k.onKeyDown("space", () => {
        if (isJumpHeld && k.time() - jumpStartTime > 0.1 && k.time() - jumpStartTime < 0.5 && player.jumpCount === 1) {
            player.jump(HIGH_JUMP_FORCE - JUMP_FORCE);
        }
    });

    // Collisions
    player.onCollide("enemy", (enemy) => {
        if (gameState.hyperRush) {
            enemy.destroy();
            gameState.score += 50;
            increaseAdrenaline(10);
        } else if (gameState.hasShield) {
            removeShield();
            enemy.destroy();
        } else {
            gameOver();
        }
    });

    player.onCollide("obstacle", (obstacle) => {
        if (gameState.hyperRush) {
            obstacle.destroy();
            gameState.score += 25;
        } else if (gameState.hasShield) {
            removeShield();
            obstacle.destroy();
        } else {
            gameOver();
        }
    });

    player.onCollide("bullet", (bullet) => {
        bullet.destroy();
        if (gameState.hyperRush) {
            gameState.score += 10;
        } else if (gameState.hasShield) {
            removeShield();
        } else {
            gameOver();
        }
    });

    player.onCollide("powerup", (powerup) => {
        powerup.destroy();
        gameState.score += 100;

        if (powerup.is("shield")) {
            gameState.hasShield = true;
            createShield();
        } else if (powerup.is("hyperRush")) {
            activateHyperRush();
        } else if (powerup.is("slowMotion")) {
            activateSlowMotion();
        } else if (powerup.is("magnet")) {
            activateMagnet();
        } else if (powerup.is("doubleJump")) {
            activateDoubleJump();
        }
    });

    player.onCollide("coin", (coin) => {
        coin.destroy();
        gameState.coins++;
        gameState.score += 10;
        increaseAdrenaline(2);
    });

    // Power-up activation functions
    function activateHyperRush() {
        gameState.hyperRush = true;
        player.color = k.rgb(255, 50, 0);
        k.wait(HYPER_RUSH_DURATION, () => {
            gameState.hyperRush = false;
            player.color = k.rgb(255, 140, 0);
        });
    }

    function activateSlowMotion() {
        gameState.slowMotion = true;
        const originalSpeed = gameState.speed;
        gameState.speed *= 0.3;
        k.get("building").forEach(obj => {
            obj.color = k.rgb(0, 255, 100);
        });
        k.wait(SLOW_MOTION_DURATION, () => {
            gameState.slowMotion = false;
            gameState.speed = originalSpeed;
        });
    }

    function activateMagnet() {
        gameState.magnetActive = true;
        k.wait(MAGNET_DURATION, () => {
            gameState.magnetActive = false;
        });
    }

    function activateDoubleJump() {
        gameState.doubleJump = true;
        k.wait(DOUBLE_JUMP_DURATION, () => {
            gameState.doubleJump = false;
        });
    }

    function activateColorRush() {
        gameState.colorRush = true;
        gameState.adrenalineBar = 0;
        k.wait(COLOR_RUSH_DURATION, () => {
            gameState.colorRush = false;
            k.get("building").forEach(obj => {
                obj.color = k.rgb(40, 40, 40);
            });
        });
    }

    function increaseAdrenaline(amount) {
        if (!gameState.colorRush) {
            gameState.adrenalineBar = Math.min(100, gameState.adrenalineBar + amount);
        }
    }

    // Close call detection
    k.onUpdate(() => {
        if (!gameState.isAlive) return;

        const closeCallDistance = 80;
        let nearDanger = false;

        k.get("enemy").forEach(enemy => {
            const dist = Math.abs(enemy.pos.x - player.pos.x);
            if (dist < closeCallDistance && dist > 40 && !player.isGrounded()) {
                if (!nearDanger) {
                    increaseAdrenaline(15);
                    nearDanger = true;
                }
            }
        });

        k.get("obstacle").forEach(obstacle => {
            const dist = Math.abs(obstacle.pos.x - player.pos.x);
            if (dist < closeCallDistance && dist > 40 && !player.isGrounded()) {
                if (!nearDanger) {
                    increaseAdrenaline(10);
                    nearDanger = true;
                }
            }
        });
    });

    // Game Over
    function gameOver() {
        gameState.isAlive = false;
        player.color = k.rgb(150, 150, 150);

        k.add([
            k.text("GAME OVER", { size: 72 }),
            k.pos(k.width() / 2, k.height() / 2 - 100),
            k.anchor("center"),
            k.color(255, 50, 50),
            k.z(200),
        ]);

        k.add([
            k.text(`Final Score: ${gameState.score}`, { size: 48 }),
            k.pos(k.width() / 2, k.height() / 2),
            k.anchor("center"),
            k.color(255, 255, 255),
            k.z(200),
        ]);

        k.add([
            k.text(`Distance: ${Math.floor(gameState.distance)}m`, { size: 36 }),
            k.pos(k.width() / 2, k.height() / 2 + 60),
            k.anchor("center"),
            k.color(200, 200, 200),
            k.z(200),
        ]);

        k.add([
            k.text("Press SPACE or Click to Restart", { size: 24 }),
            k.pos(k.width() / 2, k.height() / 2 + 120),
            k.anchor("center"),
            k.color(150, 150, 150),
            k.z(200),
        ]);

        k.onKeyPress("space", () => k.go("game"));
        k.onClick(() => k.go("game"));
    }
});

// Start screen
k.scene("start", () => {
    k.add([
        k.text("ORANGE RUSH", { size: 72 }),
        k.pos(k.width() / 2, k.height() / 2 - 150),
        k.anchor("center"),
        k.color(255, 140, 0),
    ]);

    k.add([
        k.text("CODE GREY", { size: 48 }),
        k.pos(k.width() / 2, k.height() / 2 - 80),
        k.anchor("center"),
        k.color(100, 100, 100),
    ]);

    k.add([
        k.text("Escape the grey city and bring back the colors!", { size: 20 }),
        k.pos(k.width() / 2, k.height() / 2 + 20),
        k.anchor("center"),
        k.color(200, 200, 200),
    ]);

    k.add([
        k.text("Controls:", { size: 24 }),
        k.pos(k.width() / 2, k.height() / 2 + 80),
        k.anchor("center"),
        k.color(255, 255, 255),
    ]);

    k.add([
        k.text("SPACE / Click - Jump", { size: 20 }),
        k.pos(k.width() / 2, k.height() / 2 + 120),
        k.anchor("center"),
        k.color(200, 200, 200),
    ]);

    k.add([
        k.text("Hold for High Jump", { size: 20 }),
        k.pos(k.width() / 2, k.height() / 2 + 150),
        k.anchor("center"),
        k.color(200, 200, 200),
    ]);

    k.add([
        k.text("Press SPACE or Click to Start", { size: 28 }),
        k.pos(k.width() / 2, k.height() / 2 + 220),
        k.anchor("center"),
        k.color(255, 140, 0),
    ]);

    k.onKeyPress("space", () => k.go("game"));
    k.onClick(() => k.go("game"));
});

// Start with start screen
k.go("start");
