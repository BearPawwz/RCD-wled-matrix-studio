# WLED Matrix Studio (12×12 Anamorphic Edition)

A responsive Web App & Android PWA for creating pixel art and converting images specifically for **12×12 WLED matrices** with a **144mm × 84mm** physical footprint.

---

## 📐 Why Anamorphic Correction Matters for Your Matrix

Your matrix is built with:
- **Resolution:** 12 LEDs wide × 12 LEDs high (144 LEDs total).
- **Physical Dimensions:** 144 mm wide × 84 mm high.
- **Horizontal Pitch ($P_x$):** $144\text{ mm} / 12 = 12.0\text{ mm}$ between columns.
- **Vertical Pitch ($P_y$):** $84\text{ mm} / 12 = 7.0\text{ mm}$ between rows (tightly spaced along 144 LED/m strip).
- **Pixel Aspect Ratio (PAR):** $\frac{12.0\text{ mm}}{7.0\text{ mm}} \approx 1.714 : 1$.

In standard pixel art software (Aseprite, Photoshop, Piskel), every pixel is rendered as a 1:1 square. If you draw a circle on a 1:1 square grid, it will display on your physical matrix as a **flattened horizontal ellipse**!

**WLED Matrix Studio solves this directly:**
1. **Physical Aspect Ratio Canvas:** Displays pixels with their real-world 1.714:1 rectangular pitch so what you see on screen matches reality.
2. **Anamorphic Circle & Shape Tools:** Circle tools compensate for the 1.714 ratio so circles are physically round on the LEDs.
3. **Anamorphic Image Importer:** Imports and pre-scales any photo, logo, or icon so it doesn't look stretched or squished when shown on your matrix.
4. **Real-World LED Glow Simulator:** Renders realistic circular LEDs, dark PCB gaps, and optical light diffusion.

---

## 🚀 How to Run & Use

### Option 1: Run in Any Browser (Desktop or Android)
Simply open `index.html` in your browser (Chrome, Edge, Firefox, Brave, Safari).
No installation, Node.js, or server build step is required!

### Option 2: Install as an App on Android (PWA)
1. Open the web app URL (or serve it over local WiFi) in **Chrome for Android**.
2. Tap the browser menu (`⋮`).
3. Tap **"Install app"** or **"Add to Home screen"**.
4. The app will launch in full-screen standalone mode with touch controls!

---

## 📡 Connecting to WLED

1. Ensure your phone/computer and WLED ESP32 are on the same local Wi-Fi network.
2. Enter your WLED IP address (e.g. `192.168.1.120`) in the top right or sidebar.
3. Click **Push** to send the current frame.
4. Enable **"Auto-Push while drawing"** for real-time live interaction!

> **Wiring Configuration:**
> Open the Settings modal (⚙) to configure your matrix wiring:
> - Strip direction: Vertical (12 strips of 12 LEDs) or Horizontal.
> - Serpentine (zigzag) or parallel layout.
> - First LED start corner (Top-Left, Bottom-Left, etc.).

---

## 💾 Export Formats

- **12×12 Pixel PNG:** Lossless 1:1 pixel art PNG.
- **144×84mm Glowing Render:** High-resolution 1440×840px mock render showing physical LEDs and ambient glow.
- **WLED JSON Preset:** Ready to paste into WLED presets or send via curl.
- **FastLED / Arduino C++ Header (.h):** `const uint32_t PROGMEM matrix_art_12x12[144]` array ready to flash to microcontrollers.
