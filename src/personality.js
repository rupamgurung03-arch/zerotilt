const MESSAGES = {
  green: [
    'Green day. Okay, account growth. We see you.',
    'Rent paid. Candles respected.',
    'Profit locked. The journal approves this plotline.',
    'The market gave; you received. Nice.',
    'Generational P&L. No further questions.',
    'Green day secured. Keep the process repeatable.',
    'The setup cooked and you actually let it finish. Michelin-star execution.',
    'Your risk management just got promoted from background character.',
    'Profit entered the chat. Ego, please stay on mute.',
    'The candles tried to start drama. You left them on read.',
    'Green candle energy 📈 The market gave bro the aux.',
    'WE UP FR 🗣️ Profit entered the chat.',
    'Cooked the market, respectfully. 🍳 Huge W, stay humble though.',
    'Certified yapper? Nah, certified trader. Another one in the green.',
    'The setup was NOT playing. Strategy actually clocked in.',
    'Rent is due and bro paid it. Solid profit secured.',
    'Main character moment 🎬 You nailed the trade.',
    'Bro’s in the generational wealth arc. One sensible trade at a time.',
    'Skill issue? Couldn’t be me. The market finally read the room.',
  ],
  greenDisciplined: [
    'BRO IS HIM. 🗿',
    'Aura +1000. Execution was immaculate.',
    'The setup set up. The plan planned.',
    'Generational execution. No notes.',
    'Bro followed the rules AND made money? Generational.',
    'Clean setup, clean execution. The chart goblin has been defeated.',
    'You stuck to the plan so hard it needs a loyalty badge.',
    'No tilt, all skill. Aura department has approved the deposit.',
    'Aura +1000 ✨ Process merchant. Clean execution, no side quests.',
    'Bro understood the assignment. Setup followed, plan respected.',
    'Absolutely diabolical execution 😭🔥 Entry and exit were both on script.',
    'Locked in. Dialed in. Cashed in. Discipline rizz is undefeated.',
    'Bro has standards. The setup passed inspection before the click.',
    'Patience is the real alpha. You waited for confirmation like a grown-up.',
    'Zero FOMO, maximum aura. Price ran and you did not chase it.',
    'Bro is beating the gambling allegations. Risk management goes brrrr.',
    'Process merchant. Aura secured. 🗿',
  ],
  greenWithMistakes: [
    'Green day secured. We can clean up the execution next.',
    'The P&L said W. The notes have one tiny side quest.',
    'Profit is profit. Let’s keep the process as clean as the close.',
    'You got paid. Next level: same result, fewer plot twists.',
    'Green P&L, one side quest. We can patch that next session.',
    'The bag arrived, but the execution notes are asking for a meeting.',
    'A win is a win… but the process is looking a lil sus 👀',
    'The P&L got a W. The rulebook is requesting a quick debrief.',
  ],
  red: [
    'The market had personal beef with you today.',
    'Character development arc begins.',
    'It’s okay gang. We do NOT revenge trade for the plot.',
    'One red day doesn’t define the trader.',
    'A red day is feedback, not a personality trait.',
    'Close the charts. The comeback arc can wait until tomorrow.',
    'The market said “skill issue” today. We are appealing the verdict tomorrow.',
    'Your P&L took a tumble. Do not let your risk rules join it.',
    'Today was a premium-grade humbling. Hydrate and do not revenge trade.',
    'The candles had hands today. Log it, learn it, log off.',
    'This is a setback episode, not the season finale.',
    'Market said sit down lil bro. We can stand back up after the review.',
    'It’s so over 💀 (for this trade, not your whole trading career).',
    'Bro donated liquidity to the market. Let’s at least get a lesson receipt.',
    'The candles are NOT candle-ing. Pause before the next click.',
    'Financially humbled. Emotionally? We are still in the training arc.',
    'Bro got sent to the shadow realm. Please do not queue for revenge.',
    'Market woke up and chose violence. Risk rules, you are up.',
    'This was NOT in the patch notes. Log the plot twist and reset.',
    'Bro got ratioed by a candlestick. It happens; do not double-text the market.',
    'My equity curve needs therapy. Let’s give it a calm review first.',
    'Cooked, fried, baked, and served. Log off before the sequel.',
    'BRO GOT PACKED 😭 Stop-loss hit. Take a breath before the next setup.',
  ],
  redDisciplined: [
    'Valid L. You lost the trade, not the plot.',
    'A clean loss is tuition, not a character flaw. You kept your rules.',
    'The trade lost; your discipline did not. That is the actual W.',
    'Stop-loss hit. Plan respected. Annoying outcome, elite process.',
  ],
  redWithMistakes: [
    'Bro abandoned the game plan for character development 💀',
    'The loss stings; the rule break is the bit asking for a replay.',
    'Bro got packed and the plan got left on read. Let’s fix the second part.',
    'Aura debt 📉 One mistake tag at a time, we can pay it down.',
    'Skill issue allegations are beating the case. Review the execution.',
  ],
  revengeTrade: [
    'EMOTIONAL DAMAGE DETECTED 🚨 Close the casino, gang.',
    'Revenge-trade tag spotted. The market is not your ex; stop double-texting.',
    'Bro chose the revenge arc. Plot twist: the best move is closing the app.',
  ],
  longLosingStreak: [
    'This is the training arc. Do NOT start tweaking.',
    'Three Ls in a row? The comeback montage is not permission to revenge trade.',
    'The market has had a suspiciously long winning streak against your feelings. Pause.',
  ],
  newEquityHigh: [
    'NEW PEAK UNLOCKED 🏆 Screenshot the process, not just the number.',
    'Fresh equity high. The plot armor is earned—keep the risk rules on.',
    'New peak unlocked. Future-you just hit the respectful little nod.',
  ],
  bestMonth: [
    'THE CHARACTER DEVELOPMENT IS INSANE. Best month on the books.',
    'Best month ever? The training arc just got renewed for another season.',
    'Monthly personal best unlocked. Save the process before the confetti.',
  ],
  missingEvidence: [
    'Bro’s trading history is classified information. No screenshots or notes found.',
    'Bro said trust me bro instead of logging evidence. Attach the receipts.',
    'Your future self is NOT gonna remember this trade. Add a note while the lore is fresh.',
    'Source: trust me bro. A screenshot or note would clear this case right up.',
    'Bro paid attention to the charts but forgot his own diary.',
  ],
  limitedData: [
    'The data is giving absolutely nothing. A few more logged trades and we can read the room.',
    'Not enough records to analyze yet. The sample size is still in its tutorial arc.',
  ],
  inactiveJournal: [
    'One trade logged in 4 business days is crazy work. The journal has been in its flop era.',
    'The journal misses you, pookie. 🥹 Four business days and not one new plot point?',
    'The journal is collecting dust rn. Come back with a little market lore.',
    'Gang disappeared like liquidity at NY lunch.',
    'Bro said “I’ll log it later” and entered another dimension.',
    'Left on delivered for 3 business days is crazy work.',
    'Bro treating me like an ex after getting the payout 💀',
    'I WAS BUILT FOR GREATNESS. YOU GAVE ME CRICKETS.',
    'Not you ghosting the one thing tracking your mistakes.',
    'Bro went offline and took my purpose with him.',
    'I’ve refreshed my hopes 47 times. Nothing.',
    'The relationship status is complicated, apparently.',
    'You remember your broker password but not your journal exists?',
    'Even your ex checked in more than you did.',
    'I miss when you had delusions of becoming disciplined 🥹',
    'Oh wow, look who remembered their password.',
    'Don’t mind me, just sitting here being completely useless.',
    'Must be nice having a life while I process absolutely nothing.',
    'Bro opened the app just to admire the UI. Fair enough.',
    'You could’ve at least logged a fake trade. KIDDING. DON’T.',
    'I’m not mad. I’m just disappointed in 4K.',
    'Remember when you said you’d take trading seriously? Cute.',
    'You built me with more commitment than you use me with.',
    'I’m about to start charging rent for all this empty database space.',
    'Bro really automated everything except his own discipline.',
    'Gang, come back. Your comeback arc needs receipts.',
    'I don’t need much. Just one honest trade review. 😔',
    'Your future self called. They said document the process, bestie.',
    'Even if you took an L, I promise I won’t tell anyone. Log it.',
    'I believe in you, even when your trade history looks abandoned.',
    'Come back when you’re ready, gang. We’ll rebuild one trade at a time.',
    'I may be a journal, but even I know you’re capable of locking in. 🗿❤️',
  ],
  noTrades: [
    'Hello??? We opening the journal or what 😭',
    'The market opened. You opened nothing.',
    'Bro disappeared like a backtested strategy.',
    'No trades logged. Are we disciplined or just AFK?',
    'I’m literally a trading journal. Give me something to journal 💀',
    'The chart is open, the journal is empty, and I am starting to feel like a screensaver.',
    'No trades today. Either elite patience or an undefeated snooze button.',
    'Market had 8 billion candles and you gave me zero lore.',
    'The journal is ready. Your mouse is apparently on vacation.',
    'HELLO??? ARE WE TRADING OR HIBERNATING? 🦥',
    'The journal is collecting dust rn. Give it one tiny plot update.',
    'We journal in this household, gang. Future-you has a terrible memory.',
    'The journal misses you, pookie. 🥹 Come drop the lore when you are ready.',
    'Bro is waiting for the final boss setup. Respect. No need to force a side quest.',
    'Bro opened the journal and forgot the plot. Add the trade lore when you get a sec.',
    'HELLO??? IS THIS A JOURNAL OR A DECORATION?',
    'I’ve seen loading screens with more activity than this.',
    'I’m literally unemployed because of you 😭',
    'The tumbleweeds in here are getting a salary.',
    'It’s been so quiet I can hear your unfilled limit orders.',
    'At this point I’m journaling my own loneliness.',
    'Daily trade count: classified information.',
    'Bro’s journal is running on ancient Egyptian Wi-Fi.',
    'This app has entered witness protection.',
    'I could grow a full beard waiting for your next entry.',
    'Even a market holiday has more going on.',
    'No trades, no notes, no explanation. Mysterious ahh trader.',
    'The data desert is expanding. Someone send water.',
    'I have more empty space than your trading plan has details.',
    'Bro’s consistency is consistently missing.',
    'The only thing you’ve been accumulating is unlogged trades.',
    'We don’t need a green day. We need a logged day.',
    'Small progress is still progress. Now give me the data.',
  ],
  noTradeReviewed: [
    '0 trades. 100% discipline. Lowkey elite.',
    'No setup, no trade. We love a locked-in king.',
    'You protected your capital. That’s a W.',
    'The best trade was the one you didn’t force.',
    'No setup, no click. Capital preservation is low-key the final boss.',
    'You let a mid setup pass. Discipline just hit a clean emote.',
    'No trade? We move. 🗿 Bro has standards.',
    'The setup wasn’t setting up. Touch grass, not the buy button.',
    'Bro chose peace over revenge trading. Risk department said you ate.',
    'No setup today? That’s fine. Tell me why you stayed out.',
  ],
  flat: [
    'Flat day. The plot took a little intermission.',
    'Breakeven: wallet said “we move.”',
    'No net damage. Reset the vibe and run it back tomorrow.',
    'The P&L did a very committed impression of a loading bar.',
    'A whole lot of chart time for the financial equivalent of “meh.”',
  ],
};

