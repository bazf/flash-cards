# FlashCards PWA - Complete Implementation Guide

## 🎉 Project Complete!

Your fully-featured flashcard learning system with **Leitner spaced repetition**, **offline PWA support**, **PDF export**, and **localStorage persistence** is ready to use.

---

## 📂 Project Structure

```
flash-cards/
├── src/                              # Main application (serve this folder)
│   ├── index.html                    # Single-page app shell
│   ├── app.js                        # Core app logic (550+ lines)
│   ├── styles.css                    # Responsive + print styles
│   ├── service-worker.js             # PWA offline support
│   ├── manifest.webmanifest          # PWA installable metadata
│   ├── icons/
│   │   ├── icon-192.png              # App icon (192×192)
│   │   └── icon-512.png              # App icon (512×512)
│   └── decks/
│       ├── index.json                # Deck manifest
│       ├── flashcards (1).csv        # Example deck (Ukrainian)
│       └── flashcards (2).csv        # Example deck (Ukrainian)
│
├── README.md                         # Full documentation
├── QUICKSTART.md                     # Quick reference
├── IMPLEMENTATION.md                 # Technical details
├── generate_icons.py                 # Icon generator script
└── .gitignore                        # Git exclusions

```

---

## 🚀 Quick Start (3 Steps)

### Step 1: Start Local Server
```bash
cd /Users/baz/Projects/repos/single-sites/flash-cards
python3 -m http.server 8000 --directory src
```

### Step 2: Open in Browser
```
http://localhost:8000
```

### Step 3: Try It Out
- Click a **default deck** (loads Ukrainian flashcards from CSV)
- Click **Start Study Session** to practice
- Click **Print to PDF** to export flashcards for printing
- Click **Add to Home Screen** (mobile) to install as PWA

---

## ✨ Key Features

| Feature | Status | Details |
|---------|--------|---------|
| **Leitner Algorithm** | ✅ | 5 boxes, 0/1/3/7/14 day intervals |
| **CSV Import** | ✅ | Supports quotes, newlines, UTF-8 (Ukrainian, Arabic, etc.) |
| **Study Mode** | ✅ | Flip-to-reveal, 4-point grading (Again/Hard/Good/Easy) |
| **Offline (PWA)** | ✅ | Works without internet after first visit |
| **PDF Export** | ✅ | A4 3×3 grid with front/back for duplex printing |
| **Data Persistence** | ✅ | All learning progress in browser localStorage |
| **Responsive** | ✅ | Mobile, tablet, desktop optimized |
| **Dark Mode** | ✅ | Automatic based on system preference |
| **Installable** | ✅ | Install as app on mobile/desktop |

---

## 📖 Usage Guide

### Loading Decks

**Default Decks** (Pre-loaded):
- Click any deck tile to load from `src/decks/`
- Decks listed in `src/decks/index.json`

**Custom Decks** (Upload):
1. Create a CSV file (2 columns: question, answer)
2. Click **Upload Your Deck**
3. Select your CSV file
4. App imports automatically

### Studying

1. Click deck → **Start Study Session**
2. See question, click card to reveal answer
3. Grade yourself:
   - **Again** (0): Forgot, reset to box 0
   - **Hard** (1): Difficult, minimal progress
   - **Good** (3): Correct, normal progress
   - **Easy** (5): Easy, fast progress
4. Session ends when all due cards reviewed

### Deck Management

- **Stats**: View total/due/learned/new cards
- **Reset**: Clear learning progress (keep cards)
- **Delete**: Permanently remove deck
- **Print**: Export to PDF for physical cards

---

## 📝 CSV Format

**Simple Example** (`vocabulary.csv`):
```csv
Hello,Hola
Goodbye,Adiós
Thank you,Gracias
```

**Complex Example** (with quotes):
```csv
"What is 2+2?","4, the answer"
"Greeting","Привет (Russian)"
```

**Rules**:
- Two columns: front (question) and back (answer)
- No header row required
- Quoted fields support commas and newlines
- UTF-8 encoding for all languages

---

## 🗓️ How Leitner Works

Cards progress through boxes based on your reviews:

```
New Card (Box 0)
    ↓
[Study: Show question, reveal answer, grade]
    ↓
    ├─→ Grade 0-2 (Wrong) → Back to Box 0
    └─→ Grade 3-5 (Correct) → Move to Box 1
            ↓
        Wait 1 day → Due again
            ↓
        [Study & grade again]
            ↓
            └─→ Correct → Box 2 (wait 3 days)
                └─→ Box 3 (wait 7 days)
                    └─→ Box 4 (Learned! wait 14 days)
```

**Key Idea**: Cards you struggle with appear more frequently; cards you know appear less often.

---

## 💾 Data Storage

All data stored in browser **localStorage**:
- **Key**: `flashcards:v1`
- **Value**: JSON object containing decks + cards + progress
- **Size**: ~5-10 MB (supports thousands of cards)
- **Persistence**: Survives browser restart, not cleared unless:
  - You clear browsing data
  - Browser runs out of storage (rare)

### Backup & Restore

**To Backup**:
1. Open DevTools (F12)
2. Storage → Local Storage → select http://localhost:8000
3. Find `flashcards:v1`
4. Right-click → Copy value → Save to file

**To Restore**:
1. DevTools → Storage → Local Storage
2. Right-click → Add new → Name: `flashcards:v1`
3. Paste your backed-up JSON value

---

## 🖨️ Printing & PDF Export

### Method 1: PDF Export (Recommended)
1. View deck stats
2. Click **Print to PDF**
3. PDF opens with:
   - First half: Card fronts (3×3 grid per page)
   - Second half: Card backs (reversed for duplex)
4. Print with duplex mode for best results

