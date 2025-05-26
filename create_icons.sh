#!/bin/bash

# Create icons directory
mkdir -p src/assets/icons

# Base64 encoded 16x16 PNG icon (sparkle emoji on gradient background)
icon_16_base64="iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEoSURBVDiNpZOxSgNBEIa/2b2LN5eYRBQsRLAQG0EQLLTyAWy18gF8BVvfwEewsBQLQbAQBEEQBEEQJCqaizdnd7ez2VkLuVzORP/qn5n5/h1mBqSUGABSSgAMw5Crqyu22+2+hNfrNW63W5jNZiiKAkEQIAgCCCFgGAbOz89xcHCAIAh6E1yv17DZbGAYBqIoQpqm8DwPrutiOBzCsixEUYRPp9NBu912E5IkgWmaEEJASom6rnF3d4fLy0uMRiOkaQohBIIggGEYKMsSzjAMsLu7i6enJxRFgaqqMJlMsLm5iePjY9zf38P3fQRBgLquYVkWnHEc4/HxEa7rYjweY2FhAScnJzBNE1VVIc9zCCHQbreRJAnOKpUKDg8PcXNzA8dxsLS0hFb7H38FKADfWBZkUQAAAABJRU5ErkJggg=="

# Create 16x16 icons
echo $icon_16_base64 | base64 -d > src/assets/icons/icon-16.png
echo $icon_16_base64 | base64 -d > src/assets/icons/icon-green-16.png
echo $icon_16_base64 | base64 -d > src/assets/icons/icon-red-16.png

# For simplicity, we'll copy the same icon for other sizes
# In a real scenario, you'd create properly sized icons
cp src/assets/icons/icon-16.png src/assets/icons/icon-32.png
cp src/assets/icons/icon-16.png src/assets/icons/icon-48.png
cp src/assets/icons/icon-16.png src/assets/icons/icon-128.png

cp src/assets/icons/icon-16.png src/assets/icons/icon-green-32.png
cp src/assets/icons/icon-16.png src/assets/icons/icon-green-48.png
cp src/assets/icons/icon-16.png src/assets/icons/icon-green-128.png

cp src/assets/icons/icon-16.png src/assets/icons/icon-red-32.png
cp src/assets/icons/icon-16.png src/assets/icons/icon-red-48.png
cp src/assets/icons/icon-16.png src/assets/icons/icon-red-128.png

echo "Icons created successfully!" 