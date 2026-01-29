# Extension Icons

This directory should contain the following icon files for the DocuSynth AI Chrome extension:

## Required Icons

| Filename | Size | Usage |
|----------|------|-------|
| `icon16.png` | 16x16 | Favicon, toolbar icon (small) |
| `icon32.png` | 32x32 | Windows taskbar |
| `icon48.png` | 48x48 | Extensions management page |
| `icon128.png` | 128x128 | Chrome Web Store, installation dialog |

## Design Guidelines

The icon should represent documentation/AI synthesis. Suggested design elements:

- **Primary Color**: #3b82f6 (Blue-500)
- **Secondary Color**: #6366f1 (Indigo-500)
- **Style**: Modern, flat design with subtle gradients
- **Symbol**: Document icon with AI/lightning bolt element

## Creating Icons

You can create icons using any image editor. Here are some options:

### Option 1: Use an online tool
- [Figma](https://figma.com) - Free design tool
- [Canva](https://canva.com) - Easy icon creation
- [IconKitchen](https://icon.kitchen) - Android/Chrome icon generator

### Option 2: SVG to PNG conversion
Create an SVG icon and convert to required sizes:

```bash
# Using ImageMagick
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 32x32 icon32.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

### Option 3: Use placeholder icons
For development, you can generate simple placeholder icons:

```javascript
// Run in browser console to generate placeholder
function generateIcon(size, color = '#3b82f6') {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.15);
  ctx.fill();

  // Document symbol
  ctx.fillStyle = 'white';
  const margin = size * 0.2;
  const docWidth = size * 0.5;
  const docHeight = size * 0.6;
  ctx.fillRect(margin, margin, docWidth, docHeight);

  // Lines
  ctx.fillStyle = color;
  const lineMargin = margin + size * 0.08;
  const lineWidth = docWidth - size * 0.16;
  const lineHeight = size * 0.05;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(lineMargin, margin + size * 0.15 + i * size * 0.12, lineWidth, lineHeight);
  }

  return canvas.toDataURL('image/png');
}

// Generate and download
[16, 32, 48, 128].forEach(size => {
  const link = document.createElement('a');
  link.download = `icon${size}.png`;
  link.href = generateIcon(size);
  link.click();
});
```

## Placeholder Icons Included

For immediate development use, you can create simple placeholder icons. The extension will work with any valid PNG images in the required sizes.
