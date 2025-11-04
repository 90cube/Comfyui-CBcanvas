/**
 * CBCanvas Node Enhanced - Professional Drawing Tool
 * Features: Brush, Eraser, Shapes, Undo/Redo, Opacity, Color Palette
 */

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { fabric } from "./lib/fabric.js";

// Load CSS
const style = document.createElement("link");
style.rel = "stylesheet";
style.type = "text/css";
style.href = new URL("cbcanvas_node.css", import.meta.url).href;
document.head.appendChild(style);

const ASPECT_RATIOS = {
    "-6": { ratio: "21:9", width: 1536, height: 640 },
    "-5": { ratio: "2:1", width: 1440, height: 720 },
    "-4": { ratio: "16:9", width: 1344, height: 768 },
    "-3": { ratio: "3:2", width: 1216, height: 832 },
    "-2": { ratio: "4:3", width: 1152, height: 896 },
    "-1": { ratio: "5:4", width: 1144, height: 912 },
    "0": { ratio: "1:1", width: 1024, height: 1024 },
    "1": { ratio: "4:5", width: 912, height: 1144 },
    "2": { ratio: "3:4", width: 896, height: 1152 },
    "3": { ratio: "2:3", width: 832, height: 1216 },
    "4": { ratio: "9:16", width: 768, height: 1344 },
    "5": { ratio: "1:2", width: 720, height: 1440 },
    "6": { ratio: "9:21", width: 640, height: 1536 }
};

const MAX_DISPLAY_SIZE = 500;
const extensionName = "CBCanvas.Enhanced";

// Canvas instances
const canvasInstances = {};

// Default color palette
const DEFAULT_COLORS = [
    "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF",
    "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500", "#800080"
];

/**
 * Resolve aspect ratio key/info safely
 */
function resolveAspectRatio(value) {
    const numValue = Number(value);
    const clamped = Number.isFinite(numValue)
        ? Math.max(-6, Math.min(6, Math.round(numValue)))
        : 0;
    const key = String(clamped);
    const info = ASPECT_RATIOS[key];

    if (!info) {
        console.warn(`CBCanvas: Invalid aspect ratio value ${value} (key: ${key}), using default 1:1`);
        return { key: "0", info: ASPECT_RATIOS["0"], value: 0 };
    }

    return { key, info, value: clamped };
}

/**
 * Calculate display size
 */
function calculateDisplaySize(width, height, maxSize) {
    const ratio = width / height;
    let displayWidth, displayHeight;

    if (width > height) {
        displayWidth = Math.min(width, maxSize);
        displayHeight = displayWidth / ratio;
    } else {
        displayHeight = Math.min(height, maxSize);
        displayWidth = displayHeight * ratio;
    }

    return {
        displayWidth: Math.round(displayWidth),
        displayHeight: Math.round(displayHeight)
    };
}

/**
 * History Manager for Undo/Redo
 */
class HistoryManager {
    constructor(canvas, maxStates = 20) {
        this.canvas = canvas;
        this.maxStates = maxStates;
        this.states = [];
        this.currentIndex = -1;
        this.isRestoring = false;

        // Save initial state
        this.saveState();

        // Listen to canvas modifications
        this.canvas.on('object:added', () => this.onCanvasModified());
        this.canvas.on('object:modified', () => this.onCanvasModified());
        this.canvas.on('object:removed', () => this.onCanvasModified());
    }

    onCanvasModified() {
        if (!this.isRestoring) {
            this.saveState();
        }
    }

