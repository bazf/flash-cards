#!/usr/bin/env python3
"""
Generate simple icons for the FlashCards PWA.
Run this once to create icons/icon-192.png and icons/icon-512.png
"""

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Error: Pillow not installed. Install with: pip install Pillow")
    exit(1)

def create_icon(size):
    """Create a simple flashcard icon."""
    # Create image with blue gradient background
    img = Image.new('RGB', (size, size), color=(37, 99, 235))  # #2563eb
    draw = ImageDraw.Draw(img)

    # Draw a simple card outline (white rectangle)
    margin = int(size * 0.1)
    draw.rectangle(
        [(margin, margin), (size - margin, size - margin)],
        fill=(255, 255, 255),
        outline=(37, 99, 235),
        width=int(size * 0.02)
    )

    # Draw a simple line to represent text
    line_y = int(size * 0.45)
    draw.line(
        [(margin * 2, line_y), (size - margin * 2, line_y)],
        fill=(37, 99, 235),
        width=int(size * 0.015)
    )

    # Draw two more lines
    for offset in [int(size * 0.08), int(size * 0.16)]:
        draw.line(
            [(margin * 2, line_y + offset), (size - margin * 2, line_y + offset)],
            fill=(100, 116, 139),
            width=int(size * 0.015)
        )

    return img

# Create icons
print("Generating icon-192.png...")
icon_192 = create_icon(192)
icon_192.save('src/icons/icon-192.png')
print("Created: src/icons/icon-192.png")

print("Generating icon-512.png...")
icon_512 = create_icon(512)
icon_512.save('src/icons/icon-512.png')
print("Created: src/icons/icon-512.png")

print("\nIcons generated successfully!")
