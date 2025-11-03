# Changelog - CBCanvas Node

## v1.0.1 (2025-01-03) - Bug Fixes

### Fixed Issues

#### 1. Canvas Size Overflow ✅
**Problem**: Canvas was displaying at full resolution (1024×1024 etc), causing it to overflow the node boundaries.

**Solution**:
- Added `MAX_DISPLAY_SIZE = 400px` constant
- Canvas now scales to fit within node while maintaining aspect ratio
- Real resolution: 1024×1024 (for quality)
- Display size: 400×400 (fits in node)
- Example: 21:9 (1536×640) displays as 400×166

#### 2. Slider Real-Time Update ✅
**Problem**: Aspect ratio slider didn't update canvas immediately.

**Solution**:
- Implemented `Object.defineProperty` to intercept value changes
- Added dual callback system (setter + callback)
- Canvas now updates instantly when slider moves
- Console logs show: `CBCanvas: Slider changed from X to Y`

### Technical Improvements

**JavaScript (cbcanvas_node.js)**:
```javascript
// Scale factor calculation for proper mouse coordinates
function getScale() {
    const rect = canvas.getBoundingClientRect();
    return {
        x: canvas.width / rect.width,
        y: canvas.height / rect.height
    };
}

// Display size calculation maintaining aspect ratio
function calculateDisplaySize(width, height, maxSize) {
    const ratio = width / height;
    if (width > height) {
        displayWidth = Math.min(width, maxSize);
        displayHeight = displayWidth / ratio;
    } else {
        displayHeight = Math.min(height, maxSize);
        displayWidth = displayHeight * ratio;
    }
    return { displayWidth, displayHeight };
}
```

**CSS (cbcanvas_node.css)**:
- Added flexbox layout for centered canvas
- Added `max-width: 100%` to prevent overflow
- Improved responsive design

**Features**:
- ✅ Canvas scales to fit node (max 400px)
- ✅ Maintains correct aspect ratio
- ✅ Real-time slider updates
- ✅ Mouse coordinates scale correctly
- ✅ Content preserved when resizing
- ✅ Dynamic info label shows both resolutions

### Testing

To verify fixes work:
1. Restart ComfyUI completely
2. Add CB Canvas Node
3. Move slider - canvas should resize immediately
4. Canvas should stay within node boundaries
5. Draw on canvas - lines should follow cursor accurately

### Console Output

Expected console messages:
```
CBCanvas: Extension loaded
CBCanvas: Registering CBCanvasNode
CBCanvas: Creating node with initial ratio 1:1
CBCanvas: Node created successfully
CBCanvas: Slider changed from 0 to -4  (when you move slider)
CBCanvas: Updating to 16:9 (1344×768)
```

## v1.0.0 (2025-01-03) - Initial Release
- 13 aspect ratio presets
- Basic canvas drawing
- Canvas state saving
