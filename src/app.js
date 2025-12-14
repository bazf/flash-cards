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
    sessionMode: 'study', // 'study' | 'view'
    revealed: false,
};

const UI_TEXT = {
    deckNotFound: 'Колоду не знайдено',
    noCardsToExport: 'Немає карток для експорту',
    noCardsInDeck: 'У колоді немає карток',
    noDueToday: 'Немає карток для повторення сьогодні!',
    importedOk: (name, count) => `Колоду «${name}» імпортовано (${count} карток).`,
    invalidCsv: 'У CSV не знайдено коректних карток (потрібно 2 колонки).',
    resetConfirm: 'Скинути весь прогрес для цієї колоди?',
    deleteConfirm: 'Видалити цю колоду назавжди?',
    quitConfirm: 'Вийти з поточної сесії?',
    sessionComplete: (ok, bad) => `Сесію завершено!\nПравильно: ${ok}\nПомилок: ${bad}`,
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

    let i = 0;
    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i += 2;
                continue;
            }
            inQuotes = !inQuotes;
            i += 1;
            continue;
        }

        if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
            i += 1;
            continue;
        }

        current += char;
        i += 1;
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
        alert(UI_TEXT.noCardsToExport);
        return;
    }

    const jsPDF = globalThis.jspdf?.jsPDF;
    if (!jsPDF) {
        alert('jsPDF не завантажено. Перевірте підключення та перезавантажте сторінку.');
        return;
    }
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

    const safeName = deck.name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join('_');
    pdf.save(`${safeName || 'deck'}.pdf`);
}

// ============================================================================
// UI RENDERING
// ============================================================================

