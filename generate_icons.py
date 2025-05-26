#!/usr/bin/env python3
"""Generate SVG icons for the AI Reply Assistant extension."""

import os

# Icon sizes
sizes = [16, 32, 48, 128]

# SVG template for the icon
def generate_svg(size, color):
    return f'''<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad{size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" rx="{size//4}" fill="{color}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="{size//2}" fill="white">✨</text>
</svg>'''

# Create icons directory if it doesn't exist
os.makedirs('src/assets/icons', exist_ok=True)

# Generate icons
for size in sizes:
    # Normal icon (gradient)
    svg_content = generate_svg(size, 'url(#grad' + str(size) + ')')
    filename = f'src/assets/icons/icon-{size}.svg'
    with open(filename, 'w') as f:
        f.write(svg_content)
    print(f'Created {filename}')
    
    # Red icon (not configured)
    svg_content_red = generate_svg(size, '#ef4444')
    filename_red = f'src/assets/icons/icon-red-{size}.svg'
    with open(filename_red, 'w') as f:
        f.write(svg_content_red)
    print(f'Created {filename_red}')
    
    # Green icon (configured)
    svg_content_green = generate_svg(size, '#10b981')
    filename_green = f'src/assets/icons/icon-green-{size}.svg'
    with open(filename_green, 'w') as f:
        f.write(svg_content_green)
    print(f'Created {filename_green}')

print('\nAll icons generated successfully!') 