    saveState() {
        // Remove any states after current index
        if (this.currentIndex < this.states.length - 1) {
            this.states = this.states.slice(0, this.currentIndex + 1);
        }

        // Save current state
        const json = JSON.stringify(this.canvas.toJSON());
        this.states.push(json);

        // Limit history size
        if (this.states.length > this.maxStates) {
            this.states.shift();
        } else {
            this.currentIndex++;
        }
    }

    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.restoreState();
            return true;
        }
        return false;
    }

    redo() {
        if (this.currentIndex < this.states.length - 1) {
            this.currentIndex++;
            this.restoreState();
            return true;
        }
        return false;
    }

    restoreState() {
        this.isRestoring = true;
        const state = this.states[this.currentIndex];
        this.canvas.loadFromJSON(JSON.parse(state), () => {
            this.canvas.renderAll();
            this.isRestoring = false;
        });
    }

    canUndo() {
        return this.currentIndex > 0;
    }

    canRedo() {
        return this.currentIndex < this.states.length - 1;
    }
}

/**
 * Create toolbar with enhanced tools
 */
function createToolbar(node) {
    const toolbar = document.createElement("div");
    toolbar.className = "cbcanvas-toolbar";

    // Current tool state
    node.currentTool = "brush";
    node.brushSize = 5;
    node.brushColor = "#000000";
    node.brushOpacity = 1.0;
    node.colorPalette = [...DEFAULT_COLORS];

    // Tool buttons - Row 1: Drawing Tools
    const tools = [
        { id: "brush", icon: "✏️", label: "Brush", row: 1 },
        { id: "eraser", icon: "🧹", label: "Eraser", row: 1 },
        { id: "line", icon: "📏", label: "Line", row: 1 },
        { id: "circle", icon: "⭕", label: "Circle", row: 1 },
        { id: "rectangle", icon: "▭", label: "Rectangle", row: 1 },
        { id: "select", icon: "↖️", label: "Select", row: 1 }
    ];

    // Row 2: Action Tools
    const actionTools = [
        { id: "undo", icon: "↶", label: "Undo", row: 2 },
        { id: "redo", icon: "↷", label: "Redo", row: 2 },
        { id: "clear", icon: "🗑️", label: "Clear", row: 2 }
    ];

    // Create tool rows
    const toolRow1 = document.createElement("div");
    toolRow1.className = "cbcanvas-tool-row";

    const toolRow2 = document.createElement("div");
    toolRow2.className = "cbcanvas-tool-row";

    // Add drawing tools
    tools.forEach(tool => {
        const btn = document.createElement("button");
        btn.className = "cbcanvas-tool-btn";
        btn.title = tool.label;
        btn.innerHTML = `${tool.icon}<br><span>${tool.label}</span>`;
        btn.dataset.tool = tool.id;

        if (tool.id === node.currentTool) {
            btn.classList.add("active");
        }

        btn.onclick = () => {
            toolRow1.querySelectorAll(".cbcanvas-tool-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            node.currentTool = tool.id;
            updateCanvasMode(node);
        };

        toolRow1.appendChild(btn);
    });

    // Add action tools
    actionTools.forEach(tool => {
        const btn = document.createElement("button");
        btn.className = "cbcanvas-tool-btn";
        btn.title = tool.label;
        btn.innerHTML = `${tool.icon}<br><span>${tool.label}</span>`;
        btn.dataset.action = tool.id;

        btn.onclick = () => {
            if (tool.id === "clear") {
                if (confirm("Clear all canvas content?")) {
                    node.fabricCanvas.clear();
                    node.fabricCanvas.backgroundColor = "#ffffff";
                    node.fabricCanvas.renderAll();
                    if (node.historyManager) {
                        node.historyManager.saveState();
                    }
                }
            } else if (tool.id === "undo") {
                if (node.historyManager) {
                    node.historyManager.undo();
                }
            } else if (tool.id === "redo") {
                if (node.historyManager) {
                    node.historyManager.redo();
                }
            }
        };

        toolRow2.appendChild(btn);
    });

    toolbar.appendChild(toolRow1);
    toolbar.appendChild(toolRow2);

    // Controls row
    const controlsRow = document.createElement("div");
    controlsRow.className = "cbcanvas-controls-row";

    // Brush size slider
    const sizeControl = document.createElement("div");
    sizeControl.className = "cbcanvas-control";
    sizeControl.innerHTML = `
        <label>Size: <span id="brushsize-${node.id}">${node.brushSize}</span></label>
        <input type="range" min="1" max="50" value="${node.brushSize}"
               class="cbcanvas-slider" id="brushslider-${node.id}">
    `;
    const sizeSlider = sizeControl.querySelector("input");
    sizeSlider.oninput = (e) => {
        node.brushSize = parseInt(e.target.value);
        document.getElementById(`brushsize-${node.id}`).textContent = node.brushSize;
        updateBrushSettings(node);
        updateBrushCursor(node);
    };
    controlsRow.appendChild(sizeControl);

    // Opacity slider
    const opacityControl = document.createElement("div");
    opacityControl.className = "cbcanvas-control";
    opacityControl.innerHTML = `
        <label>Opacity: <span id="brushopacity-${node.id}">${Math.round(node.brushOpacity * 100)}%</span></label>
        <input type="range" min="0" max="100" value="${node.brushOpacity * 100}"
               class="cbcanvas-slider" id="opacityslider-${node.id}">
    `;
    const opacitySlider = opacityControl.querySelector("input");
    opacitySlider.oninput = (e) => {
        node.brushOpacity = parseInt(e.target.value) / 100;
        document.getElementById(`brushopacity-${node.id}`).textContent = Math.round(node.brushOpacity * 100) + "%";
        updateBrushSettings(node);
    };
    controlsRow.appendChild(opacityControl);

    // Color picker
    const colorControl = document.createElement("div");
    colorControl.className = "cbcanvas-control";
    colorControl.innerHTML = `
        <label>Color:</label>
        <input type="color" value="${node.brushColor}"
               class="cbcanvas-color-picker" id="colorpicker-${node.id}">
    `;
    const colorPicker = colorControl.querySelector("input");
    colorPicker.oninput = (e) => {
        node.brushColor = e.target.value;
        updateBrushSettings(node);
        updateBrushCursor(node);
    };
    controlsRow.appendChild(colorControl);

    toolbar.appendChild(controlsRow);

    // Color palette
    const paletteRow = document.createElement("div");
    paletteRow.className = "cbcanvas-palette-row";
    paletteRow.innerHTML = `<label>Palette:</label>`;

    const paletteContainer = document.createElement("div");
    paletteContainer.className = "cbcanvas-palette-container";

    node.colorPalette.forEach(color => {
        const colorBtn = document.createElement("button");
        colorBtn.className = "cbcanvas-palette-color";
        colorBtn.style.backgroundColor = color;
        colorBtn.title = color;
        colorBtn.onclick = () => {
            node.brushColor = color;
            colorPicker.value = color;
            updateBrushSettings(node);
            updateBrushCursor(node);
        };
        paletteContainer.appendChild(colorBtn);
    });

    paletteRow.appendChild(paletteContainer);
    toolbar.appendChild(paletteRow);

    return toolbar;
}

/**
 * Update canvas mode based on current tool
 */
function updateCanvasMode(node) {
    const canvas = node.fabricCanvas;

    // Store current tool
    canvas._currentTool = node.currentTool;

    // Disable drawing mode first
    canvas.isDrawingMode = false;

    // Disable any active shape drawing
    if (node.shapeDrawing) {
        node.shapeDrawing.isDrawing = false;
        node.shapeDrawing.shape = null;
    }

    switch (node.currentTool) {
        case "brush":
            setupBrushMode(node);
            break;

        case "eraser":
            setupEraserMode(node);
            break;

        case "line":
        case "circle":
        case "rectangle":
            setupShapeMode(node);
            break;

        case "select":
            setupSelectMode(node);
            break;
    }

    canvas.renderAll();
    updateBrushCursor(node);
}

/**
 * Setup brush mode
 */
function setupBrushMode(node) {
    const canvas = node.fabricCanvas;
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = hexToRgba(node.brushColor, node.brushOpacity);
    canvas.freeDrawingBrush.width = node.brushSize;
    canvas.isDrawingMode = true;
    canvas.selection = false;
    canvas.forEachObject(obj => {
        obj.selectable = false;
        obj.evented = false;
    });
}

/**
 * Setup eraser mode
 */
function setupEraserMode(node) {
    const canvas = node.fabricCanvas;
    canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
    canvas.freeDrawingBrush.width = node.brushSize;
    canvas.isDrawingMode = true;
    canvas.selection = false;
    canvas.forEachObject(obj => {
        obj.selectable = false;
        obj.evented = false;
    });
}

/**
 * Setup shape drawing mode
 */
function setupShapeMode(node) {
    const canvas = node.fabricCanvas;
    canvas.selection = false;
    canvas.forEachObject(obj => {
        obj.selectable = false;
        obj.evented = false;
    });

    // Initialize shape drawing state
    if (!node.shapeDrawing) {
        node.shapeDrawing = {
            isDrawing: false,
            startX: 0,
            startY: 0,
            shape: null
        };
    }

    // Remove old listeners
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    // Add shape drawing listeners
    canvas.on('mouse:down', (options) => {
        const pointer = canvas.getPointer(options.e);
        node.shapeDrawing.isDrawing = true;
        node.shapeDrawing.startX = pointer.x;
        node.shapeDrawing.startY = pointer.y;

        // Create shape based on current tool
        const color = hexToRgba(node.brushColor, node.brushOpacity);

        if (node.currentTool === "line") {
            node.shapeDrawing.shape = new fabric.Line(
                [pointer.x, pointer.y, pointer.x, pointer.y],
                {
                    stroke: color,
                    strokeWidth: node.brushSize,
                    selectable: false,
                    evented: false
                }
            );
        } else if (node.currentTool === "circle") {
            node.shapeDrawing.shape = new fabric.Circle({
                left: pointer.x,
                top: pointer.y,
                radius: 0,
                fill: 'transparent',
                stroke: color,
                strokeWidth: node.brushSize,
                selectable: false,
                evented: false
            });
        } else if (node.currentTool === "rectangle") {
            node.shapeDrawing.shape = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'transparent',
                stroke: color,
                strokeWidth: node.brushSize,
                selectable: false,
                evented: false
            });
        }

        canvas.add(node.shapeDrawing.shape);
    });

    canvas.on('mouse:move', (options) => {
        if (!node.shapeDrawing.isDrawing) return;

        const pointer = canvas.getPointer(options.e);

        if (node.currentTool === "line") {
            node.shapeDrawing.shape.set({
                x2: pointer.x,
                y2: pointer.y
            });
        } else if (node.currentTool === "circle") {
            const radius = Math.sqrt(
                Math.pow(pointer.x - node.shapeDrawing.startX, 2) +
                Math.pow(pointer.y - node.shapeDrawing.startY, 2)
            ) / 2;
            node.shapeDrawing.shape.set({ radius: Math.abs(radius) });
        } else if (node.currentTool === "rectangle") {
            const width = pointer.x - node.shapeDrawing.startX;
            const height = pointer.y - node.shapeDrawing.startY;

            if (width < 0) {
                node.shapeDrawing.shape.set({ left: pointer.x });
            }
            if (height < 0) {
                node.shapeDrawing.shape.set({ top: pointer.y });
            }

            node.shapeDrawing.shape.set({
                width: Math.abs(width),
                height: Math.abs(height)
            });
        }

        canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
        node.shapeDrawing.isDrawing = false;
        node.shapeDrawing.shape = null;
    });
}

