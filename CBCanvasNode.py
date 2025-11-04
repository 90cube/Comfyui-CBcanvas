import hashlib
import os
import json
from server import PromptServer
from aiohttp import web
import base64
from io import BytesIO
import time
from PIL import Image, ImageOps, ImageSequence, ImageDraw
import torch
import numpy as np

import folder_paths
import node_helpers

# Directory node save settings
CHUNK_SIZE = 1024
dir_cbcanvas_node = os.path.dirname(__file__)
extension_path = os.path.join(os.path.abspath(dir_cbcanvas_node))
nodes_settings_path = os.path.join(extension_path, "settings_nodes")

# Create directory settings_nodes if not exists
if not os.path.exists(nodes_settings_path):
    os.mkdir(nodes_settings_path)
    tipsfile = os.path.join(nodes_settings_path, "Stores CBCanvas nodes settings.txt")
    with open(tipsfile, "w+", encoding="utf-8") as f:
        f.write("CBCanvas node saved settings!")

# Aspect ratio presets
ASPECT_RATIOS = {
    -6: {"ratio": "21:9", "width": 1536, "height": 640, "value": 2.33},
    -5: {"ratio": "2:1", "width": 1440, "height": 720, "value": 2.0},
    -4: {"ratio": "16:9", "width": 1344, "height": 768, "value": 1.78},
    -3: {"ratio": "3:2", "width": 1216, "height": 832, "value": 1.5},
    -2: {"ratio": "4:3", "width": 1152, "height": 896, "value": 1.33},
    -1: {"ratio": "5:4", "width": 1144, "height": 912, "value": 1.25},
    0: {"ratio": "1:1", "width": 1024, "height": 1024, "value": 1.0},  # Center
    1: {"ratio": "4:5", "width": 912, "height": 1144, "value": 0.8},
    2: {"ratio": "3:4", "width": 896, "height": 1152, "value": 0.75},
    3: {"ratio": "2:3", "width": 832, "height": 1216, "value": 0.67},
    4: {"ratio": "9:16", "width": 768, "height": 1344, "value": 0.56},
    5: {"ratio": "1:2", "width": 720, "height": 1440, "value": 0.5},
    6: {"ratio": "9:21", "width": 640, "height": 1536, "value": 0.43},
}

# Canvas instances dict
CBCANVAS_DICT = {}

PREFIX = "_setting.json"


def isFileName(filename):
    if (
        not filename
        and filename is not None
        and (type(filename) == str and filename.strip() == "")
    ):
        print("Filename is incorrect")
        return False
    return True


def create_settings_json(filename):
    try:
        json_file = os.path.join(nodes_settings_path, filename)
        if not os.path.isfile(json_file):
            print(f"File settings for '{filename}' is not found! Create file!")
            with open(json_file, "w") as f:
                json.dump({}, f)
    except Exception as e:
        print(f"Error: {e}")


def get_settings_json(filename, notExistCreate=True):
    if not isFileName(filename):
        return {}

    json_file = os.path.join(nodes_settings_path, filename)
    if os.path.isfile(json_file):
        f = open(json_file, "rb")
        try:
            load_data = json.load(f)
            return load_data
        except Exception as e:
            print("Error load json file: ", e)
            if notExistCreate:
                f.close()
                os.remove(json_file)
                create_settings_json(filename)
        finally:
            f.close()
    else:
        create_settings_json(filename)

    return {}


# API Routes
@PromptServer.instance.routes.get("/cbcanvas/loading_node_settings/{nodeName}")
async def loadingSettings(request):
    filename = request.match_info.get("nodeName", None)
    if not isFileName(filename):
        load_data = {}
    else:
        load_data = get_settings_json(filename + PREFIX)
    return web.json_response({"settings_nodes": load_data}, status=200)


@PromptServer.instance.routes.post("/cbcanvas/save_node_settings")
async def saveSettings(request):
    try:
        if not request.content_type.startswith("multipart/"):
            return web.json_response(
                {"error": "multipart/* content type expected"}, status=400
            )

        reader = await request.multipart()
        filename_reader = await reader.next()
        filename = await filename_reader.text()

        data_reader = await reader.next()

        if isFileName(filename):
            filename = filename + PREFIX
            json_file = os.path.join(nodes_settings_path, filename)

            if os.path.isfile(json_file):
                with open(json_file, "wb") as f:
                    while True:
                        chunk = await data_reader.read_chunk(size=CHUNK_SIZE)
                        if not chunk:
                            break
                        f.write(chunk)

                return web.json_response(
                    {"message": "CBCanvas data saved successfully"}, status=200
                )
            else:
                create_settings_json(filename)
                return web.json_response(
                    {"message": "CBCanvas file settings created!"}, status=200
                )
        else:
            raise Exception("Filename is not found or incorrect!")

    except Exception as e:
        print("Error save json file: ", e)
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.post("/cbcanvas/check_canvas_changed")
async def check_canvas_changed(request):
    json_data = await request.json()
    unique_id = json_data.get("unique_id", None)
    is_ok = json_data.get("is_ok", False)

    if unique_id is not None and unique_id in CBCANVAS_DICT and is_ok == True:
        CBCANVAS_DICT[unique_id].canvas_set = True
        return web.json_response({"status": "Ok"}, status=200)

    return web.json_response({"status": "Error"}, status=200)


