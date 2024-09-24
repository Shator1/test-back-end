import puppeteer from 'puppeteer';
import fs from 'fs-extra';

// This function will ensure Chromium is installed properly
const ensureChromiumInstalled = async () => {
  try {
    console.log('Checking Chromium installation...');
    await puppeteer.executablePath();
  } catch (error) {
    console.log('Chromium not found. Installing...');
    await puppeteer.install();
  }
};

// Render skin and overlay with Puppeteer and Skinview3D
const renderSkin3D = async (skinUrl, overlayUrl) => {
  await ensureChromiumInstalled();  // Ensure Chromium is installed

  const browser = await puppeteer.launch({
    headless: true,  // Render without showing the browser
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blacklist',
      '--disable-software-rasterizer',
      '--use-gl=egl'
    ]
  });

  const page = await browser.newPage();
  
  // Log browser console errors for debugging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Skin Render</title>
    </head>
    <body>
      <canvas id="skin-canvas" width="300" height="400"></canvas>
      <script src="https://unpkg.com/skinview3d"></script>
      <script>
        (async () => {
          try {
            const viewer = new skinview3d.SkinViewer({
              canvas: document.getElementById("skin-canvas"),
              width: 300,
              height: 400,
            });

            // Load skin from URL
            await viewer.loadSkin("${skinUrl}");

            // Load overlay (if any)
            if ("${overlayUrl}") {
              const overlayImage = new Image();
              overlayImage.src = "${overlayUrl}";
              overlayImage.onload = () => {
                viewer.loadOverlay(overlayImage);
              };
            }

            // Render the skin
            viewer.camera.rotation.x = -0.1;
            viewer.camera.rotation.y = 0.5;
            viewer.render();

          } catch (error) {
            console.error('Rendering error:', error);
          }
        })();
      </script>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);

  // Take a screenshot of the rendered skin
  const screenshotBuffer = await page.screenshot({
    clip: { x: 0, y: 0, width: 300, height: 400 }
  });

  await browser.close();
  return screenshotBuffer;
};