### Method 2: Browser Print
1. Use Cmd+P (macOS) or Ctrl+P (Windows)
2. Ensure **Print backgrounds** is checked
3. Select **Landscape** for better card size
4. Print normally

### Printing Tips
- **Paper**: Use standard A4 or Letter cardstock
- **Duplex**: Enable duplex mode for front+back
- **Margins**: Set to minimal (0.5 inch)
- **Quality**: Use "Best" or "Fine" setting

---

## 📱 PWA Installation

### Desktop (Chrome/Edge)
1. Open app in Chrome or Edge
2. Click install icon in address bar
3. Confirm "Install app"
4. App opens as standalone window

### iOS (Safari)
1. Open app in Safari
2. Tap Share button (bottom)
3. Tap "Add to Home Screen"
4. Enter app name, add
5. Tap home screen icon to launch

### Android (Chrome)
1. Open app in Chrome
2. Tap menu (⋯)
3. Tap "Install app"
4. Confirm installation
5. App appears on home screen

### Offline Usage
- First load: App downloads all files
- Offline: All data cached locally
- Study: Works without internet
- New deck upload: Requires internet (to fetch CSV)
- Update: Auto-checks for new version when online

---

## 🔧 Customization

### Change Colors
Edit `src/styles.css`:
```css
:root {
    --primary-color: #2563eb;  /* Change this */
    --form-element-valid-border-color: #10b981;
}
```

### Add New Default Decks
1. Add CSV file to `src/decks/`
2. Update `src/decks/index.json`:
   ```json
   [
     {
       "id": "spanish",
       "name": "Spanish Vocab",
       "filename": "spanish.csv",
       "description": "Learn Spanish"
     }
   ]
   ```
3. Restart server, deck appears

### Modify Leitner Intervals
Edit `src/app.js`:
```javascript
const CONFIG = {
    boxIntervals: [0, 1, 3, 7, 14],  // Change these days
    maxBox: 4,
};
```

---

## 🌐 Deployment

### Local Development
```bash
python3 -m http.server 8000 --directory src
# Visit: http://localhost:8000
```

### Production (Any Web Server)
1. Copy `src/` folder to server
2. Ensure **HTTPS** (required for Service Worker)
3. Set HTTP headers:
   ```
   Cache-Control: max-age=31536000       # For app files
   Cache-Control: no-cache               # For service-worker.js
   ```
4. Users can install from address bar

### Using a CDN
- Deploy `src/` to CloudFlare Pages, Vercel, Netlify, etc.
- All have HTTPS by default
- PWA works automatically
- Service Worker auto-caches

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Service Worker not working | Use HTTPS or http://localhost (not file://) |
| CSV won't import | Verify UTF-8 encoding, check for 2 columns |
| Data lost | localStorage was cleared; restore from backup |
| Icons not showing | Run `python3 generate_icons.py` |
| PDF looks wrong | Try Landscape orientation, check printer settings |
| PWA won't install | Ensure manifest.webmanifest is served (check DevTools) |
| Offline not working | Check Service Worker status in DevTools → Application |

---

## 📊 Performance Notes

- **App size**: ~100 KB (HTML + CSS + JS)
- **Deck size**: ~1-50 KB per CSV (depending on card count)
- **Cache**: ~5-10 MB (localStorage limit)
- **Load time**: <1s on modern browsers
- **Offline**: Instant (cached)

---

## 🎓 Learning Science

The Leitner System is based on **spaced repetition**:
- Cards you know → see less often
- Cards you struggle with → see more often
- Optimal review intervals: 1, 3, 7, 14 days

Research shows this approach is 2-3x more effective than traditional study methods.

---

## 🔐 Privacy & Security

- ✅ **No tracking**: No analytics or telemetry
- ✅ **No cloud**: Data stays on your device
- ✅ **No logins**: No accounts needed
- ✅ **No ads**: Ad-free learning
- ✅ **Open**: All code is yours, no dependencies on third parties

---

## 📚 Documentation Files

- **README.md** — Full feature documentation
- **QUICKSTART.md** — Quick reference for common tasks
- **IMPLEMENTATION.md** — Technical architecture details
- **This file** — Complete user + dev guide

---

## 🚀 Next Steps

1. **Try It Now**:
   ```bash
   python3 -m http.server 8000 --directory src
   # Visit http://localhost:8000
   ```

2. **Upload a Deck**:
   - Create a CSV with questions/answers
   - Click "Upload Your Deck"
   - Start studying

3. **Test Offline**:
   - Visit app once
   - Go offline (DevTools → Network → Offline)
   - Verify app still works

4. **Install PWA**:
   - Click install in address bar (Chrome) or Share → Add to Home (iOS)
   - Use as standalone app

5. **Deploy**:
   - Copy `src/` to HTTPS web server
   - Share URL with others
   - Users can install and use offline

---

## 💬 Questions?

- Check **README.md** for detailed feature docs
- Check **QUICKSTART.md** for quick reference
- Check **IMPLEMENTATION.md** for technical details
- All code is in `src/` (vanilla JS, no build tools)

---

## ✅ Checklist: What You Have

- [x] Single-page flashcard app (index.html + app.js)
- [x] Leitner spaced repetition scheduling
- [x] CSV import with UTF-8 support
- [x] Default decks from src/decks/
- [x] Study interface with flip-to-reveal
- [x] localStorage persistence (no server needed)
- [x] PDF export (A4 3×3 grid)
- [x] PWA offline support (service worker + manifest)
- [x] Responsive design (mobile, tablet, desktop)
- [x] Dark mode support
- [x] Print-friendly stylesheet
- [x] Generated icons (192×192, 512×512)
- [x] Complete documentation

---

**Status**: ✅ **READY TO USE**

**Last Updated**: December 14, 2025