function showView(viewId) {
    document.querySelectorAll('.view').forEach(s => s.classList.add('is-hidden'));
    const view = document.getElementById(viewId);
    if (view) view.classList.remove('is-hidden');
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
            const col = document.createElement('div');
            col.className = 'column is-12-mobile is-6-tablet is-4-desktop';
            col.innerHTML = `
                <div class="deck-tile">
                    <div class="is-flex is-justify-content-space-between is-align-items-start mb-2">
                        <span class="deck-title">${deckInfo.name}</span>
                        <span class="tag is-light is-small">CSV</span>
                    </div>
                    <div class="deck-meta">${deckInfo.description ?? ''}</div>
                    <div class="deck-kpis" id="stats-${deckInfo.id}">
                        <div class="kpi">
                            <div class="value">0</div>
                            <div class="small">Всього</div>
                        </div>
                        <div class="kpi">
                            <div class="value">0</div>
                            <div class="small">До повторення</div>
                        </div>
                    </div>
                </div>
            `;

            col.querySelector('.deck-tile')?.addEventListener('click', async () => {
                await loadDefaultDeck(deckInfo);
                await showDeckStats(deckInfo.id);
            });

            defaultContainer.appendChild(col);

            // Load stats for default deck
            const stats = getStats(deckInfo.id);
            if (stats) {
                const statsEl = document.getElementById(`stats-${deckInfo.id}`);
                if (statsEl) {
                    statsEl.innerHTML = `
                        <div class="kpi">
                            <div class="value">${stats.total}</div>
                            <div class="small">Всього</div>
                        </div>
                        <div class="kpi">
                            <div class="value">${stats.due}</div>
                            <div class="small">До повторення</div>
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
        document.getElementById('userDecksContainer').classList.remove('is-hidden');
        const userContainer = document.getElementById('userDecksList');
        userContainer.innerHTML = '';

        for (const deckId of userDeckIds) {
            const deck = storage.decks[deckId];
            const stats = getStats(deckId);

            const col = document.createElement('div');
            col.className = 'column is-12-mobile is-6-tablet is-4-desktop';
            col.innerHTML = `
                <div class="deck-tile">
                    <div class="is-flex is-justify-content-space-between is-align-items-start mb-2">
                        <span class="deck-title">${deck.name}</span>
                        <span class="tag is-info is-light is-small">Моя</span>
                    </div>
                    <div class="deck-meta">${deck.cardOrder.length} карток</div>
                    <div class="deck-kpis">
                        <div class="kpi">
                            <div class="value">${stats?.total || 0}</div>
                            <div class="small">Всього</div>
                        </div>
                        <div class="kpi">
                            <div class="value">${stats?.due || 0}</div>
                            <div class="small">До повторення</div>
                        </div>
                    </div>
                </div>
            `;

            col.querySelector('.deck-tile')?.addEventListener('click', () => showDeckStats(deckId));
            userContainer.appendChild(col);
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

        const response = await fetch(`decks/${encodedFilename}`);
        const csvText = await response.text();
        const cards = parseCSV(csvText);

        if (cards.length === 0) {
            alert(UI_TEXT.noCardsInDeck);
            return;
        }

        await importDeck(cards, deckInfo.id, deckInfo.name, `decks/${encodedFilename}`);
    } catch (error) {
        console.error('Error loading default deck:', error);
        alert('Помилка завантаження колоди: ' + error.message);
    }
}

async function showDeckStats(deckId) {
    appState.currentDeck = deckId;
    const deck = getDeck(deckId);
    const stats = getStats(deckId);

    if (!deck || !stats) {
        alert(UI_TEXT.deckNotFound);
        return;
    }

    showView('deckStatsView');

    document.getElementById('deckNameDisplay').textContent = deck.name;
    document.getElementById('deckSourceDisplay').textContent = '';

    document.getElementById('totalCards').textContent = stats.total;
    document.getElementById('dueCards').textContent = stats.due;
    document.getElementById('learnedCards').textContent = stats.learned;
    document.getElementById('newCards').textContent = stats.new;
}

function setSessionMode(mode) {
    appState.sessionMode = mode;
    const badge = document.getElementById('modeBadge');
    const hint = document.getElementById('modeHint');
    const studyActions = document.getElementById('studyActions');
    const viewerActions = document.getElementById('viewerActions');
    const sessionStats = document.getElementById('sessionStats');

    if (mode === 'view') {
        badge.textContent = 'Перегляд';
        badge.className = 'tag is-info';
        hint.textContent = 'Гортайте картки. Натисніть на картку, щоб перевернути. ←/→ на клавіатурі.';
        studyActions.classList.add('is-hidden');
        viewerActions.classList.remove('is-hidden');
        sessionStats.textContent = '';
    } else {
        badge.textContent = 'Навчання';
        badge.className = 'tag is-primary';
        hint.textContent = 'Покажіть відповідь і оцініть себе. Клавіші: 1=Знову, 2=Складно, 3=Добре, 4=Легко.';
        studyActions.classList.remove('is-hidden');
        viewerActions.classList.add('is-hidden');
    }
}

function startDeckSession(mode) {
    const deckId = appState.currentDeck;
    const deck = getDeck(deckId);
    if (!deck) {
        alert(UI_TEXT.deckNotFound);
        return;
    }

    const sessionCards = mode === 'study' ? startStudySession(deckId) : deck.cards.slice();
    if (sessionCards.length === 0) {
        alert(mode === 'study' ? UI_TEXT.noDueToday : UI_TEXT.noCardsInDeck);
        return;
    }

    appState.sessionCards = sessionCards;
    appState.currentCardIndex = 0;
    appState.sessionStats = { correct: 0, wrong: 0 };
    appState.revealed = false;

    showView('studyView');
    document.getElementById('studyDeckName').textContent = deck.name;
    setSessionMode(mode);
    showCard();
}

function showStudyView() {
    startDeckSession('study');
}

function showViewerView() {
    startDeckSession('view');
}

function setFlipped(flipped) {
    const cardEl = document.getElementById('flashcard');
    if (!cardEl) return;
    cardEl.classList.toggle('is-flipped', flipped);
    appState.revealed = flipped;
}

function showCard() {
    const card = appState.sessionCards[appState.currentCardIndex];
    if (!card) return;

    document.getElementById('cardQuestion').textContent = card.front;
    document.getElementById('cardAnswer').textContent = card.back;

    // Reset flip & actions
    setFlipped(false);
    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) {
        revealBtn.textContent = appState.sessionMode === 'view' ? 'Перевернути' : 'Показати відповідь';
        revealBtn.classList.remove('is-hidden');
    }

    // Study-mode grading buttons
    const gradeBtns = ['againBtn', 'hardBtn', 'goodBtn', 'easyBtn'].map(id => document.getElementById(id));
    gradeBtns.forEach(btn => btn?.classList.add('is-hidden'));

    // Update counter
    const total = appState.sessionCards.length;
    const current = appState.currentCardIndex + 1;
    document.getElementById('cardCounter').textContent = `${current} / ${total}`;
    if (appState.sessionMode === 'study') {
        document.getElementById('sessionStats').textContent = `✓ ${appState.sessionStats.correct}  ✗ ${appState.sessionStats.wrong}`;
    } else {
        document.getElementById('sessionStats').textContent = '';
    }
}

function revealCard() {
    if (appState.sessionMode === 'view') {
        setFlipped(!appState.revealed);
        return;
    }

    setFlipped(true);
    const revealBtn = document.getElementById('revealBtn');
    revealBtn?.classList.add('is-hidden');

    ['againBtn', 'hardBtn', 'goodBtn', 'easyBtn'].forEach(id => {
        document.getElementById(id)?.classList.remove('is-hidden');
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
    alert(UI_TEXT.sessionComplete(stats.correct, stats.wrong));
    renderDeckSelection();
}

function nextCard() {
    if (appState.currentCardIndex < appState.sessionCards.length - 1) {
        appState.currentCardIndex++;
        showCard();
    }
}

function prevCard() {
    if (appState.currentCardIndex > 0) {
        appState.currentCardIndex--;
        showCard();
    }
}

function shuffleCards() {
    // Keep current card visible by re-finding it after shuffle
    const current = appState.sessionCards[appState.currentCardIndex];
    appState.sessionCards = appState.sessionCards.slice().sort(() => Math.random() - 0.5);
    const newIndex = appState.sessionCards.findIndex(c => c.cardId === current?.cardId);
    appState.currentCardIndex = Math.max(0, newIndex);
    showCard();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.getElementById('csvFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Update file name display for Bulma file input
    const fileNameEl = document.getElementById('csvFileName');
    if (fileNameEl) {
        fileNameEl.textContent = file.name;
    }

    const text = await file.text();
    const cards = parseCSV(text);

    if (cards.length === 0) {
        alert(UI_TEXT.invalidCsv);
        return;
    }

    const deckName = file.name.replace('.csv', '');
    const deckId = `deck-${Date.now()}`;

    await importDeck(cards, deckId, deckName);
    alert(UI_TEXT.importedOk(deckName, cards.length));

    e.target.value = '';
    if (fileNameEl) {
        fileNameEl.textContent = 'Файл не обрано';
    }
    renderDeckSelection();
});

document.getElementById('backToDeckBtn')?.addEventListener('click', renderDeckSelection);
document.getElementById('startStudyBtn')?.addEventListener('click', showStudyView);
document.getElementById('viewCardsBtn')?.addEventListener('click', showViewerView);
document.getElementById('printPdfBtn')?.addEventListener('click', () => exportDeckToPDF(appState.currentDeck));

document.getElementById('resetDeckBtn')?.addEventListener('click', () => {
    if (confirm(UI_TEXT.resetConfirm)) {
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
    if (confirm(UI_TEXT.deleteConfirm)) {
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

document.getElementById('flashcard')?.addEventListener('click', () => {
    if (appState.sessionMode === 'study') {
        if (!appState.revealed) revealCard();
    } else {
        revealCard();
    }
});

document.getElementById('flashcard')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (appState.sessionMode === 'study') {
            if (!appState.revealed) revealCard();
        } else {
            revealCard();
        }
    }
});

document.getElementById('revealBtn')?.addEventListener('click', revealCard);

document.getElementById('againBtn')?.addEventListener('click', () => reviewAndNext(0));
document.getElementById('hardBtn')?.addEventListener('click', () => reviewAndNext(1));
document.getElementById('goodBtn')?.addEventListener('click', () => reviewAndNext(3));
document.getElementById('easyBtn')?.addEventListener('click', () => reviewAndNext(5));

document.getElementById('quitStudyBtn')?.addEventListener('click', () => {
    if (confirm(UI_TEXT.quitConfirm)) renderDeckSelection();
});

document.getElementById('prevBtn')?.addEventListener('click', prevCard);
document.getElementById('nextBtn')?.addEventListener('click', nextCard);
document.getElementById('shuffleBtn')?.addEventListener('click', shuffleCards);

// Keyboard shortcuts in session view
document.addEventListener('keydown', (e) => {
    const studyView = document.getElementById('studyView');
    if (!studyView || studyView.classList.contains('d-none')) return;

    if (e.key === 'ArrowLeft') {
        if (appState.sessionMode === 'view') prevCard();
        return;
    }
    if (e.key === 'ArrowRight') {
        if (appState.sessionMode === 'view') nextCard();
        return;
    }

    if (appState.sessionMode !== 'study') return;
    if (!appState.revealed) return;

    if (e.key === '1') reviewAndNext(0);
    if (e.key === '2') reviewAndNext(1);
    if (e.key === '3') reviewAndNext(3);
    if (e.key === '4') reviewAndNext(5);
});

// Simple swipe navigation for view mode
let touchStartX = null;
document.getElementById('flashcard')?.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches?.[0]?.clientX ?? null;
}, { passive: true });

document.getElementById('flashcard')?.addEventListener('touchend', (e) => {
    if (appState.sessionMode !== 'view') return;
    const endX = e.changedTouches?.[0]?.clientX ?? null;
    if (touchStartX == null || endX == null) return;
    const dx = endX - touchStartX;
    if (Math.abs(dx) < 50) return;
    if (dx > 0) prevCard();
    else nextCard();
    touchStartX = null;
}, { passive: true });

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
                            updateBtn.classList.remove('is-hidden');
                            updateBtn.onclick = () => {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                globalThis.location.reload();
                            };
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
