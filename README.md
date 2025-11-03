# CBCanvas Node for ComfyUI

**Canvas node with intelligent aspect ratio control** - 13 preset aspect ratios from ultra-wide (21:9) to ultra-tall (9:21).

## Features

- 🎨 **Simple Canvas Drawing**: Basic drawing capabilities in the node
- 📐 **13 Aspect Ratio Presets**: Slider-controlled aspect ratios
- 🔄 **Dynamic Resizing**: Canvas resizes with content preservation
- 💾 **Canvas State Saving**: Canvas content saved with workflow
- 🎯 **1:1 Center Point**: Square format (1024x1024) as reference point

## Aspect Ratio System

The aspect ratio slider ranges from **-6 to +6**, with **0** (1:1) as the center:

### Landscape Formats (Negative Values)
Moving left from center creates wider images:

| Slider | Ratio | Dimensions | Aspect Value |
|--------|-------|------------|--------------|
| -6 | 21:9 | 1536 x 640 | 2.33 |
| -5 | 2:1 | 1440 x 720 | 2.0 |
| -4 | 16:9 | 1344 x 768 | 1.78 |
| -3 | 3:2 | 1216 x 832 | 1.5 |
| -2 | 4:3 | 1152 x 896 | 1.33 |
| -1 | 5:4 | 1144 x 912 | 1.25 |

### Square Format (Center)
| Slider | Ratio | Dimensions | Aspect Value |
|--------|-------|------------|--------------|
| **0** | **1:1** | **1024 x 1024** ⭐ | **1.0** |

### Portrait Formats (Positive Values)
Moving right from center creates taller images:

| Slider | Ratio | Dimensions | Aspect Value |
|--------|-------|------------|--------------|
| +1 | 4:5 | 912 x 1144 | 0.8 |
| +2 | 3:4 | 896 x 1152 | 0.75 |
| +3 | 2:3 | 832 x 1216 | 0.67 |
| +4 | 9:16 | 768 x 1344 | 0.56 |
| +5 | 1:2 | 720 x 1440 | 0.5 |
| +6 | 9:21 | 640 x 1536 | 0.43 |

## Installation

1. Clone this repository into your ComfyUI custom_nodes folder:
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/yourusername/Comfyui-CBcanvas.git
```

2. Restart ComfyUI

3. The node will appear in **Add Node → CBCanvas → CB Canvas Node 🎨**

## Usage

### Basic Usage

1. Add **CB Canvas Node** to your workflow
2. Adjust the **aspect_ratio_slider** (-6 to +6)
3. Draw on the canvas
4. Use **Clear Canvas** button to reset
5. Connect outputs to other nodes

### Node Outputs

| Output | Type | Description |
|--------|------|-------------|
| image | IMAGE | Canvas content as image tensor |
| mask | MASK | Alpha channel mask |
| width | INT | Canvas width in pixels |
| height | INT | Canvas height in pixels |
| aspect_ratio | STRING | Ratio string (e.g., "16:9") |

### Node Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| aspect_ratio_slider | INT | Yes | Slider from -6 to +6 |
| input_image | IMAGE | Optional | Input image to load |
| update_canvas | BOOLEAN | Optional | Update canvas with input |

## Use Cases

### Ultra-Wide Cinematic (21:9)
- Cinematic compositions
- Panoramic landscapes
- Wide-screen content

### Widescreen (16:9)
- Standard video format
- Landscape photography
- Desktop wallpapers

### Classic Photo (3:2, 4:3)
- Traditional photography
- Print formats
- Balanced compositions

### Square (1:1)
- Social media (Instagram)
- Profile pictures
- Balanced artwork

### Portrait (4:5, 9:16)
- Mobile content
- Vertical videos
- Stories format

### Ultra-Tall (9:21)
- Vertical scrolling
- Mobile-first designs
- Long-form content

## Tips

1. **Start with 1:1** - Use the center position as your reference
2. **Preserve Content** - Canvas content scales when changing ratios
3. **Use Width/Height Outputs** - Connect to other nodes for consistency
4. **Save Workflows** - Canvas content is saved with workflow

## Technical Details

- **Base Resolution**: 1024x1024 (1:1 format)
- **Total Pixel Range**: ~655K to 983K pixels
- **Canvas Format**: RGBA with alpha channel
- **Drawing**: Basic mouse-based drawing
- **Storage**: Canvas saved as base64 in workflow

## Comparison with PainterNode

CBCanvas is inspired by PainterNode but simplified:

| Feature | PainterNode | CBCanvas |
|---------|-------------|----------|
| Drawing Tools | Full brush system | Basic drawing |
| Canvas Control | Advanced | Simple |
| Aspect Ratios | Manual entry | 13 presets |
| Complexity | High | Low |
| Use Case | Advanced painting | Quick canvas setup |

## Future Enhancements

Planned features:
- [ ] Advanced drawing tools (brushes, shapes)
- [ ] Color picker
- [ ] Layer support
- [ ] Undo/Redo
- [ ] Custom aspect ratios
- [ ] Image import/export
- [ ] Grid overlay
- [ ] Symmetry tools

## Credits

- Inspired by [PainterNode](https://github.com/AlekPet/ComfyUI_Custom_Nodes_AlekPet) by AlekPet
- Built for the ComfyUI community

## License

MIT License

## Support

For issues and feature requests, please visit the GitHub repository.

## Version History

### v1.0.0 (2025-01-03)
- Initial release
- 13 aspect ratio presets
- Basic canvas drawing
- Canvas state saving
- Output width, height, and aspect ratio
