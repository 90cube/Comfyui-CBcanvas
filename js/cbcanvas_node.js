/**
 * CBCanvas Node Enhanced - Layer-based Drawing System with Wacom Support
 * Features: Photoshop-like Layers, Pen Pressure, Brush, Eraser, Shapes, Undo/Redo
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
 * Layer Class - Photoshop-like layer with raster canvas
 */
class Layer {
    constructor(width, height, name = "Layer") {
        this.id = Date.now() + Math.random();
        this.name = name;
        this.visible = true;
        this.opacity = 1.0;
        this.locked = false;

        // Create offscreen canvas for this layer
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        // Initialize with transparent background
        this.ctx.clearRect(0, 0, width, height);

        // Fabric.js image representation (for display only)
        this.fabricImage = null;
    }

    /**
     * Draw on this layer's canvas
     */
    drawStroke(points, color, width, pressureSensitivity = 1.0) {
        if (points.length < 2) return;

        const ctx = this.ctx;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';

        // Draw each segment with pressure-sensitive width
        for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];

            const pressure1 = Math.pow(p1.pressure || 1.0, 1 / pressureSensitivity);
            const pressure2 = Math.pow(p2.pressure || 1.0, 1 / pressureSensitivity);
            const avgPressure = (pressure1 + pressure2) / 2;
            const strokeWidth = Math.max(1, width * avgPressure);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
        }
    }

    /**
     * Erase on this layer's canvas
     */
    erase(points, width) {
        if (points.length < 2) return;

        const ctx = this.ctx;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineWidth = width;
            ctx.stroke();
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Clear this layer
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Get layer data as image data URL
     */
    toDataURL() {
        return this.canvas.toDataURL('image/png');
    }

    /**
     * Load from data URL
     */
    fromDataURL(dataURL, callback) {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
            if (callback) callback();
        };
        img.src = dataURL;
    }

    /**
     * Resize layer canvas
     */
    resize(width, height) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.putImageData(imageData, 0, 0);
    }
}

/**
 * Layer Manager - Manages multiple layers and compositing
 */
class LayerManager {
    constructor(fabricCanvas) {
        this.fabricCanvas = fabricCanvas;
        this.layers = [];
        this.activeLayerIndex = -1;

        // Create default layer
        this.addLayer("Background");
    }

    /**
     * Add new layer
     */
    addLayer(name = "Layer") {
        const layer = new Layer(
            this.fabricCanvas.width,
            this.fabricCanvas.height,
            name || `Layer ${this.layers.length + 1}`
        );
        this.layers.push(layer);
        this.activeLayerIndex = this.layers.length - 1;
        this.updateComposite();
        return layer;
    }

    /**
     * Create new layer (alias for addLayer)
     */
    createLayer(name = "Layer") {
        return this.addLayer(name);
    }

    /**
     * Get active layer
     */
    getActiveLayer() {
        return this.layers[this.activeLayerIndex];
    }

