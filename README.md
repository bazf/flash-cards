# FlashCards - Leitner System App

A fully-featured, offline-capable flashcard learning app using the Leitner spaced repetition algorithm. Built as a progressive web app (PWA) with no build tools required.

## Features

✨ **Leitner System** – Spaced repetition scheduling with 5 learning boxes
📱 **Progressive Web App** – Install as an app, works offline
💾 **LocalStorage Persistence** – All learning data stored locally (no server required)
📤 **CSV Import** – Upload your own flashcard decks in CSV format
📚 **Default Decks** – Pre-loaded example decks from `src/decks/`
🎨 **Beautiful UI** – Clean, responsive design using Pico CSS
📄 **PDF Export** – Generate printable flashcard sheets with jsPDF
🖨️ **Print Support** – Front and back layouts for duplex printing
🌙 **Dark Mode** – Automatic support for system dark mode preference

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- For development: Python 3 (for icon generation)

### Installation & Running Locally

1. **Clone or download this repository**
   ```bash
   cd /path/to/flash-cards
   ```

2. **Generate icons** (one-time setup):
   ```bash
   python3 generate_icons.py
   ```

3. **Start a local web server**:

   **Option A: Using Python (built-in)**
   ```bash
   python3 -m http.server 8000
   ```

   **Option B: Using Node.js (if installed)**
   ```bash
   npx http-server
   ```

   **Option C: Using macOS SimpleHTTPServer**
   ```bash
   python3 -m http.server 8000 --directory /Users/baz/Projects/repos/single-sites/flash-cards/src
   ```

4. **Open in your browser**:
   ```
   http://localhost:8000
   ```

5. **Install as PWA** (desktop or mobile):
   - Desktop (Chrome/Edge): Click the install icon in the address bar
   - iOS Safari: Tap Share → Add to Home Screen
   - Android Chrome: Tap menu → Install app

## Usage

### Selecting a Deck

1. **Default Decks**: Click any default deck to load it (stored in `src/decks/`)
2. **Upload a Deck**: Select a CSV file with two columns (front, back) – no headers needed
3. **View Stats**: See total cards, due today, learned, and new cards

### Study Session

1. Click **Start Study Session** to begin
2. Review is shown, click to reveal the answer
3. Grade yourself:
   - **Again** (0): Doesn't know, reset to box 0
   - **Hard** (1): Difficult, stays near box 0
   - **Good** (3): Correct, move to next box (default)
   - **Easy** (5): Very easy, move faster to learned

### Manage Your Decks

- **Reset Progress**: Clear all learning history for a deck
- **Delete Deck**: Remove a deck permanently
- **Print to PDF**: Export cards as a printable PDF (front and back layouts)

## File Format (CSV)

Create a CSV file with two columns: **question** and **answer**. No header row required.

**Example: `spanish.csv`**
```csv
"Hello","Hola"
"Goodbye","Adiós"
"Thank you","Gracias"
"What is your name?","¿Cuál es tu nombre?"
```

Supports:
- Quoted fields containing commas or newlines
- UTF-8 encoding (including Ukrainian, Chinese, Arabic, etc.)
- Unquoted fields (no special characters)

## Project Structure

```
flash-cards/
├── src/
│   ├── index.html              # Main SPA shell
│   ├── app.js                  # Core app logic (Leitner, CSV, jsPDF)
│   ├── styles.css              # Responsive styling + print rules
│   ├── service-worker.js       # PWA offline caching
│   ├── manifest.webmanifest    # PWA metadata
│   ├── icons/
│   │   ├── icon-192.png        # PWA app icon (192x192)
│   │   └── icon-512.png        # PWA app icon (512x512)
│   └── decks/
│       ├── index.json          # Manifest of default decks
│       ├── flashcards (1).csv  # Example deck 1
│       └── flashcards (2).csv  # Example deck 2
├── generate_icons.py           # Script to generate icons
└── README.md                   # This file
```

## How the Leitner System Works

Cards progress through 5 boxes based on your review grades:

| Box | Interval | Meaning |
|-----|----------|---------|
| 0   | 0 days   | New or failed cards |
| 1   | 1 day    | Learning |
| 2   | 3 days   | Progressing |
| 3   | 7 days   | Familiar |
| 4   | 14 days  | Learned |

**Today's Due Cards**: Only cards with `dueAt ≤ now` appear in study sessions.

## Data Storage

All data is stored in your browser's **localStorage** (no server, no sync):
- Learning progress (box, due date, review history)
- User-imported decks
- Session statistics

**To backup your progress**:
1. Open DevTools (F12) → Application → Local Storage
2. Find `flashcards:v1`
3. Copy the entire object to save it

**To restore**:
1. Delete `flashcards:v1` from LocalStorage
2. Copy your backup back in

## Offline Support

This app is a **Progressive Web App (PWA)**:
- **Install locally**: Works without internet after first visit
- **Cached resources**: App shell, CSS, JS, and default decks are precached
- **Deck updates**: Fetch fresh CSV files when online; serve cached copy offline
- **No server needed**: Run it as a static site on any web server

## PDF Export Details

- **Format**: A4 or Letter (configurable)
- **Layout**: 3×3 grid of flashcards per page
- **Pages**:
  - First half: Card fronts (questions)
  - Second half: Card backs (answers, in reverse order for duplex printing)
- **Fonts**: Supports UTF-8 (Ukrainian, Arabic, Chinese, etc.) with fallback to Helvetica
- **Print**: Use **landscape** mode for best results on A4

## Supported Browsers

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome/Edge | ✅ Full | PWA install, offline |
| Firefox | ✅ Full | PWA install (Windows/Linux only), offline |
| Safari (macOS) | ✅ Good | Offline supported; PWA via "Add to Home" |
| Safari (iOS) | ✅ Good | Limited PWA; Add to Home Screen works |
| Older browsers | ⚠️ Partial | No Service Worker, but basic app works |

## Development Notes

### Adding New Default Decks

1. Add a CSV file to `src/decks/`
2. Update `src/decks/index.json`:
   ```json
   [
     {
       "id": "unique-id",
       "name": "Deck Name",
       "filename": "filename.csv",
       "description": "Short description"
     }
   ]
   ```
3. The app will auto-fetch and display it

### Customizing Styles

Edit `src/styles.css` to modify colors, fonts, or layout. The app uses:
- **Pico CSS** (via CDN) for base styles
- **Custom overrides** for flashcard-specific styling
- **CSS Grid** for responsive layouts

### Service Worker Caching Strategy

- **App shell** (HTML, JS, CSS): Cache-first (fastest offline)
- **Default decks** (CSV, JSON): Stale-while-revalidate (offline, updates in background)
- **External CDN** (jsPDF, Pico): Network-first (updated always possible)

To force an update:
1. Bump `CACHE_VERSION` in `service-worker.js`
2. An "Update Available" button will appear in the navbar
3. Click to reload with new service worker

## Performance Tips

- **Large decks** (1000+ cards): Export to PDF, print on demand
- **Mobile storage**: iOS may evict LocalStorage under memory pressure; backup often
- **Print quality**: Use a printer's "draft" or "best" setting; 300 DPI recommended

## Known Limitations

1. **No cloud sync**: Data stored locally only (by design, for privacy)
2. **No image/audio**: Currently text-only (can be extended)
3. **Stable card IDs**: Based on content hash; editing text changes the card ID (progress resets)
4. **Duplex printing**: May need manual page reordering depending on your printer

## Future Enhancements

- [ ] Image/audio card support
- [ ] Multiple-choice quiz mode
- [ ] Deck sharing (via JSON export)
- [ ] Cloud backup (optional)
- [ ] Dark mode toggle (instead of system preference)
- [ ] Custom learning intervals

## License

Use freely for personal or educational purposes.

## Support

For bugs or feature requests, please open an issue or contact the author.

---

**Happy learning! 📚**