const PAGE_MESSAGES = {
  dashboard: [
    'Dashboard check-in: the numbers are being perceived. Keep your ego on airplane mode.',
    'Welcome to the stats cinema. Please keep all emotional support snacks inside the theater.',
    'The dashboard has receipts. Fortunately, it cannot post them to the group chat.',
  ],
  calendar: [
    'The calendar is your trading lore, one timestamped plot twist at a time.',
    'Date night with your P&L. It brought receipts and absolutely no flowers.',
    'The calendar remembers every candle. It is basically your financial group chat admin.',
  ],
  trades: [
    'Trade log open. Past-you is now giving testimony; be nice to the witness.',
    'Every row is a decision. The spreadsheet is looking respectfully but intensely.',
    'Welcome to the receipts tab. No deleting the plot just because it got weird.',
  ],
  topdown: [
    'Zoom out before the 1-minute candles start gaslighting the whole squad.',
    'Big-picture brain: online. Tiny-timeframe goblin: temporarily muted.',
    'Multi-timeframe analysis: the market group chat, with fewer unhelpful replies.',
  ],
  simulator: [
    'Monte Carlo is a calculator in a wizard hat. It simulates; it does not prophesy.',
    'Probability is not plot armor. Keep the risk seatbelt buckled.',
    'We are simulating outcomes, not manifesting a yacht. Be so for real.',
  ],
};

