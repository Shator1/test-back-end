import express from 'express';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

// Set up Express app
const app = express();

// Enable CORS for your frontend
app.use(cors({
  origin: '*'  // Adjust this to restrict access to specific origins if necessary
}));

// Set up __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up storage for file uploads (for custom Minecraft skins)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Handle file uploads and return the file URL
app.post('/upload', upload.single('skin'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Serve the uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Function to render skin and overlay with Puppeteer and Skinview3D
const renderSkin3D = async (skinUrl, overlayUrl) => {
  const browser = await puppeteer.launch({
    headless: true,  // Render without showing the browser
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',  // Enable WebGL for rendering
      '--ignore-gpu-blacklist',
      '--disable-software-rasterizer',
      '--use-gl=egl'  // Ensure WebGL is working in Puppeteer
    ]
  });

  const page = await browser.newPage();

  // Log browser console errors for debugging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  // HTML for Puppeteer page
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

// API endpoint to render the skin
app.get('/render-skin/:overlayId', async (req, res) => {
  const overlayId = req.params.overlayId;
  const username = req.query.username || 'iiShator';
  
  const skinUrl = `https://mc-heads.net/skin/${username}`;
  const overlayPath = path.join(__dirname, 'overlays', `${overlayId}.png`);

  try {
    const renderedImage = await renderSkin3D(skinUrl, overlayPath);
    res.setHeader('Content-Type', 'image/png');
    res.send(renderedImage);
  } catch (error) {
    console.error('Rendering error:', error);
    res.status(500).send('Error rendering skin');
  }
});

// Use the correct port for Render deployment
const PORT = process.env.PORT || 3000;  // Use Render's provided port or default to 3000

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
