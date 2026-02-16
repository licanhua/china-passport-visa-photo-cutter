# Chinese Passport & Visa Photo Cutter

Static web app for GitHub Pages that lets users:
- Upload and align a photo against a built-in Chinese photo reference guide.
- Export a digital JPEG exactly `387 x 516` px.
- Export printable JPEG sheets for `4 x 6` and `5 x 7` with evenly distributed copies.

## Why this project was created
With AI tools, it is easy to generate a white-background portrait image.  
What is still hard is cutting that image to the correct size and framing required by Chinese visa or passport photo rules.

This project provides an easy way to:
- Crop and align to the right size.
- Download a digital photo for online visa submission.
- Download printable photo sheets for physical use.

## Links
- GitHub source code: https://github.com/licanhua/china-passport-visa-photo-cutter.git
- GitHub Pages cutter: https://licanhua.github.io/china-passport-visa-photo-cutter/
- YouTube demo placeholder: https://www.youtube.com/watch?v=YOUR_VIDEO_ID

## Features
- Crop ratio fixed to Chinese photo ratio `33mm x 48mm`.
- 50% transparent overlay editor for precise fitting against reference guide.
- Drag to move and slider/mouse wheel to scale.
- White background enforced in final outputs.
- Custom print DPI input (`150-600`).

## Run locally
Open `index.html` directly in a browser.

## Deploy to GitHub Pages
1. Push these files to your GitHub repository root.
2. In GitHub repository settings, open **Pages**.
3. Set source to **Deploy from a branch**.
4. Choose branch `main` and folder `/ (root)`.
5. Save and wait for publish.

## Output files
- Digital: `photo-digital-387x516.jpg`
- Print 4x6: `photo-print-4x6-<dpi>dpi.jpg`
- Print 5x7: `photo-print-5x7-<dpi>dpi.jpg`