@PromptServer.instance.routes.post("/cbcanvas/update_canvas_data")
async def update_canvas_data(request):
    """Receive canvas data from JavaScript"""
    json_data = await request.json()
    unique_id = json_data.get("unique_id", None)
    canvas_data = json_data.get("canvas_data", None)

    if unique_id is not None and unique_id in CBCANVAS_DICT and canvas_data:
        CBCANVAS_DICT[unique_id].canvas_data = canvas_data
        return web.json_response({"status": "Ok"}, status=200)

    return web.json_response({"status": "Error"}, status=200)


def wait_canvas_change(unique_id, time_out=40):
    for _ in range(time_out):
        if (
            hasattr(CBCANVAS_DICT[unique_id], "canvas_set")
            and CBCANVAS_DICT[unique_id].canvas_set == True
        ):
            CBCANVAS_DICT[unique_id].canvas_set = False
            return True
        time.sleep(0.1)
    return False


def toBase64ImgUrl(img):
    bytesIO = BytesIO()
    img.save(bytesIO, format="PNG")
    img_types = bytesIO.getvalue()
    img_base64 = base64.b64encode(img_types)
    return f"data:image/png;base64,{img_base64.decode('utf-8')}"


def create_blank_canvas(width, height, color=(255, 255, 255, 255)):
    """Create a blank canvas with specified dimensions"""
    return Image.new("RGBA", (width, height), color)