/**
 * Setup select mode
 */
function setupSelectMode(node) {
    const canvas = node.fabricCanvas;
    canvas.selection = true;
    canvas.forEachObject(obj => {
        obj.selectable = true;
        obj.evented = true;
    });
}

/**
 * Update brush settings immediately
 */
function updateBrushSettings(node) {
    const canvas = node.fabricCanvas;

    if (node.currentTool === "brush" || node.currentTool === "eraser") {
        // Force re-enter drawing mode to apply settings immediately
        const wasDrawingMode = canvas.isDrawingMode;

        if (wasDrawingMode) {
            canvas.isDrawingMode = false;
        }

        if (node.currentTool === "brush") {
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.color = hexToRgba(node.brushColor, node.brushOpacity);
            canvas.freeDrawingBrush.width = node.brushSize;
        } else if (node.currentTool === "eraser") {
            canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
            canvas.freeDrawingBrush.width = node.brushSize;
        }

        if (wasDrawingMode) {
            canvas.isDrawingMode = true;
        }
    }
}

/**
 * Update brush cursor preview
 */
function updateBrushCursor(node) {
    const canvas = node.fabricCanvas;

    if (node.currentTool === "brush" || node.currentTool === "eraser") {
        // Create custom cursor showing brush size
        const size = node.brushSize;
        const cursorCanvas = document.createElement('canvas');
        const ctx = cursorCanvas.getContext('2d');

        // Make cursor canvas larger than brush to show full circle
        cursorCanvas.width = size * 2 + 4;
        cursorCanvas.height = size * 2 + 4;

        // Draw circle
        ctx.beginPath();
        ctx.arc(cursorCanvas.width / 2, cursorCanvas.height / 2, size, 0, 2 * Math.PI);

        if (node.currentTool === "brush") {
            ctx.strokeStyle = node.brushColor;
            ctx.fillStyle = hexToRgba(node.brushColor, 0.3);
            ctx.fill();
        } else {
            ctx.strokeStyle = "#000000";
        }

        ctx.lineWidth = 1;
        ctx.stroke();

        // Set as cursor
        const cursorUrl = cursorCanvas.toDataURL();
        const centerOffset = cursorCanvas.width / 2;
        canvas.freeDrawingCursor = `url(${cursorUrl}) ${centerOffset} ${centerOffset}, crosshair`;
    } else {
        canvas.freeDrawingCursor = 'crosshair';
    }
}

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Initialize fabric canvas
 */
