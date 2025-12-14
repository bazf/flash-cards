# FlashCards App - Quick Start Guide

## ✅ What's Implemented

### Core Features
- ✅ **Leitner System** with 5 learning boxes and configurable intervals
- ✅ **LocalStorage** for persistent data (no server required)
- ✅ **CSV Import** supporting quoted fields and UTF-8 (Ukrainian, etc.)
- ✅ **Default Decks** loaded from `src/decks/index.json`
- ✅ **Study Sessions** with reveal-and-grade interface
- ✅ **PDF Export** with jsPDF (A4 layout, 3×3 grid, front+back)
- ✅ **PWA Support** with offline caching via Service Worker
- ✅ **Responsive Design** with Pico CSS + custom print styles

### UI Components
- ✅ Deck selection screen with default + user decks
- ✅ Deck statistics (total, due, learned, new)
- ✅ Study view with flip-card interaction
- ✅ Grading buttons (Again, Hard, Good, Easy)
- ✅ Print/Reset/Delete deck actions
- ✅ PWA update notification banner

### Data Management
- ✅ Stable card IDs via SHA256 hash (front + back content)
- ✅ Per-card state: box, dueAt, lastReviewedAt, lapses
- ✅ Versioned storage schema (`flashcards:v1`)
- ✅ CSV parsing with quoted commas/newlines support

## 🚀 Running the App

### Local Development
```bash
cd /Users/baz/Projects/repos/single-sites/flash-cards

# Generate icons (one-time)
python3 generate_icons.py

# Start server
python3 -m http.server 8000 --directory src
```

Then open: **http://localhost:8000**

### Deploy to Production
1. Serve the `src/` folder over HTTPS
2. Ensure `Cache-Control: no-cache` on `service-worker.js` and `manifest.webmanifest`
3. Users can install as PWA from address bar

## 📋 CSV Format

**File**: `mydecks.csv`
```csv
What is 2+2?,4
What is the capital of France?,"Paris, a beautiful city"
Greeting,"Привет (Russian for Hello)"
```

**Rules**:
- Two columns: **front** (question) and **back** (answer)
- No header row
- Quoted fields support commas and newlines
- UTF-8 encoding for all languages

## 🎓 Leitner Intervals

| Box | Days | When to Review |
|-----|------|---|
| 0 (New) | 0 | Today |
| 1 | 1 | Tomorrow |
| 2 | 3 | 3 days later |
| 3 | 7 | 1 week later |
| 4 (Learned) | 14 | 2 weeks later |

**Flow**:
- Wrong answer → Reset to Box 0
- Correct answer → Move to next box (up to Box 4)
- Only Box 0+ cards due today appear in study

## 💾 Data Backup

All learning data is in browser **localStorage**:
```
Key: flashcards:v1
Value: JSON object with decks + cards + progress
```

To backup:
1. DevTools → Storage → Local Storage → `flashcards:v1`
2. Copy the value to a text file
3. To restore: paste back into LocalStorage

## 🖨️ Printing

1. Click **Print to PDF** on deck stats
2. Opens jsPDF with:
   - First half: Card fronts (all)
   - Second half: Card backs (reversed for duplex)
3. Use printer's duplex mode or print in two batches

**Manual Printing Alternative**:
- Use browser Print (Cmd+P on macOS)
- Select "Print backgrounds" for styling

## 🌐 PWA (Offline Support)

1. **Install**: Click address bar icon (Chrome/Edge) or Share → Add to Home Screen (iOS)
2. **Offline**: Works without internet after first load
3. **Updates**: Service Worker caches decks; new versions auto-update when online
4. **Cache Strategy**:
   - App shell: cache-first (fast)
   - Decks: stale-while-revalidate (offline + fresh)

## 🔧 File Structure

```
src/
├── index.html                 # SPA shell with all views
├── app.js                     # Leitner logic, CSV parsing, PDF export
├── styles.css                 # Responsive + print styles
├── service-worker.js          # Offline caching
├── manifest.webmanifest       # PWA metadata
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── decks/
    ├── index.json             # Manifest of default decks
    ├── flashcards (1).csv
    └── flashcards (2).csv
```

## 📱 Adding More Default Decks

1. Add CSV file to `src/decks/`
2. Update `src/decks/index.json`:
   ```json
   {
     "id": "spanish-vocab",
     "name": "Spanish Vocabulary",
     "filename": "spanish.csv",
     "description": "Basic Spanish words"
   }
   ```
3. Restart server; deck appears on selection screen

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Service Worker not registering | Ensure HTTPS (or http://localhost) |
| CSV won't import | Check UTF-8 encoding, verify two columns |
| Icons not showing | Run `python3 generate_icons.py` |
| Data lost on browser clear | Backup from LocalStorage first |
| PDF looks weird | Use "Landscape" orientation, 300 DPI printer |

## 🎯 Next Steps

1. **Test with real data**: Upload a deck, study a few cards
2. **Try printing**: Export PDF and print on paper
3. **Install PWA**: Add to home screen on mobile
4. **Go offline**: Disconnect internet, verify app still works
5. **Customize**: Edit `src/styles.css` for your colors

## 📝 License & Credits

- **Pico CSS**: Minimal CSS framework (cdn.jsdelivr.net)
- **jsPDF**: PDF generation library (cdn.jsdelivr.net)
- **Service Worker**: Offline caching pattern (W3C standard)
- **Leitner System**: Historical SRS algorithm (public domain)

---

**Questions?** Check the main README.md for detailed documentation.
