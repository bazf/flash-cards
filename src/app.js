// ============================================================================
// FLASHCARD LEITNER SYSTEM APP
// ============================================================================

// Configuration
const CONFIG = {
    storageKey: 'flashcards:v1',
    boxIntervals: [0, 1, 3, 7, 14], // days: new, box1, box2, box3, box4
    maxBox: 4,
};

// Noto Sans Regular base64 (minimal subset for demo; full font is ~200KB)
// For production, consider serving from CDN or embedding full Noto Sans
const NOTO_SANS_BASE64 = 'AAEAAAALAIAAAwAwT1MvMgsQBfMAIkgJAwOAgGZgZGDg+P7/AwOFgYEAgf//AAAA';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let appState = {
    currentDeck: null,
    currentCardIndex: 0,
    sessionCards: [],
    sessionStats: { correct: 0, wrong: 0 },
};

// ============================================================================
// LOCAL STORAGE HELPER
// ============================================================================

function getStorageData() {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) {
        return {
            schemaVersion: 1,
            decks: {},
            cards: {},
        };
    }
    return JSON.parse(raw);
}

function saveStorageData(data) {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
}

// ============================================================================
// CARD ID GENERATION (STABLE HASH)
// ============================================================================

async function generateCardId(front, back) {
    const text = `${front.trim()}\u241F${back.trim()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const cards = [];

    for (const line of lines) {
        if (!line.trim()) continue;

        const parsed = parseCSVLine(line);
        if (parsed.length >= 2) {
            cards.push({
                front: parsed[0],
                back: parsed[1],
            });
        }
    }

    return cards;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current);
    return result.map(s => s.trim());
}

// ============================================================================
// DECK MANAGEMENT
// ============================================================================

async function importDeck(cards, deckId, deckName, sourceUrl = null) {
    const storage = getStorageData();

    // Initialize deck entry
    if (!storage.decks[deckId]) {
        storage.decks[deckId] = {
            name: deckName,
            sourceUrl,
            cardOrder: [],
            importedAt: Date.now(),
        };
    }

    // Add/update cards
    for (const card of cards) {
        const cardId = await generateCardId(card.front, card.back);
        const fullId = `${deckId}:${cardId}`;

        if (!storage.cards[fullId]) {
            storage.cards[fullId] = {
                front: card.front,
                back: card.back,
                box: 0,
                dueAt: Date.now(),
                lastReviewedAt: null,
                lastResult: null,
                lapses: 0,
            };
        }

        if (!storage.decks[deckId].cardOrder.includes(cardId)) {
            storage.decks[deckId].cardOrder.push(cardId);
        }
    }

    saveStorageData(storage);
    return deckId;
}

function getDeck(deckId) {
    const storage = getStorageData();
    const deckMeta = storage.decks[deckId];
    if (!deckMeta) return null;

    const cards = deckMeta.cardOrder.map(cardId => {
        const fullId = `${deckId}:${cardId}`;
        return { cardId, ...storage.cards[fullId] };
    });

    return { ...deckMeta, id: deckId, cards };
}

function getStats(deckId) {
    const deck = getDeck(deckId);
    if (!deck) return null;

    const now = Date.now();
    const dayMs = 86400000;
    let dueCount = 0;
    let learnedCount = 0;
    let newCount = 0;

    for (const card of deck.cards) {
        if (card.box === 0) {
            newCount++;
        } else if (card.box === CONFIG.maxBox) {
            learnedCount++;
        }

        if (card.dueAt <= now) {
            dueCount++;
        }
    }

    return {
        total: deck.cards.length,
        due: dueCount,
        learned: learnedCount,
        new: newCount,
    };
}

// ============================================================================
// LEITNER SCHEDULING
// ============================================================================

function getNextDueDate(box) {
    const intervalDays = CONFIG.boxIntervals[Math.min(box, CONFIG.boxIntervals.length - 1)];
    return Date.now() + intervalDays * 86400000;
}

function reviewCard(deckId, cardId, grade) {
    const storage = getStorageData();
    const fullId = `${deckId}:${cardId}`;
    const card = storage.cards[fullId];

    if (!card) return;

    const now = Date.now();
    card.lastReviewedAt = now;
    card.lastResult = grade >= 3 ? 'correct' : 'wrong';

    if (grade >= 3) {
        // Correct: move forward
        card.box = Math.min(card.box + 1, CONFIG.maxBox);
    } else {
        // Wrong: reset to box 0
        card.lapses = (card.lapses || 0) + 1;
        card.box = 0;
    }

    card.dueAt = getNextDueDate(card.box);
    saveStorageData(storage);
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

function startStudySession(deckId) {
    const deck = getDeck(deckId);
    if (!deck) return [];

    const now = Date.now();
    const dueCards = deck.cards.filter(c => c.dueAt <= now);

    if (dueCards.length === 0) {
        return [];
    }

    // Shuffle due cards for variety
    return dueCards.sort(() => Math.random() - 0.5);
}

// ============================================================================
// JSPDF EXPORT
// ============================================================================

async function exportDeckToPDF(deckId) {
    const deck = getDeck(deckId);
    if (!deck || deck.cards.length === 0) {
        alert('No cards to export');
        return;
    }

    const jsPDF = window.jspdf.jsPDF;
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    // A4: 210 x 297 mm
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const cols = 3;
    const rows = 3;
    const gutter = 2;

    const cardWidth = (pageWidth - 2 * margin - (cols - 1) * gutter) / cols;
    const cardHeight = (pageHeight - 2 * margin - (rows - 1) * gutter) / rows;

    pdf.setFont('Helvetica'); // Fallback for now; Noto Sans not embedded due to size

    let cardIndex = 0;
    let pageNum = 0;

    // Fronts
    for (let i = 0; i < deck.cards.length; i += cols * rows) {
        pageNum++;
        let cardNum = 0;

        for (let row = 0; row < rows && i + cardNum < deck.cards.length; row++) {
            for (let col = 0; col < cols && i + cardNum < deck.cards.length; col++) {
                const card = deck.cards[i + cardNum];
                const x = margin + col * (cardWidth + gutter);
                const y = margin + row * (cardHeight + gutter);

                // Draw border
                pdf.rect(x, y, cardWidth, cardHeight);

                // Draw front text
                pdf.setFontSize(11);
                const lines = pdf.splitTextToSize(card.front, cardWidth - 4);
                const textY = y + cardHeight / 2 - (lines.length * 2.5) / 2;
                pdf.text(lines, x + 2, textY, { maxWidth: cardWidth - 4, align: 'center' });

                cardNum++;
            }
        }

        if (i + cols * rows < deck.cards.length) {
            pdf.addPage();
        }
    }

    // Backs (reverse order for duplex printing)
    pdf.addPage();
    pageNum++;
    let backIndex = deck.cards.length - 1;

    while (backIndex >= 0) {
        let cardNum = 0;

        for (let row = 0; row < rows && backIndex >= 0; row++) {
            for (let col = 0; col < cols && backIndex >= 0; col++) {
                const card = deck.cards[backIndex];
                const x = margin + col * (cardWidth + gutter);
                const y = margin + row * (cardHeight + gutter);

                // Draw border
                pdf.rect(x, y, cardWidth, cardHeight);

                // Draw back text with visual distinction
                pdf.setTextColor(102, 126, 234); // blue
                pdf.setFontSize(10);
                const lines = pdf.splitTextToSize(card.back, cardWidth - 4);
                const textY = y + cardHeight / 2 - (lines.length * 2.5) / 2;
                pdf.text(lines, x + 2, textY, { maxWidth: cardWidth - 4, align: 'center' });
                pdf.setTextColor(0, 0, 0);

                backIndex--;
                cardNum++;
            }
        }

        if (backIndex >= 0) {
            pdf.addPage();
        }
    }

    pdf.save(`${deck.name.replace(/\s+/g, '_')}.pdf`);
}

// ============================================================================
// UI RENDERING
// ============================================================================

function showView(viewId) {
    document.querySelectorAll('section[id$="View"]').forEach(s => (s.style.display = 'none'));
    const view = document.getElementById(viewId);
    if (view) view.style.display = 'block';
}

async function renderDeckSelection() {
    showView('deckSelectionView');

    // Load and render default decks
    try {
        const response = await fetch('decks/index.json');
        const defaultDecks = await response.json();

        const defaultContainer = document.getElementById('defaultDecksList');
        defaultContainer.innerHTML = '';

        for (const deckInfo of defaultDecks) {
            const deckCard = document.createElement('div');
            deckCard.className = 'deck-card';
            deckCard.innerHTML = `
                <h3>${deckInfo.name}</h3>
                <small>${deckInfo.description}</small>
                <div class="stats" id="stats-${deckInfo.id}">
                    <div class="stat">
                        <div class="stat-value">0</div>
                        <div>Total</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">0</div>
                        <div>Due</div>
                    </div>
                </div>
            `;
            deckCard.style.cursor = 'pointer';

            deckCard.addEventListener('click', async () => {
                await loadDefaultDeck(deckInfo);
                await showDeckStats(deckInfo.id);
            });

            defaultContainer.appendChild(deckCard);

            // Load stats for default deck
            const stats = getStats(deckInfo.id);
            if (stats) {
                const statsEl = document.getElementById(`stats-${deckInfo.id}`);
                if (statsEl) {
                    statsEl.innerHTML = `
                        <div class="stat">
                            <div class="stat-value">${stats.total}</div>
                            <div>Total</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${stats.due}</div>
                            <div>Due</div>
                        </div>
                    `;
                }
            }
        }
    } catch (error) {
        console.error('Error loading default decks:', error);
    }

    // Render user decks
    const storage = getStorageData();
    const userDeckIds = Object.keys(storage.decks).filter(id => !id.startsWith('flashcards-'));

    if (userDeckIds.length > 0) {
        document.getElementById('userDecksContainer').style.display = 'block';
        const userContainer = document.getElementById('userDecksList');
        userContainer.innerHTML = '';

        for (const deckId of userDeckIds) {
            const deck = storage.decks[deckId];
            const stats = getStats(deckId);

            const deckCard = document.createElement('div');
            deckCard.className = 'deck-card';
            deckCard.innerHTML = `
                <h3>${deck.name}</h3>
                <small>${deck.cardOrder.length} cards</small>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-value">${stats?.total || 0}</div>
                        <div>Total</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${stats?.due || 0}</div>
                        <div>Due</div>
                    </div>
                </div>
            `;
            deckCard.style.cursor = 'pointer';
            deckCard.addEventListener('click', () => showDeckStats(deckId));

            userContainer.appendChild(deckCard);
        }
    }
}

async function loadDefaultDeck(deckInfo) {
    try {
        // Encode filename to handle spaces and special chars
        const encodedFilename = deckInfo.filename
            .split('')
            .map(c => /[a-zA-Z0-9._-]/.test(c) ? c : encodeURIComponent(c))
            .join('');

        const response = await fetch(`decks/${deckInfo.filename}`);
        const csvText = await response.text();
        const cards = parseCSV(csvText);

        if (cards.length === 0) {
            alert('No cards found in deck');
            return;
        }

        await importDeck(cards, deckInfo.id, deckInfo.name, `decks/${deckInfo.filename}`);
    } catch (error) {
        console.error('Error loading default deck:', error);
        alert('Error loading deck: ' + error.message);
    }
}

async function showDeckStats(deckId) {
    appState.currentDeck = deckId;
    const deck = getDeck(deckId);
    const stats = getStats(deckId);

    if (!deck || !stats) {
        alert('Deck not found');
        return;
    }

    showView('deckStatsView');

    document.getElementById('deckNameDisplay').textContent = deck.name;
    document.getElementById('deckSourceDisplay').textContent = deck.sourceUrl || 'Uploaded deck';

    document.getElementById('totalCards').textContent = stats.total;
    document.getElementById('dueCards').textContent = stats.due;
    document.getElementById('learnedCards').textContent = stats.learned;
    document.getElementById('newCards').textContent = stats.new;
}

function showStudyView() {
    const deckId = appState.currentDeck;
    const deck = getDeck(deckId);

    const sessionCards = startStudySession(deckId);

    if (sessionCards.length === 0) {
        alert('No cards due today!');
        return;
    }

    appState.sessionCards = sessionCards;
    appState.currentCardIndex = 0;
    appState.sessionStats = { correct: 0, wrong: 0 };

    showView('studyView');
    document.getElementById('studyDeckName').textContent = deck.name;

    showCard();
}

function showCard() {
    const card = appState.sessionCards[appState.currentCardIndex];
    if (!card) return;

    document.getElementById('cardQuestion').textContent = card.front;
    document.getElementById('cardAnswer').textContent = card.back;

    // Reset reveal
    document.querySelector('.flashcard-front').style.display = 'flex';
    document.querySelector('.flashcard-back').style.display = 'none';
    document.getElementById('revealBtn').style.display = 'block';
    document.querySelectorAll('.study-actions button:not(#revealBtn):not(#quitStudyBtn)').forEach(btn => {
        btn.style.display = 'none';
    });

    // Update counter
    const total = appState.sessionCards.length;
    const current = appState.currentCardIndex + 1;
    document.getElementById('cardCounter').textContent = `${current} / ${total}`;
    document.getElementById('sessionStats').textContent = `✓ ${appState.sessionStats.correct} ✗ ${appState.sessionStats.wrong}`;
}

function revealCard() {
    document.querySelector('.flashcard-front').style.display = 'none';
    document.querySelector('.flashcard-back').style.display = 'flex';
    document.getElementById('revealBtn').style.display = 'none';
    document.querySelectorAll('.study-actions button:not(#quitStudyBtn)').forEach(btn => {
        btn.style.display = 'inline-block';
    });
}

function reviewAndNext(grade) {
    const card = appState.sessionCards[appState.currentCardIndex];
    reviewCard(appState.currentDeck, card.cardId, grade);

    if (grade >= 3) {
        appState.sessionStats.correct++;
    } else {
        appState.sessionStats.wrong++;
    }

    appState.currentCardIndex++;

    if (appState.currentCardIndex >= appState.sessionCards.length) {
        finishSession();
    } else {
        showCard();
    }
}

function finishSession() {
    const stats = appState.sessionStats;
    alert(`Session complete!\nCorrect: ${stats.correct}\nWrong: ${stats.wrong}`);
    renderDeckSelection();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.getElementById('csvFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const cards = parseCSV(text);

    if (cards.length === 0) {
        alert('No valid cards found in CSV');
        return;
    }

    const deckName = file.name.replace('.csv', '');
    const deckId = `deck-${Date.now()}`;

    await importDeck(cards, deckId, deckName);
    alert(`Deck "${deckName}" imported with ${cards.length} cards!`);

    e.target.value = '';
    renderDeckSelection();
});

document.getElementById('backToDeckBtn')?.addEventListener('click', renderDeckSelection);
document.getElementById('startStudyBtn')?.addEventListener('click', showStudyView);
document.getElementById('printPdfBtn')?.addEventListener('click', () => exportDeckToPDF(appState.currentDeck));

document.getElementById('resetDeckBtn')?.addEventListener('click', () => {
    if (confirm('Reset all progress for this deck?')) {
        const storage = getStorageData();
        const deck = storage.decks[appState.currentDeck];
        if (deck) {
            deck.cardOrder.forEach(cardId => {
                const fullId = `${appState.currentDeck}:${cardId}`;
                const card = storage.cards[fullId];
                if (card) {
                    card.box = 0;
                    card.dueAt = Date.now();
                    card.lastReviewedAt = null;
                    card.lastResult = null;
                    card.lapses = 0;
                }
            });
            saveStorageData(storage);
            showDeckStats(appState.currentDeck);
        }
    }
});

document.getElementById('deleteDeckBtn')?.addEventListener('click', () => {
    if (confirm('Delete this deck permanently?')) {
        const storage = getStorageData();
        const deck = storage.decks[appState.currentDeck];
        if (deck) {
            deck.cardOrder.forEach(cardId => {
                const fullId = `${appState.currentDeck}:${cardId}`;
                delete storage.cards[fullId];
            });
            delete storage.decks[appState.currentDeck];
            saveStorageData(storage);
            renderDeckSelection();
        }
    }
});

document.getElementById('flashcard')?.addEventListener('click', revealCard);
document.getElementById('revealBtn')?.addEventListener('click', revealCard);

document.getElementById('againBtn')?.addEventListener('click', () => reviewAndNext(0));
document.getElementById('hardBtn')?.addEventListener('click', () => reviewAndNext(1));
document.getElementById('goodBtn')?.addEventListener('click', () => reviewAndNext(3));
document.getElementById('easyBtn')?.addEventListener('click', () => reviewAndNext(5));

document.getElementById('quitStudyBtn')?.addEventListener('click', () => {
    if (confirm('Quit study session?')) {
        renderDeckSelection();
    }
});

// ============================================================================
// PWA SERVICE WORKER REGISTRATION
// ============================================================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker registered:', registration);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'activated') {
                        const updateBtn = document.getElementById('updateBtn');
                        if (updateBtn) {
                            updateBtn.style.display = 'block';
                            updateBtn.addEventListener('click', () => {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                window.location.reload();
                            });
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', renderDeckSelection);