    /**
     * Set active layer by index
     */
    setActiveLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            this.activeLayerIndex = index;
        }
    }

    /**
     * Delete layer
     */
    deleteLayer(index) {
        if (this.layers.length <= 1) return; // Keep at least one layer

        this.layers.splice(index, 1);
        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        }
        this.updateComposite();
    }

    /**
     * Toggle layer visibility
     */
    toggleLayerVisibility(index) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].visible = !this.layers[index].visible;
            this.updateComposite();
        }
    }

    /**
     * Merge layer down
     */
    mergeDown(index) {
        if (index <= 0 || index >= this.layers.length) return;

        const upperLayer = this.layers[index];
        const lowerLayer = this.layers[index - 1];

        // Draw upper layer onto lower layer
        lowerLayer.ctx.globalAlpha = upperLayer.opacity;
        lowerLayer.ctx.drawImage(upperLayer.canvas, 0, 0);
        lowerLayer.ctx.globalAlpha = 1.0;

        // Remove upper layer
        this.deleteLayer(index);
    }

    /**
     * Update composite - combine all layers to fabric canvas
     */
    updateComposite() {
        // Clear fabric canvas
        this.fabricCanvas.clear();
        this.fabricCanvas.backgroundColor = "#ffffff";

        // Composite all visible layers
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = this.fabricCanvas.width;
        compositeCanvas.height = this.fabricCanvas.height;
        const compositeCtx = compositeCanvas.getContext('2d');

        // Draw white background
        compositeCtx.fillStyle = '#ffffff';
        compositeCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

        // Draw each visible layer
        for (const layer of this.layers) {
            if (layer.visible) {
                compositeCtx.globalAlpha = layer.opacity;
                compositeCtx.drawImage(layer.canvas, 0, 0);
            }
        }
        compositeCtx.globalAlpha = 1.0;

        // Convert to fabric image
        const dataURL = compositeCanvas.toDataURL('image/png');
        fabric.Image.fromURL(dataURL, (img) => {
            img.set({
                left: 0,
                top: 0,
                selectable: false,
                evented: false,
                hasControls: false,
                hasBorders: false
            });
            this.fabricCanvas.add(img);
            this.fabricCanvas.renderAll();
        }, { crossOrigin: 'anonymous' });
    }

    /**
     * Resize all layers
     */
    resizeAll(width, height) {
        for (const layer of this.layers) {
            layer.resize(width, height);
        }
    }

    /**
     * Export all layers as JSON
     */
    toJSON() {
        return {
            layers: this.layers.map(layer => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                locked: layer.locked,
                data: layer.toDataURL()
            })),
            activeLayerIndex: this.activeLayerIndex
        };
    }

    /**
     * Load from JSON
     */
    fromJSON(json, callback) {
        this.layers = [];
        this.activeLayerIndex = json.activeLayerIndex || 0;

        let loadedCount = 0;
        const totalLayers = json.layers.length;

        json.layers.forEach((layerData, index) => {
            const layer = new Layer(
                this.fabricCanvas.width,
                this.fabricCanvas.height,
                layerData.name
            );
            layer.id = layerData.id;
            layer.visible = layerData.visible;
            layer.opacity = layerData.opacity;
            layer.locked = layerData.locked;

            layer.fromDataURL(layerData.data, () => {
                loadedCount++;
                if (loadedCount === totalLayers) {
                    this.updateComposite();
                    if (callback) callback();
                }
            });

            this.layers.push(layer);
        });
    }
}

/**
 * History Manager for Undo/Redo with Layer Support
 */
class HistoryManager {
    constructor(layerManager, maxStates = 20) {
        this.layerManager = layerManager;
        this.maxStates = maxStates;
        this.states = [];
        this.currentIndex = -1;
        this.isRestoring = false;

        // Save initial state
        this.saveState();
    }

    saveState() {
        if (this.isRestoring) return;

        // Remove any states after current index
        if (this.currentIndex < this.states.length - 1) {
            this.states = this.states.slice(0, this.currentIndex + 1);
        }

        // Save current state
        const state = JSON.stringify(this.layerManager.toJSON());
        this.states.push(state);

        // Limit history size
        if (this.states.length > this.maxStates) {
            this.states.shift();
        } else {
            this.currentIndex++;
        }

        // Update canvas data when state changes
        if (this.layerManager.fabricCanvas && this.layerManager.fabricCanvas.node) {
            const node = this.layerManager.fabricCanvas.node;
            if (node.updateCanvasData) {
                node.updateCanvasData();
            }
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
        const state = JSON.parse(this.states[this.currentIndex]);
        this.layerManager.fromJSON(state, () => {
            this.isRestoring = false;
        });
    }
}

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
 * Convert hex color to rgba
 */
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    node.pressureSensitivity = 1.0;
    node.colorPalette = [...DEFAULT_COLORS];
    node.isDrawing = false;
    node.currentStroke = [];

    // Tool buttons - Row 1: Drawing Tools
    const tools = [
        { id: "brush", icon: "✏️", label: "Brush" },
        { id: "eraser", icon: "🧹", label: "Eraser" },
        { id: "select", icon: "↖️", label: "Select" }
    ];

