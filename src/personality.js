const MESSAGES = {
  green: [
    'Green day. Okay, account growth. We see you.',
    'Rent paid. Candles respected.',
    'Profit locked. The journal approves this plotline.',
    'The market gave; you received. Nice.',
    'Generational P&L. No further questions.',
    'Green day secured. Keep the process repeatable.',
  ],
  greenDisciplined: [
    'BRO IS HIM. 🗿',
    'Aura +1000. Execution was immaculate.',
    'The setup set up. The plan planned.',
    'Generational execution. No notes.',
    'Bro followed the rules AND made money? Generational.',
  ],
  greenWithMistakes: [
    'Green day secured. We can clean up the execution next.',
    'The P&L said W. The notes have one tiny side quest.',
    'Profit is profit. Let’s keep the process as clean as the close.',
    'You got paid. Next level: same result, fewer plot twists.',
  ],
  red: [
    'The market had personal beef with you today.',
    'Character development arc begins.',
    'It’s okay gang. We do NOT revenge trade for the plot.',
    'One red day doesn’t define the trader.',
    'A red day is feedback, not a personality trait.',
    'Close the charts. The comeback arc can wait until tomorrow.',
  ],
  noTrades: [
    'Hello??? We opening the journal or what 😭',
    'The market opened. You opened nothing.',
    'Bro disappeared like a backtested strategy.',
    'No trades logged. Are we disciplined or just AFK?',
    'I’m literally a trading journal. Give me something to journal 💀',
  ],
  noTradeReviewed: [
    '0 trades. 100% discipline. Lowkey elite.',
    'No setup, no trade. We love a locked-in king.',
    'You protected your capital. That’s a W.',
    'The best trade was the one you didn’t force.',
  ],
  flat: [
    'Flat day. The plot took a little intermission.',
    'Breakeven: wallet said “we move.”',
    'No net damage. Reset the vibe and run it back tomorrow.',
  ],
};

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function choosePersonalityMessage(category, contextKey) {
  const messages = MESSAGES[category] || MESSAGES.flat;
  const storageKey = `zerotilt_personality_recent_${category}`;
  const startIndex = hashText(`${category}:${contextKey}`) % messages.length;

  try {
    const recent = JSON.parse(localStorage.getItem(storageKey) || '[]');
    let selectedIndex = startIndex;
    for (let offset = 0; offset < messages.length; offset += 1) {
      const candidate = (startIndex + offset) % messages.length;
      if (!recent.includes(candidate)) {
        selectedIndex = candidate;
        break;
      }
    }
    localStorage.setItem(storageKey, JSON.stringify([selectedIndex, ...recent.filter((index) => index !== selectedIndex)].slice(0, 3)));
    return messages[selectedIndex];
  } catch {
    return messages[startIndex];
  }
}

export function readNoSetupReview(profileId, date) {
  try {
    const reviews = JSON.parse(localStorage.getItem(`tradelog_no_setup_reviews_${profileId}`) || '{}');
    return reviews[date] === true;
  } catch {
    return false;
  }
}

export function toggleNoSetupReview(profileId, date) {
  try {
    const key = `tradelog_no_setup_reviews_${profileId}`;
    const reviews = JSON.parse(localStorage.getItem(key) || '{}');
    if (reviews[date]) delete reviews[date];
    else reviews[date] = true;
    localStorage.setItem(key, JSON.stringify(reviews));
    return reviews[date] === true;
  } catch {
    return false;
  }
}

export function clearNoSetupReview(profileId, date) {
  try {
    const key = `tradelog_no_setup_reviews_${profileId}`;
    const reviews = JSON.parse(localStorage.getItem(key) || '{}');
    if (!reviews[date]) return;
    delete reviews[date];
    localStorage.setItem(key, JSON.stringify(reviews));
  } catch {
    // A missing session-review preference should never interrupt trade logging.
  }
}
