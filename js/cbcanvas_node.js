/**
 * CBCanvas Node Enhanced - With Brush, Eraser, Layers, and Transform
 * Full-featured canvas with fabric.js
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
 * Create toolbar with brush, eraser, and tools
 */
function createToolbar(node) {
    const toolbar = document.createElement("div");
    toolbar.className = "cbcanvas-toolbar";

    // Current tool state
    node.currentTool = "brush";
    node.brushSize = 5;
    node.brushColor = "#000000";

    // Tool buttons
    const tools = [
        { id: "brush", icon: "✏️", label: "Brush" },
        { id: "eraser", icon: "🧹", label: "Eraser" },
        { id: "select", icon: "↖️", label: "Select/Move" },
        { id: "clear", icon: "🗑️", label: "Clear All" }
    ];

    tools.forEach(tool => {
        const btn = document.createElement("button");
        btn.className = "cbcanvas-tool-btn";
        btn.title = tool.label;
        btn.innerHTML = `${tool.icon}<br><span>${tool.label}</span>`;

        if (tool.id === node.currentTool) {
            btn.classList.add("active");
        }

        btn.onclick = () => {
            // Remove active from all buttons
            toolbar.querySelectorAll(".cbcanvas-tool-btn").forEach(b => b.classList.remove("active"));

            if (tool.id === "clear") {
                // Clear canvas
                if (confirm("Clear all canvas content?")) {
                    node.fabricCanvas.clear();
                    node.fabricCanvas.backgroundColor = "#ffffff";
                    node.fabricCanvas.renderAll();
                }
                return;
            }

            btn.classList.add("active");
            node.currentTool = tool.id;
            updateCanvasMode(node);
        };

        toolbar.appendChild(btn);
    });

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
    };
    toolbar.appendChild(sizeControl);

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
    };
    toolbar.appendChild(colorControl);

    return toolbar;
}

/**
 * Update canvas mode based on current tool
 */
function updateCanvasMode(node) {
    const canvas = node.fabricCanvas;

    // Store current tool on canvas for path:created event
    canvas._currentTool = node.currentTool;

    // Disable drawing mode first for clean state
    canvas.isDrawingMode = false;

    switch (node.currentTool) {
        case "brush":
            // Always create a fresh PencilBrush instance when switching to brush
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.color = node.brushColor;
            canvas.freeDrawingBrush.width = node.brushSize;
            canvas.isDrawingMode = true;
            canvas.selection = false;
            canvas.forEachObject(obj => {
                obj.selectable = false;
                obj.evented = false;
            });
            break;

        case "eraser":
            // Create fresh EraserBrush instance
            canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
            canvas.freeDrawingBrush.width = node.brushSize;
            canvas.isDrawingMode = true;
            canvas.selection = false;
            canvas.forEachObject(obj => {
                obj.selectable = false;
                obj.evented = false;
            });
            break;

        case "select":
            canvas.isDrawingMode = false;
            canvas.selection = true;
            // Make ALL existing objects selectable
            canvas.forEachObject(obj => {
                obj.selectable = true;
                obj.evented = true;
            });
            break;
    }

    canvas.renderAll();
}

/**
 * Update brush settings
 */
function updateBrushSettings(node) {
    const canvas = node.fabricCanvas;

    // Apply settings immediately to current tool
    if (node.currentTool === "brush" || node.currentTool === "eraser") {
        // Recreate the brush with new settings to ensure immediate application
        if (node.currentTool === "brush") {
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.color = node.brushColor;
            canvas.freeDrawingBrush.width = node.brushSize;
        } else if (node.currentTool === "eraser") {
            canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
            canvas.freeDrawingBrush.width = node.brushSize;
        }

        // Ensure drawing mode is still active
        if (!canvas.isDrawingMode) {
            canvas.isDrawingMode = true;
        }
    }
}

/**
 * Initialize fabric canvas
 */
function initializeFabricCanvas(canvasElement, width, height) {
    const fabricCanvas = new fabric.Canvas(canvasElement, {
        width: width,
        height: height,
        backgroundColor: "#ffffff",
        isDrawingMode: true,
        enableRetinaScaling: true,
        selection: false
    });

    // Setup drawing brush
    fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.color = "#000000";
    fabricCanvas.freeDrawingBrush.width = 5;

    // Ensure fabric commits the path immediately for visual feedback
    fabricCanvas.on("path:created", (e) => {
        // Make newly created paths selectable if in select mode
        if (e.path && fabricCanvas._currentTool === "select") {
            e.path.selectable = true;
            e.path.evented = true;
        }
        fabricCanvas.renderAll();
    });

    // Store reference to current tool on canvas
    fabricCanvas._currentTool = "brush";

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

    // Set wrapper size (important!)
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
            console.log("CBCanvas Enhanced: Registering with fabric.js");

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
                // Ensure wrapper hugs the canvas while staying centered
                canvasWrapper.style.display = "inline-flex";
                canvasWrapper.style.margin = "0 auto 10px";
                canvasWrapper.style.width = "fit-content";
                canvasWrapper.style.maxWidth = "100%";

                // Create canvas element
                const canvasElement = document.createElement("canvas");
                canvasElement.id = `cbcanvas-${this.id}`;

                // Initialize fabric canvas
                this.fabricCanvas = initializeFabricCanvas(canvasElement, initialInfo.width, initialInfo.height);

                // Set display size
                const { displayWidth, displayHeight } = calculateDisplaySize(
                    initialInfo.width, initialInfo.height, MAX_DISPLAY_SIZE
                );

                // Set wrapper size (important!)
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

                console.log("CBCanvas Enhanced: Node created successfully");
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

console.log("CBCanvas Enhanced: Extension loaded with fabric.js");