    // Row 2: Action Tools
    const actionTools = [
        { id: "undo", icon: "↶", label: "Undo" },
        { id: "redo", icon: "↷", label: "Redo" },
        { id: "clear", icon: "🗑️", label: "Clear" },
        { id: "newlayer", icon: "➕", label: "Layer" },
        { id: "loadimage", icon: "📁", label: "Image" }
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

        btn.onclick = () => {
            if (tool.id === "clear") {
                const layer = node.layerManager.getActiveLayer();
                if (layer) {
                    layer.clear();
                    node.layerManager.updateComposite();
                    node.historyManager.saveState();
                }
            } else if (tool.id === "undo") {
                if (node.historyManager) {
                    node.historyManager.undo();
                    updateLayerPanel(node);
                }
            } else if (tool.id === "redo") {
                if (node.historyManager) {
                    node.historyManager.redo();
                    updateLayerPanel(node);
                }
            } else if (tool.id === "newlayer") {
                console.log("New Layer clicked, LayerManager:", node.layerManager);
                if (node.layerManager) {
                    const newLayer = node.layerManager.addLayer(`Layer ${node.layerManager.layers.length + 1}`);
                    console.log("New layer created:", newLayer, "Total layers:", node.layerManager.layers.length);
                    node.historyManager.saveState();
                    updateLayerPanel(node);
                }
            } else if (tool.id === "loadimage") {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            addImageToCanvas(node, event.target.result);
                        };
                        reader.readAsDataURL(file);
                    }
                };
                input.click();
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
    };
    controlsRow.appendChild(opacityControl);

    // Pressure sensitivity slider
    const pressureControl = document.createElement("div");
    pressureControl.className = "cbcanvas-control";
    pressureControl.innerHTML = `
        <label>Pressure: <span id="pressure-${node.id}">${Math.round(node.pressureSensitivity * 100)}%</span></label>
        <input type="range" min="20" max="200" value="${node.pressureSensitivity * 100}"
               class="cbcanvas-slider" id="pressureslider-${node.id}">
    `;
    const pressureSlider = pressureControl.querySelector("input");
    pressureSlider.oninput = (e) => {
        node.pressureSensitivity = parseInt(e.target.value) / 100;
        document.getElementById(`pressure-${node.id}`).textContent = Math.round(node.pressureSensitivity * 100) + "%";
    };
    controlsRow.appendChild(pressureControl);

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
        };
        paletteContainer.appendChild(colorBtn);
    });

    paletteRow.appendChild(paletteContainer);
    toolbar.appendChild(paletteRow);

    return toolbar;
}

/**
 * Create layer panel UI
 */
function createLayerPanel(node) {
    const panel = document.createElement("div");
    panel.className = "cbcanvas-layer-panel";
    panel.id = `layerpanel-${node.id}`;

    const header = document.createElement("div");
    header.className = "cbcanvas-layer-header";

    const title = document.createElement("h4");
    title.textContent = "Layers";
    header.appendChild(title);

    const newLayerBtn = document.createElement("button");
    newLayerBtn.textContent = "+";
    newLayerBtn.title = "New Layer";
    newLayerBtn.onclick = () => {
        console.log("Layer panel + button clicked");
        console.log("Node:", node, "LayerManager:", node.layerManager);
        if (node.layerManager) {
            const newLayer = node.layerManager.createLayer(`Layer ${node.layerManager.layers.length + 1}`);
            console.log("New layer created:", newLayer, "Total layers:", node.layerManager.layers.length);
            node.historyManager.saveState();
            updateLayerPanel(node);
        } else {
            console.error("LayerManager not found on node!");
        }
    };
    header.appendChild(newLayerBtn);

    panel.appendChild(header);

    const layerList = document.createElement("div");
    layerList.className = "cbcanvas-layer-list";
    layerList.id = `layerlist-${node.id}`;
    panel.appendChild(layerList);

    return panel;
}

/**
 * Update layer panel
 */