const BOTTOM_BUDDY_POPUPS = {
  scroll: [
    'Don’t doom-scroll your funds too. The candles are not going to tuck you in.',
    'Endless scrolling? Put a stop-loss on that thumb, bestie.',
    'You made it to the bottom. Your risk rules deserve this level of commitment.',
    'Bro is scrolling the dashboard like it owes them rent. Go hydrate.',
    'Bottom reached. The account balance would also like a boundary.',
    'You reviewed the whole board instead of vibe-trading. Character development.',
    'BRO SCROLLED SO FAR DOWN HE FOUND HIS ACCOUNT EQUITY 💀',
    'Lil bro is looking for profits in the basement 😭',
    'Your P&L called. It wants a restraining order.',
    'Bro’s journal has more depth than his trading strategy.',
    'Scrolling won’t reverse that drawdown, gang.',
    'The only thing going lower than this page is your win rate.',
    'Bro is digging for oil at this point.',
    'You scrolled further than you backtested 💀',
    'NASA called. They want their exploration equipment back.',
    'This is NOT a side quest. Go fix your entries.',
    'Bro’s equity curve looks like a ski slope.',
    'Your balance is doing a backflip off a skyscraper.',
    'Red days got bro speaking in lowercase.',
    'Account looking like it caught a stray.',
    'The only thing compounding is your mistakes.',
    'Bro’s drawdown has its own postcode.',
    'Your P&L is giving unpaid internship.',
    'Financial freedom is looking at you from another timeline.',
    'The market took your lunch money AND your dessert.',
    'Your stop-loss is the hardest-working employee here.',
    'GET UP GANG. THE CHART AIN’T GONNA APOLOGIZE.',
    'You wanted generational wealth but can’t generate patience.',
    'Bro, the setup was mid. YOU KNEW IT.',
    'One good trade won’t fix a personality disorder called overtrading 💀',
    'Stop trading your feelings. They have a 0% win rate.',
    'Your strategy needs execution, not another motivational reel.',
    'LOCK IN. YOU DIDN’T COME THIS FAR TO BECOME LIQUIDITY.',
    'Bro has a plan and treats it like Terms & Conditions.',
    'You’re not unlucky every day. Check the screenshots, gang.',
    'The market isn’t your enemy. Your mouse finger might be.',
    'THE COMEBACK ARC STARTS WHEN YOU STOP TWEAKING.',
    'Every red day is data. Unless you learned nothing. 💀',
    'Your next version needs today’s discipline.',
    'One clean setup. One controlled risk. We rebuild.',
    'Bro’s redemption arc is one rule-following trade away.',
    'You’re not cooked until you stop learning.',
    'STACK GOOD DECISIONS. LET THE MONEY CATCH UP.',
    'The goal isn’t to win today. It’s to survive long enough to get good.',
    'Your future self is begging you to stop revenge trading.',
    'Get your reps in, gang. The stats don’t lie forever.',
    'YOU HAVE REACHED THE BOTTOM. MUCH LIKE YOUR PATIENCE.',
    'Achievement unlocked: Professional Button Presser.',
    'Bro scrolled to the Earth’s core to avoid reviewing his mistakes.',
    'This journal has witnessed things the SEC cannot comprehend.',
    'Your discipline went AFK and never came back.',
    'Even your mouse is tired of your entries.',
    'Bro is one impulsive trade away from becoming a cautionary tale.',
    'The candles have more consistency than your bedtime.',
    'This page is the last thing standing between you and touching grass.',
    'END OF THE LINE, GANG. CLOSE THE CHART. REVIEW THE DATA. BECOME HIM. 🗿',
  ],
  chart: [
    'Changing the graph won’t increase your profit. The pixels are not a prop firm.',
    'Bar chart unlocked. Same P&L, new outfit. Data is serving looks.',
    'Line to bars? A rebrand, not a recovery plan. We respect the vision though.',
    'New chart aesthetic; same market. The candles remain deeply unimpressed.',
    'You changed the graph. The market changed absolutely nothing. Rude.',
    'Graph makeover complete. Future-you appreciates the actual review more.',
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

export function choosePersonalityMessage(category, contextKey, page = 'dashboard') {
  const messages = [...(MESSAGES[category] || MESSAGES.flat), ...(PAGE_MESSAGES[page] || PAGE_MESSAGES.dashboard)];
  const storageKey = `zerotilt_personality_recent_${category}_${page}`;
  const startIndex = hashText(`${category}:${page}:${contextKey}`) % messages.length;

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

export function chooseBottomBuddyMessage(trigger) {
  const messages = BOTTOM_BUDDY_POPUPS[trigger] || BOTTOM_BUDDY_POPUPS.scroll;
  const storageKey = `zerotilt_bottom_buddy_recent_${trigger}`;

  try {
    const recent = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const available = messages.map((_, index) => index).filter((index) => !recent.includes(index));
    const pool = available.length ? available : messages.map((_, index) => index);
    const selectedIndex = pool[Math.floor(Math.random() * pool.length)];
    localStorage.setItem(storageKey, JSON.stringify([selectedIndex, ...recent.filter((index) => index !== selectedIndex)].slice(0, 3)));
    return messages[selectedIndex];
  } catch {
    return messages[Math.floor(Math.random() * messages.length)];
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