class CBCanvasNode:
    """
    Canvas node with aspect ratio slider control
    Aspect ratios from 21:9 (landscape) to 9:21 (portrait)
    Center: 1:1 (1024x1024)
    """

    @classmethod
    def INPUT_TYPES(cls):
        work_dir = folder_paths.get_input_directory()
        imgs = [
            img
            for img in os.listdir(work_dir)
            if os.path.isfile(os.path.join(work_dir, img))
        ]

        return {
            "required": {
                "image": (sorted(imgs),),
                "aspect_ratio_slider": (
                    "INT",
                    {
                        "default": 0,
                        "min": -6,
                        "max": 6,
                        "step": 1,
                        "display": "slider",
                    },
                ),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "canvas_data": "STRING"
            },
            "optional": {
                "input_image": ("IMAGE",),
                "update_canvas": ("BOOLEAN", {"default": True}),
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK", "INT", "INT", "STRING")
    RETURN_NAMES = ("image", "mask", "width", "height", "aspect_ratio")
    FUNCTION = "execute"
    CATEGORY = "image/canvas"
    DESCRIPTION = """
CBCanvas Node - Canvas with Aspect Ratio Control

Aspect Ratio Slider (-6 to +6):
? Negative values: Landscape (wider)
  -6: 21:9 (1536x640)
  -5: 2:1 (1440x720)
  -4: 16:9 (1344x768)
  -3: 3:2 (1216x832)
  -2: 4:3 (1152x896)
  -1: 5:4 (1144x912)

? Center: Square
   0: 1:1 (1024x1024) ?

? Positive values: Portrait (taller)
  +1: 4:5 (912x1144)
  +2: 3:4 (896x1152)
  +3: 2:3 (832x1216)
  +4: 9:16 (768x1344)
  +5: 1:2 (720x1440)
  +6: 9:21 (640x1536)
"""

    def __init__(self):
        self.canvas_set = False

    def execute(
        self, image, aspect_ratio_slider, unique_id, canvas_data="", input_image=None, update_canvas=True
    ):
        # Register instance
        if unique_id not in CBCANVAS_DICT:
            CBCANVAS_DICT[unique_id] = self

        # Get dimensions from aspect ratio slider
        ratio_info = ASPECT_RATIOS.get(aspect_ratio_slider, ASPECT_RATIOS[0])
        width = ratio_info["width"]
        height = ratio_info["height"]
        aspect_ratio_str = ratio_info["ratio"]

        print(
            f"CBCanvas_{unique_id}: Aspect Ratio {aspect_ratio_str} ({width}x{height})"
        )

        # Handle piping input image to canvas
        if update_canvas and input_image is not None:
            input_images = []

            for imgs in input_image:
                # Add alpha channel if not present
                if imgs.shape[2] == 3:
                    imgs = torch.cat([imgs, torch.ones((*imgs.shape[:2], 1))], dim=2)
                i = 255.0 * imgs.cpu().numpy()
                i = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8), mode="RGBA")

                # Resize to match aspect ratio
                i = i.resize((width, height), Image.LANCZOS)
                input_images.append(toBase64ImgUrl(i))

            CBCANVAS_DICT[unique_id].canvas_set = False

            PromptServer.instance.send_sync(
                "cbcanvas_get_image", {"unique_id": unique_id, "images": input_images}
            )

            if not wait_canvas_change(unique_id):
                print(f"CBCanvas_{unique_id}: Failed to send image to canvas!")
            else:
                print(f"CBCanvas_{unique_id}: Image sent to canvas successfully!")

        # Check if we have canvas data (from widget or API)
        final_canvas_data = canvas_data or (hasattr(self, 'canvas_data') and self.canvas_data) or None

        if final_canvas_data:
            try:
                # Decode base64 canvas image
                canvas_data_str = final_canvas_data.split(',')[1] if ',' in final_canvas_data else final_canvas_data
                canvas_bytes = base64.b64decode(canvas_data_str)
                canvas_img = Image.open(BytesIO(canvas_bytes))

                # Convert to RGB and ensure correct size
                canvas_img = canvas_img.convert("RGB")
                if canvas_img.size != (width, height):
                    canvas_img = canvas_img.resize((width, height), Image.LANCZOS)

                # Convert to tensor
                image_np = np.array(canvas_img).astype(np.float32) / 255.0
                output_image = torch.from_numpy(image_np)[None,]

                # Generate mask (all opaque)
                output_mask = torch.zeros((height, width), dtype=torch.float32, device="cpu").unsqueeze(0)

                print(f"CBCanvas_{unique_id}: Using canvas drawing output")
                return (output_image, output_mask, width, height, aspect_ratio_str)

            except Exception as e:
                print(f"CBCanvas_{unique_id}: Error processing canvas data: {e}")
                # Fall through to default image output

        # Default: Load image from file (fallback)
        image_path = folder_paths.get_annotated_filepath(image)
        img = node_helpers.pillow(Image.open, image_path)

        output_images = []
        output_masks = []
        w, h = None, None

        excluded_formats = ['MPO']

        for i in ImageSequence.Iterator(img):
            i = node_helpers.pillow(ImageOps.exif_transpose, i)

            if i.mode == 'I':
                i = i.point(lambda i: i * (1 / 255))

            # Resize to match aspect ratio
            i = i.resize((width, height), Image.LANCZOS)
            canvas_image = i.convert("RGB")

            if len(output_images) == 0:
                w = canvas_image.size[0]
                h = canvas_image.size[1]

            if canvas_image.size[0] != w or canvas_image.size[1] != h:
                continue

            image_np = np.array(canvas_image).astype(np.float32) / 255.0
            image_tensor = torch.from_numpy(image_np)[None,]

            if 'A' in i.getbands():
                mask = np.array(i.getchannel('A')).astype(np.float32) / 255.0
                mask = 1. - torch.from_numpy(mask)
            elif i.mode == 'P' and 'transparency' in i.info:
                mask = np.array(i.convert('RGBA').getchannel('A')).astype(np.float32) / 255.0
                mask = 1. - torch.from_numpy(mask)
            else:
                mask = torch.zeros((height, width), dtype=torch.float32, device="cpu")

            output_images.append(image_tensor)
            output_masks.append(mask.unsqueeze(0))

        if len(output_images) > 1 and img.format not in excluded_formats:
            output_image = torch.cat(output_images, dim=0)
            output_mask = torch.cat(output_masks, dim=0)
        else:
            output_image = output_images[0]
            output_mask = output_masks[0]

        return (output_image, output_mask, width, height, aspect_ratio_str)

    @classmethod
    def IS_CHANGED(
        cls, image, aspect_ratio_slider, unique_id, canvas_data="", input_image=None, update_canvas=True
    ):
        # Force update when canvas data, aspect ratio, or image changes
        m = hashlib.sha256()

        # Include canvas data if present
        if canvas_data:
            m.update(canvas_data.encode())
        else:
            # Fallback to image file hash
            image_path = folder_paths.get_annotated_filepath(image)
            with open(image_path, "rb") as f:
                m.update(f.read())

        m.update(str(aspect_ratio_slider).encode())
        return m.digest().hex()

    @classmethod
    def VALIDATE_INPUTS(
        cls, image, aspect_ratio_slider, unique_id, canvas_data="", input_image=None, update_canvas=True
    ):
        if not folder_paths.exists_annotated_filepath(image):
            return f"Invalid image file: {image}"
        if aspect_ratio_slider not in ASPECT_RATIOS:
            return f"Invalid aspect ratio slider value: {aspect_ratio_slider}"
        return True


# Node registration
NODE_CLASS_MAPPINGS = {"CBCanvasNode": CBCanvasNode}

NODE_DISPLAY_NAME_MAPPINGS = {"CBCanvasNode": "CB Canvas Node 🎨"}
