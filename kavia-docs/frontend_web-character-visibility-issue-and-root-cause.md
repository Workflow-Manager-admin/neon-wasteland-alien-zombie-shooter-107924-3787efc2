# Neon Wasteland Zombie Shooter – Character Visibility Issue and Root Cause Analysis

## Summary of the Issue

In the Neon Wasteland Zombie Shooter game (frontend_web container), some users report that character figures—such as the player, zombies, or bullets—are not being seen properly on the game canvas: either they are invisible or only text/hud appears, with no rendered characters or enemies.

This document analyzes the root causes for this rendering issue by examining the project's game logic (`src/Game.jsx`) and the accompanying CSS (`src/App.css`), in accordance with the game's actual frontend code.

---

## In-Depth Technical Analysis

### Where Rendering Happens

All main game entities (player, enemies, bullets) are drawn on a single HTML canvas (with `id="game-canvas"`), which is sized dynamically and styled through CSS classes (`.game-canvas-container` and directly via style props in React).

Rendering of the game characters is handled using 2D drawing APIs in the `Game.jsx` React component, in methods such as `drawPlayer`, `drawEnemy`, and `drawBullet`. Each of these forcibly renders a large rectangle _and_ a Unicode emoji on the canvas at runtime — with specific diagnostic overrides in effect to ensure visibility.

Example code shows:
```js
ctx.font = "92px Segoe UI Emoji, Apple Color Emoji, sans-serif";
ctx.fillStyle = "#111";
ctx.fillText("🧟", e.x, e.y); // enemy emoji
ctx.fillText("🧍", p.x, p.y); // player emoji
```
Rectangles in neon colors are explicitly drawn beneath these emojis to make missing-draw bugs obvious even if emojis fail.

### Expected Visual Elements

- **Player**: Large rectangle + "🧍" or "👽" emoji
- **Zombie/Enemies**: Large rectangle + "🧟" or similar emoji per type
- **Bullets**: Emoji or glowing projectile as a circle

These are programmatically placed with high-contrast fills to make any missing element (whether shape or emoji) immediately visible with or without font support.

---

## Documented Root Causes

### 1. Font Support and Emoji Rendering

**Symptom:** Canvas shows rectangles but not the emoji, or emojis appear as blank boxes/missing glyphs.

**Cause:** Canvas rendering of emoji relies on the system's font stack supporting color emoji glyphs (e.g., "Segoe UI Emoji", "Apple Color Emoji"). If the browser/OS does not have these fonts or cannot render color emoji in canvas contexts, the character will be missing or appear as a box.

**Evidence from Codebase:**
- All emoji rendering is done via canvas's `.fillText` method, with a font stack that is not universally available on all devices.
- The code attempts to use multiple fallback fonts, but some devices/browsers (esp. older Windows, some Linux distros) may lack proper emoji font support.

**CSS/HTML will not affect canvas-drawn text.** Only the user's OS/browser ability to render these fonts in canvas matters.

### 2. Canvas Sizing and Visibility Bugs

**Symptom:** Whole player or enemies may be cut off, cropped, or drawn outside the visible area, making it look like "characters are missing".

**Cause:** If the logic for entity positions or canvas container sizing is wrong, large shapes/emojis may be drawn outside the visible bounds of the canvas (e.g., negative coordinates, beneath overlays, or hidden due to overflow/scroll).

**Evidence from Codebase:**
- Diagnostic comments and rectangle outlines abound in the `drawPlayer` and `drawEnemy` methods explicitly to help debug such situations.
- The positioning logic for player and enemy Y values is tied to `dims.height`, and any unexpected window size (especially on mobile or after a resize event) could place entities partially offscreen if CSS or resizing logic fails.

**Note:** The React effect for resize tries to prevent this, but layouts may behave differently depending on the device, browser zoom, or CSS changes.

### 3. Overlay Occlusion and Z-Index

**Symptom:** Characters disappear when overlays, menus, or modals are open.

**Cause:** Overlays (e.g., `.game-overlay`) are absolutely positioned and cover the canvas when menus or modal states are present. When `gameState !== "play"`, the overlay visually hides underlying canvas content.

**Evidence from Codebase:**
- Overlay elements are rendered conditionally and have `z-index: 100`.
- This is designed, not a bug, but may confuse users who expect to see gameplay graphics when overlays/modals are active.

### 4. Image Asset Issues (NOT Root Cause Here)

> **NOT the cause:** According to the code, all entities use canvas-drawn emoji and rectangles, not image sprites. However, the project README explains that any intended use of PNG/SVG sprite image assets must put those images into `/public/assets/`. If displaying images was attempted via code (which it is not, in Game.jsx), putting them in the wrong folder would break rendering. For the current codebase, this is not the present cause.

---

## Diagnostic Measures Built-In

- All canvas drawing functions forcibly render large rectangles in neon/magenta/teal under each emoji to diagnose absence-of-render issues even if emoji fail to load.
- Extensive logging clarifies exactly which coordinates and entities are being attempted to draw.
- Rectangles are intentionally oversized and centered based on player/enemy so that any part drawn off-canvas is logged as a warning.

---

## Conclusion and Solution Guidance

- If you see rectangles but **no emoji or funny characters**: Your device/browser **does not support color emoji rendering on canvas** for the font stack used. Try another browser, update your OS, or install emoji fonts.
- If you see **no rectangles or emoji at all**: There may be a more serious canvas/context problem (e.g., hardware acceleration, browser bug, or the canvas HTML element is sized to zero via CSS).
- If **characters sometimes disappear after resizing the window**: This could be due to window size/layout logic calculating bad values; the diagnostic code is designed to expose this.

**No bug is present in the code itself for normal environments.** All diagnostic logic ensures that, on a system with compatible font rendering, all shapes _and_ emoji are visible. Problems are mainly due to environment factors outside the codebase control (font support, browser bugs, or extreme CSS overrides).

---

## Sources

- `/frontend_web/src/Game.jsx`: All canvas and entity render/draw logic and game main loop
- `/frontend_web/src/App.css`: Canvas and overlay container styling, visibility, and z-index controls