function initializeFabricCanvas(canvasElement, width, height, node) {
    const fabricCanvas = new fabric.Canvas(canvasElement, {
        width: width,
        height: height,
        backgroundColor: "#ffffff",
        isDrawingMode: true,
        enableRetinaScaling: true,
        selection: false
    });

    // Setup initial drawing brush
    fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.color = "#000000";
    fabricCanvas.freeDrawingBrush.width = 5;

    // Store reference to current tool
    fabricCanvas._currentTool = "brush";

    // Initialize history manager
    node.historyManager = new HistoryManager(fabricCanvas);

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Z for undo
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (node.historyManager) {
                node.historyManager.undo();
            }
        }
        // Ctrl+Y or Ctrl+Shift+Z for redo
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            e.preventDefault();
            if (node.historyManager) {
                node.historyManager.redo();
            }
        }
    });

    return fabricCanvas;
}

/**
 * Add image to canvas with alpha support
 */
function addImageToCanvas(node, imageUrl) {
    fabric.Image.fromURL(imageUrl, (img) => {
        const canvas = node.fabricCanvas;

        // Scale image to fit canvas if too large
        const maxWidth = canvas.width * 0.8;
        const maxHeight = canvas.height * 0.8;

        if (img.width > maxWidth || img.height > maxHeight) {
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
            img.scale(scale);
        }

        // Center image
        img.set({
            left: canvas.width / 2,
            top: canvas.height / 2,
            originX: 'center',
            originY: 'center',
            selectable: true,
            hasControls: true,
            hasBorders: true,
            transparentCorners: false
        });

        canvas.add(img);
        canvas.renderAll();

        console.log("CBCanvas: Image added with alpha support");
    }, { crossOrigin: 'anonymous' });
}

