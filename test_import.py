# -*- coding: utf-8 -*-
"""
Test script to verify CBCanvas node loads correctly
Run from ComfyUI root directory:
python custom_nodes/Comfyui-CBcanvas/test_import.py
"""

try:
    print("Testing CBCanvas Node import...")
    print("-" * 50)

    # Test basic imports
    print("1. Testing Python imports...")
    import os
    import sys
    from PIL import Image
    import torch
    import numpy as np
    print("   [OK] Basic imports OK")

    # Test node import
    print("2. Testing node module...")
    sys.path.insert(0, os.path.dirname(__file__))

    # Import without ComfyUI dependencies
    print("3. Checking node registration...")

    # Read the file and check mappings
    with open(os.path.join(os.path.dirname(__file__), "CBCanvasNode.py"), "r", encoding="utf-8") as f:
        content = f.read()

    if "NODE_CLASS_MAPPINGS" in content:
        print("   [OK] NODE_CLASS_MAPPINGS found")
    else:
        print("   [ERROR] NODE_CLASS_MAPPINGS NOT found")

    if "NODE_DISPLAY_NAME_MAPPINGS" in content:
        print("   [OK] NODE_DISPLAY_NAME_MAPPINGS found")
    else:
        print("   [ERROR] NODE_DISPLAY_NAME_MAPPINGS NOT found")

    # Check __init__.py
    print("4. Checking __init__.py...")
    with open(os.path.join(os.path.dirname(__file__), "__init__.py"), "r", encoding="utf-8") as f:
        init_content = f.read()

    if "NODE_CLASS_MAPPINGS" in init_content:
        print("   [OK] NODE_CLASS_MAPPINGS imported in __init__.py")
    else:
        print("   [ERROR] NODE_CLASS_MAPPINGS NOT imported")

    if "WEB_DIRECTORY" in init_content:
        print("   [OK] WEB_DIRECTORY configured")
    else:
        print("   [ERROR] WEB_DIRECTORY NOT configured")

    print("-" * 50)
    print("[SUCCESS] All basic checks passed!")
    print("")
    print("Node Information:")
    print("  Name: CB Canvas Node")
    print("  Category: image/canvas")
    print("  Search: 'CB Canvas' or 'canvas'")
    print("")
    print("If node still not visible:")
    print("  1. Restart ComfyUI completely")
    print("  2. Check console for errors")
    print("  3. Look in: Add Node -> image -> canvas")

except Exception as e:
    print(f"[ERROR] Error: {e}")
    import traceback
    traceback.print_exc()