function updateLayerPanel(node) {
    console.log("updateLayerPanel called for node:", node.id);
    const layerList = document.getElementById(`layerlist-${node.id}`);
    if (!layerList) {
        console.error("Layer list element not found!");
        return;
    }

    layerList.innerHTML = '';

    // Reverse order - show top layer first
    const layers = [...node.layerManager.layers].reverse();
    console.log("Updating layer panel with", layers.length, "layers");
    layers.forEach((layer, reverseIndex) => {
        const index = layers.length - 1 - reverseIndex;
        const isActive = index === node.layerManager.activeLayerIndex;

        const layerItem = document.createElement("div");
        layerItem.className = `cbcanvas-layer-item ${isActive ? 'active' : ''}`;

        const visBtn = document.createElement("button");
        visBtn.className = "cbcanvas-layer-vis-btn";
        visBtn.textContent = layer.visible ? "👁" : "🚫";
        visBtn.onclick = () => {
            node.layerManager.toggleLayerVisibility(index);
            updateLayerPanel(node);
        };

        const nameSpan = document.createElement("span");
        nameSpan.textContent = layer.name;
        nameSpan.onclick = () => {
            node.layerManager.setActiveLayer(index);
            updateLayerPanel(node);
        };

        const delBtn = document.createElement("button");
        delBtn.className = "cbcanvas-layer-del-btn";
        delBtn.textContent = "🗑";
        delBtn.onclick = () => {
            if (node.layerManager.layers.length > 1) {
                node.layerManager.deleteLayer(index);
                node.historyManager.saveState();
                updateLayerPanel(node);
            }
        };

        layerItem.appendChild(visBtn);
        layerItem.appendChild(nameSpan);
        layerItem.appendChild(delBtn);
        layerList.appendChild(layerItem);
    });
}

/**
 * Update canvas mode based on current tool
 */
function updateCanvasMode(node) {
    // Just update the cursor, actual drawing is handled by mouse events
    const canvas = node.fabricCanvas;

    if (node.currentTool === "select") {
        canvas.defaultCursor = 'default';
    } else {
        canvas.defaultCursor = 'crosshair';
    }
}

/**
 * Setup drawing handlers
 */
