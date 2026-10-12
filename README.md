# WLED Matrix Studio (Custom Dimensions & Anamorphic Edition)

A responsive Web App & Android PWA for creating pixel art, multi-frame animations, and importing images for **WLED LED matrices** with customizable resolutions and non-square physical pitches.

---

## 🎨 Signature Palette & Theme

The studio is styled in a custom volcanic palette:
- **Volcanic Sand Black** (`#0d0f11` / `#121518` / `#171b20`): Deep dark surfaces designed for high LED contrast.
- **Signature Blue** (`#0088CA`): Primary brand color for active tools, highlights, frame selections, and network pushes.
- **Light Olive** (`#A4B47C` / `#C2CF9E`): Accent color for dimension badges, aspect ratios, animation controls, and status indicators.

---

## 📐 Why Anamorphic Correction Matters

When LED strips are mounted with unequal column and row spacing (e.g. 12mm horizontal pitch × 7mm vertical pitch), standard pixel art software will stretch or distort circles and icons.

**WLED Matrix Studio solves this directly:**
1. **Physical LED View:** Displays pixels with their real-world rectangular pitch so on-screen art matches physical reality.
2. **Anamorphic Circle & Shape Tools:** Circle and rectangle tools compensate for non-square ratios so shapes are physically round on the matrix.
3. **Anamorphic Image Importer:** Pre-scales any photo, logo, or icon so it doesn't look squished when displayed.
4. **Real-World LED Glow Simulator:** Renders realistic circular LEDs, dark PCB gaps, and ambient glow diffusion.
5. **Dynamic Dimension Setup:** Easily switch between 12×12 (144×84mm), 16×16 (160×160mm), 8×8, 16×8, 32×8, or any custom LED count and millimeter size.

---

## 🚀 How to Run & Use

### Option 1: Run Locally (Desktop or Phone) — Recommended
Simply double-click `index.html` to open it in Chrome, Edge, Firefox, or Safari.
- Running locally via `file:///` allows your browser to connect directly to your local WLED IP address with zero HTTPS mixed-content blocks!

### Option 2: Host on GitHub Pages
1. Push `index.html`, `logo.png`, `manifest.json`, and `sw.js` to your GitHub repository.
2. Go to **Settings &rarr; Pages** and select the `main` branch.
3. Note: Because GitHub Pages uses HTTPS, browsers block direct HTTP calls to local IPs unless you allow "Insecure content" in Chrome site settings or use the built-in copy JSON preset feature.

---

## 📡 Connecting to WLED

1. Enter your WLED IP address (e.g., `192.168.1.120`).
2. Click **Test Connection** or **Push** to transmit art immediately.
3. Enable **Auto-Push while drawing** for live updating.
4. If an error occurs, click **Troubleshoot ℹ️** for guidance and one-click JSON preset copying.

---

## 💾 Export Formats

- **Pixel PNG:** Lossless 1:1 pixel art PNG at current resolution.
- **Glowing Render:** High-resolution mockup with realistic ambient glow.
- **WLED JSON Preset:** Ready to paste into WLED presets or send via cURL.
- **FastLED C++ Header (.h):** PROGMEM array formatted for Arduino/ESP32 firmware.