/**
 * Resize canvas and preserve content
 */
function resizeCanvas(node, width, height) {
    const canvas = node.fabricCanvas;

    // Export current state
    const json = canvas.toJSON();

    // Update dimensions
    canvas.setWidth(width);
    canvas.setHeight(height);

    // Calculate display size
    const { displayWidth, displayHeight } = calculateDisplaySize(width, height, MAX_DISPLAY_SIZE);
    canvas.setDimensions({
        width: width,
        height: height
    }, { cssOnly: false });

    // Set wrapper size
    canvas.wrapperEl.style.width = displayWidth + "px";
    canvas.wrapperEl.style.height = displayHeight + "px";

    // Set canvas element sizes
    canvas.lowerCanvasEl.style.width = displayWidth + "px";
    canvas.lowerCanvasEl.style.height = displayHeight + "px";
    canvas.upperCanvasEl.style.width = displayWidth + "px";
    canvas.upperCanvasEl.style.height = displayHeight + "px";

    // Restore content
    canvas.loadFromJSON(json, () => {
        canvas.renderAll();
        console.log(`CBCanvas: Resized to ${width}x${height}, display ${displayWidth}x${displayHeight}`);
    });

    // Update info label
    if (node.ratioLabel) {
        const { info: ratioInfo } = resolveAspectRatio(node.currentRatio ?? 0);
        node.ratioLabel.textContent = `Ratio: ${ratioInfo.ratio} (${width}x${height}) - Display: ${displayWidth}x${displayHeight}`;
    }
}