function setupDrawingHandlers(node) {
    const canvas = node.fabricCanvas;

    // Mouse down
    canvas.on('mouse:down', (options) => {
        if (node.currentTool === "select") return;

        const layer = node.layerManager.getActiveLayer();
        if (!layer || layer.locked) return;

        node.isDrawing = true;
        node.currentStroke = [];

        const pointer = canvas.getPointer(options.e);
        const pressure = options.e.pressure || 1.0;
        node.currentStroke.push({ x: pointer.x, y: pointer.y, pressure });
    });

    // Mouse move
    canvas.on('mouse:move', (options) => {
        if (!node.isDrawing) return;

        const pointer = canvas.getPointer(options.e);
        const pressure = options.e.pressure || 1.0;
        node.currentStroke.push({ x: pointer.x, y: pointer.y, pressure });

        // Draw preview on fabric canvas
        if (node.currentStroke.length > 1) {
            const layer = node.layerManager.getActiveLayer();
            if (!layer) return;

            const ctx = canvas.getContext();
            const p1 = node.currentStroke[node.currentStroke.length - 2];
            const p2 = node.currentStroke[node.currentStroke.length - 1];

            if (node.currentTool === "brush") {
                const color = hexToRgba(node.brushColor, node.brushOpacity);
                const pressure1 = Math.pow(p1.pressure, 1 / node.pressureSensitivity);
                const pressure2 = Math.pow(p2.pressure, 1 / node.pressureSensitivity);
                const avgPressure = (pressure1 + pressure2) / 2;
                const width = Math.max(1, node.brushSize * avgPressure);

                ctx.strokeStyle = color;
                ctx.lineWidth = width;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
    });

    // Mouse up
    canvas.on('mouse:up', () => {
        if (!node.isDrawing) return;
        node.isDrawing = false;

        const layer = node.layerManager.getActiveLayer();
        if (!layer || node.currentStroke.length < 2) return;

        // Commit stroke to layer
        if (node.currentTool === "brush") {
            const color = hexToRgba(node.brushColor, node.brushOpacity);
            layer.drawStroke(node.currentStroke, color, node.brushSize, node.pressureSensitivity);
        } else if (node.currentTool === "eraser") {
            layer.erase(node.currentStroke, node.brushSize);
        }

        // Update composite and save history
        node.layerManager.updateComposite();
        node.historyManager.saveState();

        node.currentStroke = [];
    });
}

/**
 * Initialize fabric canvas
 */
function initializeFabricCanvas(canvasElement, width, height, node) {
    const fabricCanvas = new fabric.Canvas(canvasElement, {
        width: width,
        height: height,
        backgroundColor: "#ffffff",
        selection: false,
        enableRetinaScaling: true
    });

    // Store node reference
    fabricCanvas.node = node;

    return fabricCanvas;
}

/**
 * Add image to active layer
 */
function addImageToCanvas(node, imageUrl) {
    const img = new Image();
    img.onload = () => {
        const layer = node.layerManager.getActiveLayer();
        if (!layer) return;

        const canvas = layer.canvas;
        const ctx = layer.ctx;

        // Scale image to fit if too large
        const maxWidth = canvas.width * 0.8;
        const maxHeight = canvas.height * 0.8;

        let drawWidth = img.width;
        let drawHeight = img.height;

        if (img.width > maxWidth || img.height > maxHeight) {
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
            drawWidth = img.width * scale;
            drawHeight = img.height * scale;
        }

        // Center image
        const x = (canvas.width - drawWidth) / 2;
        const y = (canvas.height - drawHeight) / 2;

        ctx.drawImage(img, x, y, drawWidth, drawHeight);

        node.layerManager.updateComposite();
        node.historyManager.saveState();

        // Update layer panel after adding image
        setTimeout(() => {
            updateLayerPanel(node);
        }, 50);
    };
    img.src = imageUrl;
}

/**
 * Resize canvas and preserve content
 */
function resizeCanvas(node, width, height) {
    // Resize all layers
    node.layerManager.resizeAll(width, height);

    // Resize fabric canvas
    node.fabricCanvas.setWidth(width);
    node.fabricCanvas.setHeight(height);

    // Calculate display size
    const { displayWidth, displayHeight } = calculateDisplaySize(width, height, MAX_DISPLAY_SIZE);

    // Set wrapper sizes
    node.fabricCanvas.wrapperEl.style.width = displayWidth + "px";
    node.fabricCanvas.wrapperEl.style.height = displayHeight + "px";

    // Update composite
    node.layerManager.updateComposite();
}

/**
 * Export canvas with alpha
 */
function exportCanvasWithAlpha(node) {
    // Create composite of all visible layers
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = node.fabricCanvas.width;
    compositeCanvas.height = node.fabricCanvas.height;
    const ctx = compositeCanvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

    // Draw all visible layers
    for (const layer of node.layerManager.layers) {
        if (layer.visible) {
            ctx.globalAlpha = layer.opacity;
            ctx.drawImage(layer.canvas, 0, 0);
        }
    }

    return compositeCanvas.toDataURL('image/png');
}

// Handle input image from Python
api.addEventListener("cbcanvas_get_image", ({ detail }) => {
    const { unique_id, images } = detail;
    const node = canvasInstances[unique_id];

    if (!node || !images || images.length === 0) return;

    // Load first image to active layer
    const img = new Image();
    img.onload = () => {
        const layer = node.layerManager.getActiveLayer();
        if (!layer) return;

        const ctx = layer.ctx;
        ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

        // Draw image centered and scaled to fit
        const scale = Math.min(
            layer.canvas.width / img.width,
            layer.canvas.height / img.height
        );
        const x = (layer.canvas.width - img.width * scale) / 2;
        const y = (layer.canvas.height - img.height * scale) / 2;

        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        node.layerManager.updateComposite();
        node.historyManager.saveState();

        // Notify Python that canvas has been updated
        api.fetchApi("/cbcanvas/check_canvas_changed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ unique_id, is_ok: true })
        });
    };
    img.src = images[0];
});

// Register extension
app.registerExtension({
    name: extensionName,

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "CBCanvasNode") {
            console.log("CBCanvas Enhanced: Registering layer-based drawing system");

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

                // Create container
                const container = document.createElement("div");
                container.className = "cbcanvas-enhanced-container";

                // Create toolbar
                const toolbar = createToolbar(this);
                container.appendChild(toolbar);

                // Create main content area with canvas and layers
                const contentArea = document.createElement("div");
                contentArea.className = "cbcanvas-content-area";

                // Create canvas wrapper
                const canvasWrapper = document.createElement("div");
                canvasWrapper.className = "cbcanvas-canvas-wrapper";

                // Create canvas element
                const canvasElement = document.createElement("canvas");
                canvasElement.id = `cbcanvas-${this.id}`;

                // Initialize fabric canvas
                this.fabricCanvas = initializeFabricCanvas(canvasElement, initialInfo.width, initialInfo.height, this);

                // Initialize layer system
                this.layerManager = new LayerManager(this.fabricCanvas);

                // Initialize history manager
                this.historyManager = new HistoryManager(this.layerManager);

                // Setup drawing handlers
                setupDrawingHandlers(this);

                // Set display size
                const { displayWidth, displayHeight } = calculateDisplaySize(
                    initialInfo.width, initialInfo.height, MAX_DISPLAY_SIZE
                );

                this.fabricCanvas.wrapperEl.style.width = displayWidth + "px";
                this.fabricCanvas.wrapperEl.style.height = displayHeight + "px";

                canvasWrapper.appendChild(this.fabricCanvas.wrapperEl);
                contentArea.appendChild(canvasWrapper);

                // Create layer panel
                const layerPanel = createLayerPanel(this);
                contentArea.appendChild(layerPanel);

                container.appendChild(contentArea);

                // Add to node
                this.addDOMWidget("canvas", "layercanvas", container);

                // Store instance
                canvasInstances[this.id] = this;

                // Add hidden widget to store canvas data
                const canvasDataWidget = this.addCustomWidget({
                    name: "canvas_data",
                    type: "hidden_canvas_data",
                    value: "",
                    options: { serialize: true }
                });

                // Update canvas data widget when canvas changes
                const updateCanvasData = () => {
                    if (this.layerManager) {
                        const canvasData = exportCanvasWithAlpha(this);
                        canvasDataWidget.value = canvasData;

                        // Send to Python instance
                        api.fetchApi("/cbcanvas/update_canvas_data", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                unique_id: this.id,
                                canvas_data: canvasData
                            })
                        }).catch(err => {
                            console.error("CBCanvas: Failed to update canvas data:", err);
                        });
                    }
                };

                // Store update function on node
                this.updateCanvasData = updateCanvasData;

                // Update layer panel after DOM is ready
                setTimeout(() => {
                    updateLayerPanel(this);
                }, 100);

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

                // Load initial image to canvas if 'image' widget has a value
                const imageWidget = this.widgets?.find(w => w.name === "image");
                if (imageWidget && imageWidget.value) {
                    // Wait a bit for everything to initialize
                    setTimeout(() => {
                        const imagePath = `/view?filename=${imageWidget.value}&type=input`;
                        fetch(imagePath)
                            .then(response => response.blob())
                            .then(blob => {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    addImageToCanvas(this, e.target.result);
                                    console.log("CBCanvas: Initial image loaded to canvas");
                                };
                                reader.readAsDataURL(blob);
                            })
                            .catch(err => console.error("CBCanvas: Failed to load initial image:", err));
                    }, 500);
                }

                console.log("CBCanvas Enhanced: Layer system initialized");
                return result;
            };

            // Handle node removal
            const onRemoved = nodeType.prototype.onRemoved;
            nodeType.prototype.onRemoved = function () {
                if (canvasInstances[this.id]) {
                    if (this.fabricCanvas) {
                        this.fabricCanvas.dispose();
                    }
                    delete canvasInstances[this.id];
                }
                return onRemoved?.apply(this, arguments);
            };

            // Before queuing prompt, send canvas data to Python
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                const result = onExecuted?.apply(this, arguments);

                // Push latest canvas snapshot before execution completes
                if (typeof this.updateCanvasData === "function") {
                    this.updateCanvasData();
                }

                return result;
            };

            // Handle serialization
            const onSerialize = nodeType.prototype.onSerialize;
            nodeType.prototype.onSerialize = function (o) {
                const result = onSerialize?.apply(this, arguments);
                if (this.layerManager) {
                    o.canvas_data = exportCanvasWithAlpha(this);
                    o.layer_data = JSON.stringify(this.layerManager.toJSON());
                }
                return result;
            };

            // Handle deserialization
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (o) {
                const result = onConfigure?.apply(this, arguments);

                if (o.layer_data && this.layerManager) {
                    try {
                        this.layerManager.fromJSON(JSON.parse(o.layer_data), () => {
                            setTimeout(() => {
                                updateLayerPanel(this);
                                console.log("CBCanvas Enhanced: Layers restored");
                            }, 100);
                        });
                    } catch (e) {
                        console.error("CBCanvas Enhanced: Failed to restore layers", e);
                    }
                }

                return result;
            };
        }
    }
});

console.log("CBCanvas Enhanced: Loaded with Photoshop-like layer system");