/**
 * Export canvas with alpha
 */
function exportCanvasWithAlpha(node) {
    return node.fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1
    });
}

// Register extension
app.registerExtension({
    name: extensionName,

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "CBCanvasNode") {
            console.log("CBCanvas Enhanced: Registering professional drawing tool");

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const result = onNodeCreated?.apply(this, arguments);

                // Get initial aspect ratio
                const aspectRatioWidget = this.widgets?.find(
                    w => w.name === "aspect_ratio_slider"
                );
                const initialRatio = aspectRatioWidget?.value ?? 0;
                const { key: initialKey, info: initialInfo, value: initialValue } = resolveAspectRatio(initialRatio);
                this.currentRatio = initialKey;

                console.log(`CBCanvas Enhanced: Creating with ratio ${initialInfo.ratio} (value: ${initialValue})`);

                // Create container
                const container = document.createElement("div");
                container.className = "cbcanvas-enhanced-container";

                // Create toolbar
                const toolbar = createToolbar(this);
                container.appendChild(toolbar);

                // Create canvas wrapper
                const canvasWrapper = document.createElement("div");
                canvasWrapper.className = "cbcanvas-canvas-wrapper";
                canvasWrapper.style.display = "inline-flex";
                canvasWrapper.style.margin = "0 auto 10px";
                canvasWrapper.style.width = "fit-content";
                canvasWrapper.style.maxWidth = "100%";

                // Create canvas element
                const canvasElement = document.createElement("canvas");
                canvasElement.id = `cbcanvas-${this.id}`;

                // Initialize fabric canvas with history manager
                this.fabricCanvas = initializeFabricCanvas(canvasElement, initialInfo.width, initialInfo.height, this);

                // Set display size
                const { displayWidth, displayHeight } = calculateDisplaySize(
                    initialInfo.width, initialInfo.height, MAX_DISPLAY_SIZE
                );

                // Set wrapper size
                this.fabricCanvas.wrapperEl.style.width = displayWidth + "px";
                this.fabricCanvas.wrapperEl.style.height = displayHeight + "px";

                // Set canvas element sizes
                this.fabricCanvas.lowerCanvasEl.style.width = displayWidth + "px";
                this.fabricCanvas.lowerCanvasEl.style.height = displayHeight + "px";
                this.fabricCanvas.upperCanvasEl.style.width = displayWidth + "px";
                this.fabricCanvas.upperCanvasEl.style.height = displayHeight + "px";

                canvasWrapper.appendChild(this.fabricCanvas.wrapperEl);

                // Create info label
                this.ratioLabel = document.createElement("div");
                this.ratioLabel.className = "cbcanvas-info-label";
                this.ratioLabel.textContent = `Ratio: ${initialInfo.ratio} (${initialInfo.width}x${initialInfo.height}) - Display: ${displayWidth}x${displayHeight}`;

                // Add image upload button
                const uploadBtn = document.createElement("button");
                uploadBtn.className = "cbcanvas-upload-btn";
                uploadBtn.textContent = "📁 Add Image";
                uploadBtn.onclick = () => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                addImageToCanvas(this, event.target.result);
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    input.click();
                };

                container.appendChild(canvasWrapper);
                container.appendChild(this.ratioLabel);
                container.appendChild(uploadBtn);

                // Add to node
                this.addDOMWidget("canvas", "fabriccanvas", container);

                // Store instance
                canvasInstances[this.id] = this;

                // Initialize brush cursor
                updateBrushCursor(this);

                // Listen for aspect ratio changes
                if (aspectRatioWidget) {
                    const node = this;

                    Object.defineProperty(aspectRatioWidget, 'value', {
                        get: function() {
                            return this._value;
                        },
                        set: function(v) {
                            const resolved = resolveAspectRatio(v);
                            const oldValue = this._value;
                            this._value = resolved.value;

                            if (oldValue !== resolved.value) {
                                node.currentRatio = resolved.key;
                                console.log(`CBCanvas Enhanced: Updating to ${resolved.info.ratio} (value: ${resolved.value})`);
                                resizeCanvas(node, resolved.info.width, resolved.info.height);
                            }

                            if (this._original_callback && !this._cbcanvas_invoking) {
                                this._cbcanvas_invoking = true;
                                try {
                                    this._original_callback.call(this, resolved.value);
                                } finally {
                                    this._cbcanvas_invoking = false;
                                }
                            }
                        }
                    });

                    aspectRatioWidget._value = initialValue;
                    aspectRatioWidget._original_callback = aspectRatioWidget.callback;
                }

                console.log("CBCanvas Enhanced: Professional drawing tool created successfully");
                return result;
            };

            // Handle node removal
            const onRemoved = nodeType.prototype.onRemoved;
            nodeType.prototype.onRemoved = function () {
                if (canvasInstances[this.id]) {
                    if (this.fabricCanvas) {
                        this.fabricCanvas.dispose();
                    }
                    if (this.historyManager) {
                        this.historyManager = null;
                    }
                    delete canvasInstances[this.id];
                }
                return onRemoved?.apply(this, arguments);
            };

            // Handle serialization
            const onSerialize = nodeType.prototype.onSerialize;
            nodeType.prototype.onSerialize = function (o) {
                const result = onSerialize?.apply(this, arguments);
                if (this.fabricCanvas) {
                    o.canvas_data = exportCanvasWithAlpha(this);
                    o.canvas_json = JSON.stringify(this.fabricCanvas.toJSON());
                }
                return result;
            };

            // Handle deserialization
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (o) {
                const result = onConfigure?.apply(this, arguments);

                if (o.canvas_json && this.fabricCanvas) {
                    try {
                        this.fabricCanvas.loadFromJSON(JSON.parse(o.canvas_json), () => {
                            this.fabricCanvas.renderAll();
                            console.log("CBCanvas Enhanced: Canvas restored from save");
                        });
                    } catch (e) {
                        console.error("CBCanvas Enhanced: Failed to restore canvas", e);
                    }
                }

                return result;
            };
        }
    }
});

console.log("CBCanvas Enhanced: Professional drawing tool extension loaded");
