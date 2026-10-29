import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase, signInWithEmail, signUpWithEmail, sendPasswordResetEmail, signOut, isSupabaseConfigured } from './supabase';
import { chooseBottomBuddyMessage, choosePersonalityMessage, clearNoSetupReview, readNoSetupReview, toggleNoSetupReview } from './personality';
import './styles.css';

const PSYCHOLOGY_OPTIONS = [
  { label: 'Disciplined', type: 'positive' },
  { label: 'Patient', type: 'positive' },
  { label: 'FOMO', type: 'negative' },
  { label: 'Fear', type: 'negative' },
  { label: 'Greed', type: 'negative' },
  { label: 'Impatience', type: 'negative' },
  { label: 'Revenge Trade', type: 'negative' },
  { label: 'Hesitation', type: 'negative' },
  { label: 'Overconfidence', type: 'negative' },
];

const MISTAKE_TAGS = ['Moved stop', 'Late entry', 'Overtraded', 'Exited early', 'Chased price', 'Ignored plan'];

const INSTRUMENT_PRESETS = [
  { category: 'Indices', assets: ['ES', 'NQ', 'YM', 'RTY', 'DAX', 'FTSE'] },
  { category: 'FX', assets: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD'] },
  { category: 'Commodities', assets: ['GC', 'SI', 'HG', 'NG'] },
  { category: 'Oil', assets: ['CL', 'BRN'] },
  { category: 'Crypto', assets: ['BTC', 'ETH'] },
];

const normalizeAssetSymbol = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
const isValidAssetSymbol = (value) => /^[A-Z0-9][A-Z0-9._/ -]{0,19}$/.test(value);

const DEFAULT_PROFILES = [
  { id: 'default', name: 'Main Account' },
];

const DEFAULT_TRADE_FILTERS = { instrument: 'all', psychology: 'all', direction: 'all', mistake: 'all', timeOfDay: 'all', period: 'all' };
const DEFAULT_TRADE_DEFAULTS = { instrument: 'NQ', direction: 'Long', setup: '15m S/R', risk: '' };
const TIME_ZONE_OPTIONS = typeof Intl.supportedValuesOf === 'function'
  ? [...new Set(['UTC', ...Intl.supportedValuesOf('timeZone')])]
  : ['UTC', 'Asia/Kolkata', 'Asia/Tokyo', 'Asia/Singapore', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Australia/Sydney'];

function isValidTimeZone(timeZone) {
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(); return true; } catch { return false; }
}

function getDeviceTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(timeZone) ? timeZone : 'UTC';
}

function getZonedDateTimeParts(date = new Date(), timeZone = getDeviceTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function getZonedDateString(date = new Date(), timeZone = getDeviceTimeZone()) {
  const parts = getZonedDateTimeParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getZonedTimeString(date = new Date(), timeZone = getDeviceTimeZone()) {
  const parts = getZonedDateTimeParts(date, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

function getZonedDateTime(date = new Date(), timeZone = getDeviceTimeZone()) {
  return { date: getZonedDateString(date, timeZone), time: getZonedTimeString(date, timeZone), timeZone };
}

function zonedWallTimeToDate(dateString, timeString, timeZone = getDeviceTimeZone()) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(timeString || ''));
  if (!dateMatch || !timeMatch || !isValidTimeZone(timeZone)) return new Date(NaN);
  const [, year, month, day] = dateMatch;
  const [, hour, minute, second = '0'] = timeMatch;
  const targetUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  let guess = targetUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedDateTimeParts(new Date(guess), timeZone);
    const representedUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(second));
    const correction = representedUtc - guess;
    if (correction === 0) break;
    guess = targetUtc - correction;
  }
  return new Date(guess);
}

function getTradeInstant(trade, fallbackTimeZone = getDeviceTimeZone()) {
  if (trade?._timestamp) {
    const savedInstant = new Date(trade._timestamp);
    if (!Number.isNaN(savedInstant.getTime())) return savedInstant;
  }
  return zonedWallTimeToDate(trade?.date, trade?.time || '00:00', trade?.timeZone || fallbackTimeZone);
}

function getUtcOffsetLabel(timeZone, date = new Date()) {
  const value = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'GMT';
  return value.replace(/^GMT/, 'UTC');
}

function getTimeZoneCity(timeZone) {
  if (timeZone === 'Asia/Kolkata' || timeZone === 'Asia/Calcutta') return 'Calcutta';
  return timeZone === 'UTC' ? 'UTC' : String(timeZone || '').split('/').at(-1).replaceAll('_', ' ');
}

const EMPTY_FORM = {
  id: null,
  date: new Date().toISOString().split('T')[0],
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
  instrument: 'NQ',
  direction: 'Long',
  entry: '',
  stopLoss: '',
  takeProfit: '',
  exit: '',
  risk: '',
  resultR: '',
  commissionCost: '',
  spreadCost: '',
  setup: '15m S/R',
  plannedEntry: '',
  plannedStopLoss: '',
  plannedTakeProfit: '',
  psychology: [],
  mistakes: [],
  plannedTradingViewUrl: '',
  tradingViewUrl: '',
  plannedScreenshotUrl: '',
  screenshotUrl: '',
  notes: '',
};

function getLocalGreeting(timeZone = getDeviceTimeZone()) {
  const hour = Number(getZonedTimeString(new Date(), timeZone).slice(0, 2));
  if (hour < 12) return 'Good morning.';
  if (hour < 18) return 'Good afternoon.';
  return 'Good evening.';
}

function getTimeOfDayBucket(time) {
  const hour = parseInt((time || '').split(':')[0], 10);
  if (Number.isNaN(hour)) return '';
  if (hour < 6) return '00-06';
  if (hour < 12) return '06-12';
  if (hour < 18) return '12-18';
  return '18-24';
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

const TRADE_META_MARKER = '[[TRADING_JOURNAL_META_V1:';
const isDatabaseUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

function splitStoredTradeNotes(value = '') {
  const markerIndex = value.lastIndexOf(TRADE_META_MARKER);
  if (markerIndex < 0) return { notes: value, metadata: null };
  const endIndex = value.indexOf(']]', markerIndex);
  if (endIndex < 0) return { notes: value, metadata: null };
  try {
    const encoded = value.slice(markerIndex + TRADE_META_MARKER.length, endIndex);
    return { notes: value.slice(0, markerIndex).trimEnd(), metadata: JSON.parse(decodeURIComponent(encoded)) };
  } catch {
    return { notes: value, metadata: null };
  }
}

function isDemoTrade(trade) {
  const notes = String(trade?.notes || '').trim();
  if (/^demo\s*:/i.test(notes)) return true;
  const localId = String(trade?._localTradeId || trade?.id || '');
  return (localId === '1' && trade?.date === '2026-10-27' && trade?.instrument === 'NQ' && notes === 'Clean bounce off 15m S/R zone. Held to TP target.')
    || (localId === '2' && trade?.date === '2026-10-26' && trade?.instrument === 'NQ' && notes === 'Rejection at key resistance.');
}

function journalTradeToDatabaseRow(trade, userId, profileId) {
  const fullTrade = { ...trade };
  delete fullTrade.id;
  delete fullTrade.notes;
  delete fullTrade._localTradeId;
  delete fullTrade._profileId;
  delete fullTrade._timestamp;
  delete fullTrade._timestampChanged;
  ['screenshotUrl', 'plannedScreenshotUrl'].forEach((field) => {
    if (String(fullTrade[field] || '').startsWith('data:')) fullTrade[field] = '';
  });
  const metadata = {
    trade: fullTrade,
    localTradeId: String(trade._localTradeId || trade.id || ''),
    profileId,
  };
  const noteText = String(trade.notes || '').trimEnd();
  const notes = `${noteText}${noteText ? '\n\n' : ''}${TRADE_META_MARKER}${encodeURIComponent(JSON.stringify(metadata))}]]`;
  const parseNumeric = (value) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  };
  const risk = parseNumeric(trade.risk);
  const resultR = parseNumeric(trade.resultR);
  const executionCosts = (parseNumeric(trade.commissionCost) || 0) + (parseNumeric(trade.spreadCost) || 0);
  const pnl = risk === null || resultR === null ? null : (risk * resultR) - executionCosts;
  const preservedTimestamp = trade._timestamp && !trade._timestampChanged ? new Date(trade._timestamp) : null;
  const tradeDate = preservedTimestamp && !Number.isNaN(preservedTimestamp.getTime())
    ? preservedTimestamp
    : trade.date && trade.time
    ? zonedWallTimeToDate(trade.date, trade.time, trade.timeZone || getDeviceTimeZone())
    : trade.date ? new Date(`${trade.date}T12:00:00`) : new Date();
  const row = {
    user_id: userId,
    symbol: String(trade.instrument || 'Unknown'),
    trade_type: trade.direction === 'Short' ? 'SELL' : 'BUY',
    entry_price: parseNumeric(trade.entry),
    exit_price: parseNumeric(trade.exit),
    pnl,
    notes,
    created_at: Number.isNaN(tradeDate.getTime()) ? new Date().toISOString() : tradeDate.toISOString(),
  };
  if (isDatabaseUuid(trade.id)) row.id = trade.id;
  return row;
}

function databaseRowToJournalTrade(row, displayTimeZone = getDeviceTimeZone()) {
  const { notes, metadata } = splitStoredTradeNotes(row.notes || '');
  const trade = metadata?.trade || {};
  const createdAt = row.created_at ? new Date(row.created_at) : new Date();
  const date = !Number.isNaN(createdAt.getTime()) ? getZonedDateString(createdAt, displayTimeZone) : getLocalDateString();
  const time = !Number.isNaN(createdAt.getTime())
    ? getZonedTimeString(createdAt, displayTimeZone)
    : '';
  const parsedPnl = Number.parseFloat(row.pnl);
  const parsedRisk = Number.parseFloat(trade.risk);
  const derivedR = Number.isFinite(parsedPnl) && Number.isFinite(parsedRisk) && parsedRisk > 0 ? (parsedPnl / parsedRisk).toFixed(1) : 0;
  return {
    ...trade,
    id: row.id,
    _localTradeId: metadata?.localTradeId || row.id,
    _profileId: metadata?.profileId || 'default',
    _timestamp: !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : null,
    date,
    time,
    timeZone: displayTimeZone,
    instrument: row.symbol || trade.instrument || '',
    direction: row.trade_type === 'SELL' ? 'Short' : row.trade_type === 'BUY' ? 'Long' : (trade.direction || 'Long'),
    entry: row.entry_price ?? trade.entry ?? '',
    exit: row.exit_price ?? trade.exit ?? '',
    resultR: trade.resultR ?? derivedR,
    notes,
  };
}

function compressAnalysisImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('That image format could not be opened.'));
      image.onload = () => {
        const maxDimension = 1440;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function countBusinessDaysSince(dateString, todayString) {
  if (!dateString || dateString >= todayString) return 0;
  const cursor = new Date(`${dateString}T12:00:00`);
  const today = new Date(`${todayString}T12:00:00`);
  let businessDays = 0;
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= today) {
    const weekday = cursor.getDay();
    if (weekday > 0 && weekday < 6) businessDays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return businessDays;
}

function PersonalityNudge({ category, contextKey, page }) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    setMessage(choosePersonalityMessage(category, contextKey, page));
  }, [category, contextKey, page]);

  if (!message) return null;
  const tone = category.startsWith('green') || category === 'noTradeReviewed' ? 'positive' : category.startsWith('red') || category === 'revengeTrade' ? 'negative' : 'neutral';
  return (
    <aside className={`personality-nudge ${tone}`} role="status" aria-live="polite">
      <span className="personality-nudge-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4.1a2.5 2.5 0 0 1-2.5-2.4Z"/><path d="M8 8h8M8 11.5h5"/></svg>
      </span>
      <div className="personality-nudge-copy">
        <span className="personality-nudge-label">PIP SQUEAK</span>
        <p>{message}</p>
      </div>
    </aside>
  );
}

function normalizeTopDownData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  if (Array.isArray(data.cards)) return { cards: data.cards };

  const legacyTimeframes = {
    weekly: 'Weekly overview',
    daily: 'Daily',
    '4h': '4 hour',
    '1h': '1 hour',
    '15m': '15 minute',
  };
  const legacyPeriods = Object.keys(legacyTimeframes).some((key) => Object.hasOwn(data, key))
    ? { [`month:${getLocalDateString().slice(0, 7)}`]: data }
    : data;
  const cards = [];
  Object.entries(legacyPeriods).forEach(([period, sections]) => {
    if (!sections || typeof sections !== 'object') return;
    const date = period.startsWith('month:') ? `${period.slice(6)}-01`
      : period.startsWith('week:') ? period.slice(5)
        : getLocalDateString();
    Object.entries(legacyTimeframes).forEach(([timeframe, title]) => {
      const section = sections[timeframe];
      if (!section || !(section.imageData || section.tradingViewUrl || section.notes)) return;
      cards.push({
        id: `migrated-${period}-${timeframe}`,
        date,
        title,
        timeframe: title,
        imageData: section.imageData || '',
        imageName: section.imageName || '',
        tradingViewUrl: section.tradingViewUrl || '',
        referenceUrl: '',
        description: section.notes || '',
      });
    });
  });
  return { cards };
}

function App() {
  // --- Supabase Authentication State ---
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [cloudSyncReady, setCloudSyncReady] = useState(false);
  const [cloudSyncState, setCloudSyncState] = useState('local');
  const [cloudSyncMessage, setCloudSyncMessage] = useState('');
  const [pendingLocalTrades, setPendingLocalTrades] = useState([]);
  const [cloudImportBusy, setCloudImportBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return undefined;
    }

    let isMounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) setAuthError(error.message || 'Could not restore your sign-in session.');
      setSession(data?.session || null);
      setAuthLoading(false);
    }).catch(() => {
      if (isMounted) {
        setAuthError('Could not connect to Supabase. Check your project URL and public key.');
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setSession(session);
      setAuthLoading(false);
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('recovery');
        setAuthNotice('Choose a new password for your account.');
        setAuthError('');
        setIsAuthModalOpen(true);
      } else if (session) {
        setIsAuthModalOpen(false);
        setAuthPassword('');
        setAuthError('');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- Profile State Management ---
  const [profiles, setProfiles] = useState(() => {
    const saved = localStorage.getItem('tradelog_profiles');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILES;
  });

  const [activeProfileId, setActiveProfileId] = useState(() => {
    const saved = localStorage.getItem('tradelog_active_profile');
    return saved || 'default';
  });
  const [journalTimezone, setJournalTimezone] = useState(() => {
    const profileId = localStorage.getItem('tradelog_active_profile') || 'default';
    const saved = localStorage.getItem(`zerotilt_journal_timezone_guest_${profileId}`);
    return isValidTimeZone(saved) ? saved : getDeviceTimeZone();
  });
  const [journalClockNow, setJournalClockNow] = useState(() => new Date());
  const [timezoneSyncMessage, setTimezoneSyncMessage] = useState('');

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  // --- Trade Data per Profile ---
  const [trades, setTrades] = useState([]);
  const [tradesProfileId, setTradesProfileId] = useState('');
  const [tradesStorageScope, setTradesStorageScope] = useState('');
  const [topDownState, setTopDownState] = useState(() => {
    const profileId = localStorage.getItem('tradelog_active_profile') || 'default';
    return { profileId, data: {} };
  });
  const [topDownStorageError, setTopDownStorageError] = useState('');
  const [topDownSelectedDate, setTopDownSelectedDate] = useState(getLocalDateString);
  const [isTopDownCardModalOpen, setIsTopDownCardModalOpen] = useState(false);
  const [topDownCardForm, setTopDownCardForm] = useState({
    id: null,
    date: getLocalDateString(),
    title: '',
    timeframe: '',
    imageData: '',
    imageName: '',
    tradingViewUrl: '',
    referenceUrl: '',
    description: '',
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('tradelog_theme') === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = savedTheme;
    return savedTheme;
  });
  const [customAssets, setCustomAssets] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('zerotilt_custom_assets_v1') || '[]');
      if (!Array.isArray(saved)) return [];
      const presetSymbols = new Set(INSTRUMENT_PRESETS.flatMap((group) => group.assets).map((symbol) => normalizeAssetSymbol(symbol)));
      return [...new Set(saved.map(normalizeAssetSymbol).filter((symbol) => isValidAssetSymbol(symbol) && !presetSymbols.has(symbol)))];
    } catch { return []; }
  });
  const [customAssetDraft, setCustomAssetDraft] = useState('');
  const [customAssetError, setCustomAssetError] = useState('');
  const [tradeDefaults, setTradeDefaults] = useState(() => {
    try { return { ...DEFAULT_TRADE_DEFAULTS, ...JSON.parse(localStorage.getItem('zerotilt_trade_defaults_v1') || '{}') }; } catch { return DEFAULT_TRADE_DEFAULTS; }
  });
  const [greeting, setGreeting] = useState(() => getLocalGreeting(journalTimezone));
  const [equityChartType, setEquityChartType] = useState('line');
  const [bottomBuddyPopup, setBottomBuddyPopup] = useState('');
  const [pipSqueakEnabled, setPipSqueakEnabled] = useState(() => {
    try { return localStorage.getItem('zerotilt_pip_squeak_enabled_v1') !== 'false'; } catch { return true; }
  });
  const [deferredPwaInstall, setDeferredPwaInstall] = useState(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(() => (
    typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  ));
  const [mindsetPrankStep, setMindsetPrankStep] = useState(-1);
  const bottomBuddyTimer = useRef(null);
  useEffect(() => {
    try { localStorage.setItem('zerotilt_pip_squeak_enabled_v1', String(pipSqueakEnabled)); } catch { /* Preference still applies for this visit. */ }
    if (!pipSqueakEnabled) {
      window.clearTimeout(bottomBuddyTimer.current);
      setBottomBuddyPopup('');
      setMindsetPrankStep(-1);
    }
  }, [pipSqueakEnabled]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [hasRestoredTradeDraft, setHasRestoredTradeDraft] = useState(false);
  const [tradeFormTouched, setTradeFormTouched] = useState(false);
  const [reviewReminderDismissed, setReviewReminderDismissed] = useState(false);
  const searchInputRef = useRef(null);
  const tradePrefsProfileRef = useRef(activeProfileId);
  const [tradeEntryMode, setTradeEntryMode] = useState('standard');
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedTradeDetails, setSelectedTradeDetails] = useState(null);
  const [selectedDayTrades, setSelectedDayTrades] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 9, 1));
  const [dashboardSelectedDate, setDashboardSelectedDate] = useState('');
  const [dashboardTradePage, setDashboardTradePage] = useState(1);
  const [selectedDayTradePage, setSelectedDayTradePage] = useState(1);
  const [reviewedNoSetupDisplay, setReviewedNoSetupDisplay] = useState({ profileId: '', date: '', reviewed: false });
  const [searchTerm, setSearchTerm] = useState(() => {
    try { return localStorage.getItem(`tradelog_search_${activeProfileId}`) || ''; } catch { return ''; }
  });
  const [tradeFilters, setTradeFilters] = useState(() => {
    try { return { ...DEFAULT_TRADE_FILTERS, ...JSON.parse(localStorage.getItem(`tradelog_filters_${activeProfileId}`) || '{}') }; } catch { return DEFAULT_TRADE_FILTERS; }
  });
  const [tradePage, setTradePage] = useState(1);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const handleAddCustomAsset = (event) => {
    event.preventDefault();
    const symbol = normalizeAssetSymbol(customAssetDraft);
    if (!symbol) { setCustomAssetError('Enter an asset symbol first.'); return; }
    if (!isValidAssetSymbol(symbol)) { setCustomAssetError('Use up to 20 letters, numbers, spaces, dots, slashes, or hyphens.'); return; }
    const existingSymbols = new Set([...INSTRUMENT_PRESETS.flatMap((group) => group.assets), ...customAssets].map(normalizeAssetSymbol));
    if (existingSymbols.has(symbol)) { setCustomAssetError(`${symbol} is already in your asset list.`); return; }
    setCustomAssets((current) => [...current, symbol]);
    setCustomAssetDraft('');
    setCustomAssetError('');
  };

  const handleRemoveCustomAsset = (symbolToRemove) => {
    setCustomAssets((current) => current.filter((symbol) => symbol !== symbolToRemove));
    setTradeDefaults((current) => current.instrument === symbolToRemove ? { ...current, instrument: DEFAULT_TRADE_DEFAULTS.instrument } : current);
  };

  const showBottomBuddyPopup = (trigger) => {
    if (!pipSqueakEnabled || Math.random() >= 0.58) return;
    window.clearTimeout(bottomBuddyTimer.current);
    setMindsetPrankStep(-1);
    setBottomBuddyPopup(chooseBottomBuddyMessage(trigger));
    bottomBuddyTimer.current = window.setTimeout(() => setBottomBuddyPopup(''), 5600);
  };

  const showCalendarMindsetPrank = () => {
    if (!pipSqueakEnabled) return;
    window.clearTimeout(bottomBuddyTimer.current);
    setMindsetPrankStep(0);
    setBottomBuddyPopup('Bro, click on Mindset.');
  };

  const advanceCalendarMindsetPrank = () => {
    const nextStep = mindsetPrankStep + 1;
    setMindsetPrankStep(nextStep);
    if (nextStep === 1) setBottomBuddyPopup('Empty. Just like your brain.');
    if (nextStep === 2) setBottomBuddyPopup('I told you it’s empty like your brain. You proved it.');
    if (nextStep >= 3) {
      setBottomBuddyPopup('Thanks from the dev. I love you ❤️');
      bottomBuddyTimer.current = window.setTimeout(() => {
        setBottomBuddyPopup('');
        setMindsetPrankStep(-1);
      }, 5600);
    }
  };

  useEffect(() => {
    if (!pipSqueakEnabled) return undefined;
    setBottomBuddyPopup('');
    setMindsetPrankStep(-1);
    window.clearTimeout(bottomBuddyTimer.current);
    let bottomCueUsed = false;
    let calendarPrankAlreadyUsed = false;
    try {
      calendarPrankAlreadyUsed = localStorage.getItem('zerotilt_calendar_mindset_prank_seen_v1') === 'true';
    } catch {
      // The prank still works for this visit if browser storage is unavailable.
    }
    const maybeShowBottomBuddy = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
      if (!bottomCueUsed && nearBottom) {
        if (activeTab !== 'dashboard' && activeTab !== 'calendar') return;
        bottomCueUsed = true;
        if (activeTab === 'calendar' && !calendarPrankAlreadyUsed && Math.random() < 0.06) {
          calendarPrankAlreadyUsed = true;
          try {
            localStorage.setItem('zerotilt_calendar_mindset_prank_seen_v1', 'true');
          } catch {
            // Keep the current interaction usable even when storage is unavailable.
          }
          showCalendarMindsetPrank();
        } else {
          showBottomBuddyPopup('scroll');
        }
      }
    };

    window.addEventListener('scroll', maybeShowBottomBuddy, { passive: true });
    return () => {
      window.removeEventListener('scroll', maybeShowBottomBuddy);
      window.clearTimeout(bottomBuddyTimer.current);
    };
  }, [activeTab, pipSqueakEnabled]);

  useEffect(() => {
    setSelectedDayTradePage(1);
  }, [selectedDayTrades?.dateStr]);

  useEffect(() => {
    const updateJournalClock = () => {
      const now = new Date();
      setJournalClockNow(now);
      setGreeting(getLocalGreeting(journalTimezone));
    };
    updateJournalClock();
    const greetingTimer = setInterval(updateJournalClock, 30_000);
    return () => clearInterval(greetingTimer);
  }, [journalTimezone]);

  useEffect(() => {
    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPwaInstall(event);
    };
    const handleInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredPwaInstall(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('tradelog_theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Sync Profiles & Active Profile to localStorage
  useEffect(() => {
    localStorage.setItem('tradelog_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    const userId = session?.user?.id;
    const storageKey = userId
      ? `zerotilt_journal_timezone_user_${userId}`
      : `zerotilt_journal_timezone_guest_${activeProfileId}`;
    try {
      if (userId) {
        const accountTimezone = session.user.user_metadata?.journal_timezone;
        if (isValidTimeZone(accountTimezone)) {
          setJournalTimezone(accountTimezone);
          localStorage.setItem(storageKey, accountTimezone);
          setTimezoneSyncMessage('Synced with your account.');
          return;
        }
        const localTimezone = localStorage.getItem(storageKey);
        const initialTimezone = isValidTimeZone(localTimezone) ? localTimezone : journalTimezone;
        setJournalTimezone(initialTimezone);
        supabase.auth.updateUser({ data: { journal_timezone: initialTimezone } }).then(({ error }) => {
          setTimezoneSyncMessage(error ? 'Saved on this device; account sync needs attention.' : 'Synced with your account.');
        }).catch(() => setTimezoneSyncMessage('Saved on this device; account sync needs attention.'));
        return;
      }
      const localTimezone = localStorage.getItem(storageKey);
      if (isValidTimeZone(localTimezone)) setJournalTimezone(localTimezone);
      setTimezoneSyncMessage('Saved on this device.');
    } catch {
      setTimezoneSyncMessage('Saved for this session.');
    }
  }, [session?.user?.id, activeProfileId]);

  useEffect(() => {
    const storageKey = session?.user?.id
      ? `zerotilt_journal_timezone_user_${session.user.id}`
      : `zerotilt_journal_timezone_guest_${activeProfileId}`;
    try { localStorage.setItem(storageKey, journalTimezone); } catch { /* Timezone remains active for this visit. */ }
  }, [journalTimezone, activeProfileId, session?.user?.id]);

  useEffect(() => {
    try { localStorage.setItem('zerotilt_custom_assets_v1', JSON.stringify(customAssets)); } catch { /* Keep symbols for this session if storage is unavailable. */ }
  }, [customAssets]);

  useEffect(() => {
    try { localStorage.setItem('zerotilt_trade_defaults_v1', JSON.stringify(tradeDefaults)); } catch { /* Defaults remain active for this session if storage is unavailable. */ }
  }, [tradeDefaults]);

  useEffect(() => {
    localStorage.setItem('tradelog_active_profile', activeProfileId);
    setTradesProfileId('');
    setTradesStorageScope('');
    setTrades([]);
    setPendingLocalTrades([]);
    if (session?.user?.id) return;

    setCloudSyncReady(false);
    setCloudSyncState('local');
    setCloudSyncMessage('');
    try {
      const savedGuestTrades = JSON.parse(localStorage.getItem(`zerotilt_guest_trades_${activeProfileId}`) || '[]');
      setTrades(Array.isArray(savedGuestTrades) ? savedGuestTrades.filter((trade) => !isDemoTrade(trade)) : []);
    } catch {
      setTrades([]);
    }
    setTradesProfileId(activeProfileId);
    setTradesStorageScope(`guest:${activeProfileId}`);
  }, [activeProfileId, session?.user?.id]);

  // Keep trade search and filters with the selected journal profile.
  useEffect(() => {
    if (tradePrefsProfileRef.current !== activeProfileId) {
      tradePrefsProfileRef.current = activeProfileId;
      try {
        setTradeFilters({ ...DEFAULT_TRADE_FILTERS, ...JSON.parse(localStorage.getItem(`tradelog_filters_${activeProfileId}`) || '{}') });
        setSearchTerm(localStorage.getItem(`tradelog_search_${activeProfileId}`) || '');
      } catch {
        setTradeFilters(DEFAULT_TRADE_FILTERS);
        setSearchTerm('');
      }
      setTradePage(1);
      return;
    }
    try {
      localStorage.setItem(`tradelog_filters_${activeProfileId}`, JSON.stringify(tradeFilters));
      localStorage.setItem(`tradelog_search_${activeProfileId}`, searchTerm);
    } catch { /* Search still works when browser storage is unavailable. */ }
  }, [tradeFilters, searchTerm, activeProfileId]);

  // Keep browser recovery data separate for each guest journal and signed-in account.
  useEffect(() => {
    const expectedScope = session?.user?.id ? `user:${session.user.id}:${activeProfileId}` : `guest:${activeProfileId}`;
    if (tradesProfileId !== activeProfileId || tradesStorageScope !== expectedScope) return;
    const storageKey = session?.user?.id
      ? `tradelog_account_trades_${session.user.id}_${activeProfileId}`
      : `zerotilt_guest_trades_${activeProfileId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(trades));
    } catch (error) {
      setCloudSyncMessage(error?.name === 'QuotaExceededError'
        ? 'This browser is low on storage. Remove old screenshots or export your journal data.'
        : 'Could not save a local backup in this browser.');
    }
  }, [trades, activeProfileId, tradesProfileId, tradesStorageScope, session?.user?.id]);

  // Load and merge this profile's rows through the signed-in user's RLS policies.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setCloudSyncReady(false);
      setCloudSyncState('local');
      setCloudSyncMessage('');
      setPendingLocalTrades([]);
      return undefined;
    }

    let cancelled = false;
    const loadCloudTrades = async () => {
      setCloudSyncReady(false);
      setCloudSyncState('loading');
      setCloudSyncMessage('Loading cloud trades…');
      setPendingLocalTrades([]);
      let localTradesForFallback = [];
      try {
        const accountCacheKey = `tradelog_account_trades_${userId}_${activeProfileId}`;
        const localBackupKey = `tradelog_trades_local_backup_${userId}_${activeProfileId}`;
        const guestTradesKey = `zerotilt_guest_trades_${activeProfileId}`;
        const guestOwnerKey = `zerotilt_guest_owner_${activeProfileId}`;
        const accountCache = JSON.parse(localStorage.getItem(accountCacheKey) || '[]');
        const storedBackupTrades = JSON.parse(localStorage.getItem(localBackupKey) || '[]');
        const storedGuestTrades = JSON.parse(localStorage.getItem(guestTradesKey) || '[]');
        const accountCacheArray = Array.isArray(accountCache) ? accountCache : [];
        const backupArray = Array.isArray(storedBackupTrades) ? storedBackupTrades : [];
        const guestArray = Array.isArray(storedGuestTrades) ? storedGuestTrades : [];
        const guestOwnerId = localStorage.getItem(guestOwnerKey);
        const canUseGuestTrades = !guestOwnerId || guestOwnerId === userId;
        if (!guestOwnerId && guestArray.length) localStorage.setItem(guestOwnerKey, userId);
        const currentLocalTrades = accountCacheArray.filter((trade) => !isDemoTrade(trade));
        const backupLocalTrades = backupArray.filter((trade) => !isDemoTrade(trade));
        const availableGuestTrades = canUseGuestTrades ? guestArray.filter((trade) => !isDemoTrade(trade)) : [];
        if (currentLocalTrades.length !== accountCacheArray.length) localStorage.setItem(accountCacheKey, JSON.stringify(currentLocalTrades));
        if (backupLocalTrades.length !== backupArray.length) localStorage.setItem(localBackupKey, JSON.stringify(backupLocalTrades));
        if (canUseGuestTrades && availableGuestTrades.length !== guestArray.length) localStorage.setItem(guestTradesKey, JSON.stringify(availableGuestTrades));
        const localById = new Map();
        [...currentLocalTrades, ...backupLocalTrades, ...availableGuestTrades]
          .forEach((trade) => localById.set(String(trade._localTradeId || trade.id), trade));
        const localTrades = [...localById.values()];
        localTradesForFallback = localTrades;

        const { data, error } = await supabase
          .from('trades')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (cancelled) return;

        const demoRows = (data || []).filter((row) => isDemoTrade(databaseRowToJournalTrade(row, journalTimezone)));
        if (demoRows.length) {
          const { error: deleteDemoError } = await supabase
            .from('trades')
            .delete()
            .eq('user_id', userId)
            .in('id', demoRows.map((row) => row.id));
          if (deleteDemoError) throw deleteDemoError;
        }
        const allUserTrades = (data || []).filter((row) => !demoRows.some((demoRow) => demoRow.id === row.id)).map((row) => databaseRowToJournalTrade(row, journalTimezone));
        const matchingProfileTrades = allUserTrades.filter((trade) => trade._profileId === activeProfileId);
        // The Main Account is the default view on a fresh browser profile. If its local
        // profile list has not been created there yet, show this signed-in user's cloud
        // trades even when their saved metadata references a profile created elsewhere.
        const isFreshMainAccountView = activeProfileId === 'default' && profiles.length === 1;
        const cloudTrades = matchingProfileTrades.length || !isFreshMainAccountView
          ? matchingProfileTrades
          : allUserTrades;
        const cloudLocalIds = new Set(cloudTrades.map((trade) => String(trade._localTradeId || trade.id)));
        const localOnlyTrades = localTrades.filter((trade) => !cloudLocalIds.has(String(trade._localTradeId || trade.id)));
        if (cancelled) return;
        if (cloudTrades.length) {
          if (localOnlyTrades.length) localStorage.setItem(localBackupKey, JSON.stringify(localOnlyTrades));
          setTrades(cloudTrades);
        } else {
          setTrades(localTrades);
        }
        setPendingLocalTrades(localOnlyTrades);
        setTradesProfileId(activeProfileId);
        setTradesStorageScope(`user:${userId}:${activeProfileId}`);
        setCloudSyncReady(true);
        setCloudSyncState('ready');
        setCloudSyncMessage(cloudTrades.length
          ? `${cloudTrades.length} cloud trade${cloudTrades.length === 1 ? '' : 's'} loaded for ${currentProfileObj.name}.${localOnlyTrades.length ? ` ${localOnlyTrades.length} browser-only trades are ready to import.` : ''}`
          : `No cloud trades found for ${currentProfileObj.name}.${localOnlyTrades.length ? ` ${localOnlyTrades.length} browser-only trades are ready to import.` : ''}`);
      } catch (error) {
        if (cancelled) return;
        setTrades(localTradesForFallback);
        setTradesProfileId(activeProfileId);
        setTradesStorageScope(`user:${userId}:${activeProfileId}`);
        setCloudSyncReady(false);
        setCloudSyncState('error');
        setCloudSyncMessage(localTradesForFallback.length
          ? `Showing this account’s saved browser copy because cloud loading failed: ${error?.message || 'Check the trades table and its RLS policies.'}`
          : error?.message || 'Could not load trades from Supabase. Check the trades table and its RLS policies.');
      }
    };

    loadCloudTrades();
    return () => { cancelled = true; };
  }, [session?.user?.id, activeProfileId, profiles.length, journalTimezone]);

  useEffect(() => {
    try {
      if (!session?.user?.id) {
        setTopDownState({ profileId: activeProfileId, data: {} });
        return;
      }
      const userTopDownKey = `tradelog_topdown_${session.user.id}_${activeProfileId}`;
      const savedText = localStorage.getItem(userTopDownKey) || localStorage.getItem(`tradelog_topdown_${activeProfileId}`) || '{}';
      const saved = normalizeTopDownData(JSON.parse(savedText));
      if (!localStorage.getItem(userTopDownKey) && saved.cards?.length) {
        localStorage.setItem(userTopDownKey, JSON.stringify(saved));
        localStorage.removeItem(`tradelog_topdown_${activeProfileId}`);
      }
      setTopDownState({ profileId: activeProfileId, data: saved });
    } catch {
      setTopDownState({ profileId: activeProfileId, data: {} });
    }
  }, [activeProfileId, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || topDownState.profileId !== activeProfileId) return;
    try {
      localStorage.setItem(`tradelog_topdown_${session.user.id}_${activeProfileId}`, JSON.stringify(topDownState.data));
      setTopDownStorageError('');
    } catch {
      setTopDownStorageError('Could not save this screenshot. Try a smaller image or remove an older one.');
    }
  }, [topDownState, activeProfileId, session?.user?.id]);

  // Profile Actions
  const handleCreateProfile = (e) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    const newId = `profile_${Date.now()}`;
    const newProf = { id: newId, name: newProfileName.trim() };
    setProfiles((prev) => [...prev, newProf]);
    switchActiveProfile(newId);
    setNewProfileName('');
    setIsProfileModalOpen(false);
  };

  const handleDeleteProfile = (idToDelete) => {
    if (profiles.length <= 1) {
      alert('You must keep at least one profile.');
      return;
    }
    if (window.confirm('Are you sure? This will delete all trade logs and analysis cards inside this profile.')) {
      setProfiles((prev) => prev.filter((p) => p.id !== idToDelete));
      localStorage.removeItem(`tradelog_trades_${idToDelete}`);
      localStorage.removeItem(`tradelog_topdown_${idToDelete}`);
      if (activeProfileId === idToDelete) {
        const remaining = profiles.filter((p) => p.id !== idToDelete);
        switchActiveProfile(remaining[0].id);
      }
    }
  };

  const currentProfileObj = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const isProfileDataReady = tradesProfileId === activeProfileId;

  // Save unfinished new entries continuously so a refresh does not erase them.
  useEffect(() => {
    if (!isModalOpen || formData.id || !tradeFormTouched || tradesProfileId !== activeProfileId) return;
    try { localStorage.setItem(tradeDraftKey(), JSON.stringify(formData)); } catch { /* The form remains usable if storage is full. */ }
  }, [formData, isModalOpen, activeProfileId, tradesProfileId, tradeFormTouched]);

  useEffect(() => {
    const dismissedForToday = () => {
      try { return localStorage.getItem(`tradelog_review_reminder_${activeProfileId}`) === getZonedDateString(new Date(), journalTimezone); } catch { return false; }
    };
    setReviewReminderDismissed(dismissedForToday());
  }, [activeProfileId, journalTimezone]);

  // Auto-Calculate R-Multiple
  useEffect(() => {
    const entry = parseFloat(formData.entry);
    const sl = parseFloat(formData.stopLoss);
    const exit = parseFloat(formData.exit);

    if (!isNaN(entry) && !isNaN(sl) && !isNaN(exit) && entry !== sl) {
      const riskPerUnit = Math.abs(entry - sl);
      let rValue = 0;
      if (formData.direction === 'Long') {
        rValue = (exit - entry) / riskPerUnit;
      } else {
        rValue = (entry - exit) / riskPerUnit;
      }
      setFormData((prev) => ({ ...prev, resultR: rValue.toFixed(1) }));
    }
  }, [formData.entry, formData.stopLoss, formData.exit, formData.direction]);

  // Core Metrics
  const totalR = trades.reduce((acc, t) => acc + (parseFloat(t.resultR) || 0), 0).toFixed(1);
  const winCount = trades.filter((t) => (parseFloat(t.resultR) || 0) > 0).length;
  const winRate = trades.length > 0 ? Math.round((winCount / trades.length) * 100) : 0;
  const avgR = trades.length > 0 ? (totalR / trades.length).toFixed(1) : '0.0';
  const totalPL = (totalR * 10).toFixed(0);
  const auraCleanTrades = trades.filter((trade) => !(trade.mistakes || []).length).length;
  const auraDisciplineRate = trades.length ? Math.round((auraCleanTrades / trades.length) * 100) : 0;
  const auraProfitRate = winRate;
  const auraPoints = trades.length ? Math.round(((auraDisciplineRate + auraProfitRate) / 2) * 10) : 0;
  const todayKey = getZonedDateString(new Date(), journalTimezone);
  const todayTrades = trades.filter((trade) => trade.date === todayKey);
  const todayNetR = todayTrades.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0);
  const todayHasRevengeTag = todayTrades.some((trade) => (trade.psychology || []).includes('Revenge Trade'));
  const negativeMindsetTags = PSYCHOLOGY_OPTIONS.filter((option) => option.type === 'negative').map((option) => option.label);
  const todayHasRuleBreak = todayTrades.some((trade) => (
    (trade.mistakes || []).length > 0 || (trade.psychology || []).some((tag) => negativeMindsetTags.includes(tag))
  ));
  const todayFollowedRules = todayTrades.length > 0 && todayTrades.every((trade) => (
    (trade.psychology || []).includes('Disciplined') && !(trade.mistakes || []).length
  ));
  const noSetupReviewedToday = todayTrades.length === 0 && (
    reviewedNoSetupDisplay.profileId === activeProfileId && reviewedNoSetupDisplay.date === todayKey
      ? reviewedNoSetupDisplay.reviewed
      : readNoSetupReview(activeProfileId, todayKey)
  );
  const chronologicalTrades = [...trades].sort((a, b) => getTradeInstant(a, journalTimezone) - getTradeInstant(b, journalTimezone));
  const latestJournalDate = chronologicalTrades[chronologicalTrades.length - 1]?.date || '';
  const inactiveForBusinessDays = countBusinessDaysSince(latestJournalDate, todayKey);
  let currentLosingStreak = 0;
  for (let index = chronologicalTrades.length - 1; index >= 0; index -= 1) {
    if ((parseFloat(chronologicalTrades[index].resultR) || 0) < 0) currentLosingStreak += 1;
    else break;
  }
  let runningEquityR = 0;
  let previousEquityPeakR = 0;
  let setNewEquityHighToday = false;
  const monthlyNetResults = {};
  trades.forEach((trade) => {
    const monthKey = (trade.date || '').slice(0, 7);
    if (monthKey) monthlyNetResults[monthKey] = (monthlyNetResults[monthKey] || 0) + (parseFloat(trade.resultR) || 0);
  });
  chronologicalTrades.forEach((trade) => {
    runningEquityR += parseFloat(trade.resultR) || 0;
    if (trade.date === todayKey && runningEquityR > previousEquityPeakR) setNewEquityHighToday = true;
    previousEquityPeakR = Math.max(previousEquityPeakR, runningEquityR);
  });
  const currentMonthKey = todayKey.slice(0, 7);
  const currentMonthNetR = monthlyNetResults[currentMonthKey] || 0;
  const bestPreviousMonthR = Math.max(0, ...Object.entries(monthlyNetResults).filter(([monthKey]) => monthKey !== currentMonthKey).map(([, netR]) => netR));
  const setBestMonthToday = todayTrades.length > 0 && currentMonthNetR > bestPreviousMonthR;
  const tradesNeedingReview = [...trades]
    .filter((trade) => !String(trade.notes || '').trim() || !(trade.screenshotUrl || trade.tradingViewUrl || trade.plannedScreenshotUrl || trade.plannedTradingViewUrl))
    .sort((a, b) => getTradeInstant(b, journalTimezone) - getTradeInstant(a, journalTimezone))
    .slice(0, 3);
  const dismissReviewReminder = () => {
    setReviewReminderDismissed(true);
    try { localStorage.setItem(`tradelog_review_reminder_${activeProfileId}`, getZonedDateString(new Date(), journalTimezone)); } catch { /* Dismiss for this view. */ }
  };
  const missingTodayEvidence = todayTrades.length > 0 && todayTrades.every((trade) => (
    !String(trade.notes || '').trim() && !trade.screenshotUrl && !trade.tradingViewUrl && !trade.plannedScreenshotUrl && !trade.plannedTradingViewUrl
  ));
  const limitedJournalData = trades.length > 0 && trades.length < 5;
  const personalityCategory = todayTrades.length === 0
    ? noSetupReviewedToday ? 'noTradeReviewed'
      : latestJournalDate && inactiveForBusinessDays >= 4 ? 'inactiveJournal'
        : limitedJournalData ? 'limitedData' : 'noTrades'
    : todayHasRevengeTag ? 'revengeTrade'
      : missingTodayEvidence ? 'missingEvidence'
        : todayNetR < 0 && currentLosingStreak >= 3 ? 'longLosingStreak'
          : todayNetR > 0 && setNewEquityHighToday ? 'newEquityHigh'
            : todayNetR > 0 && setBestMonthToday ? 'bestMonth'
      : todayNetR > 0
        ? todayFollowedRules ? 'greenDisciplined' : todayHasRuleBreak ? 'greenWithMistakes' : 'green'
        : todayNetR < 0
          ? todayFollowedRules ? 'redDisciplined' : todayHasRuleBreak ? 'redWithMistakes' : 'red'
          : 'flat';
  const personalityContextKey = `${activeProfileId}:${todayKey}:${todayTrades.map((trade) => `${trade.id}:${trade.resultR}:${(trade.mistakes || []).join(',')}:${(trade.psychology || []).join(',')}`).join('|')}:${noSetupReviewedToday}`;

  // Advanced Analytics
  const winningTrades = trades.filter((t) => (parseFloat(t.resultR) || 0) > 0);
  const losingTrades = trades.filter((t) => (parseFloat(t.resultR) || 0) < 0);

  const bestTradeR = trades.length > 0 ? Math.max(...trades.map((t) => parseFloat(t.resultR) || 0)).toFixed(1) : '0.0';
  const worstTradeR = trades.length > 0 ? Math.min(...trades.map((t) => parseFloat(t.resultR) || 0)).toFixed(1) : '0.0';

  const avgWinR = winningTrades.length > 0
    ? (winningTrades.reduce((acc, t) => acc + parseFloat(t.resultR), 0) / winningTrades.length).toFixed(1)
    : '0.0';

  const avgLossR = losingTrades.length > 0
    ? (losingTrades.reduce((acc, t) => acc + parseFloat(t.resultR), 0) / losingTrades.length).toFixed(1)
    : '0.0';

  const grossWinsR = winningTrades.reduce((acc, t) => acc + parseFloat(t.resultR), 0);
  const grossLossesR = Math.abs(losingTrades.reduce((acc, t) => acc + parseFloat(t.resultR), 0));
  const profitFactor = grossLossesR > 0 ? (grossWinsR / grossLossesR).toFixed(2) : (grossWinsR > 0 ? '∞' : '0.00');
  const profitFactorNumber = profitFactor === '∞' ? Infinity : parseFloat(profitFactor) || 0;
  const profitFactorProgress = Number.isFinite(profitFactorNumber)
    ? profitFactorNumber / (profitFactorNumber + 1)
    : 1;

  const winRateDec = trades.length > 0 ? winningTrades.length / trades.length : 0;
  const lossRateDec = trades.length > 0 ? losingTrades.length / trades.length : 0;
  const expectancyR = ((winRateDec * parseFloat(avgWinR)) - (lossRateDec * Math.abs(parseFloat(avgLossR)))).toFixed(2);

  const sortedTradesForEquity = [...trades].sort((a, b) => getTradeInstant(a, journalTimezone) - getTradeInstant(b, journalTimezone));
  let maxConsecutiveWins = 0;
  let currentConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentConsecutiveLosses = 0;

  sortedTradesForEquity.forEach((t) => {
    const r = parseFloat(t.resultR) || 0;
    if (r > 0) {
      currentConsecutiveWins++;
      currentConsecutiveLosses = 0;
      if (currentConsecutiveWins > maxConsecutiveWins) maxConsecutiveWins = currentConsecutiveWins;
    } else if (r < 0) {
      currentConsecutiveLosses++;
      currentConsecutiveWins = 0;
      if (currentConsecutiveLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentConsecutiveLosses;
    } else {
      currentConsecutiveWins = 0;
      currentConsecutiveLosses = 0;
    }
  });

  const longTrades = trades.filter((t) => t.direction === 'Long');
  const shortTrades = trades.filter((t) => t.direction === 'Short');

  const longWins = longTrades.filter((t) => (parseFloat(t.resultR) || 0) > 0).length;
  const shortWins = shortTrades.filter((t) => (parseFloat(t.resultR) || 0) > 0).length;

  const longWinRate = longTrades.length > 0 ? Math.round((longWins / longTrades.length) * 100) : 0;
  const shortWinRate = shortTrades.length > 0 ? Math.round((shortWins / shortTrades.length) * 100) : 0;

  const longPct = trades.length > 0 ? Math.round((longTrades.length / trades.length) * 100) : 0;
  const shortPct = trades.length > 0 ? 100 - longPct : 0;

  let cumulativeR = 0;
  const equityCurvePoints = sortedTradesForEquity.map((t) => {
    cumulativeR += parseFloat(t.resultR) || 0;
    return { date: t.date, totalR: cumulativeR };
  });
  const dailyRPoints = Object.values(sortedTradesForEquity.reduce((days, trade) => {
    const resultR = parseFloat(trade.resultR) || 0;
    days[trade.date] = days[trade.date] || { date: trade.date, totalR: 0 };
    days[trade.date].totalR += resultR;
    return days;
  }, {}));

  // Monte Carlo Engine State
  const [mcSource, setMcSource] = useState('journal');
  const [mcCustomProfile, setMcCustomProfile] = useState({
    winRate: 50,
    avgWinR: 2.0,
    avgLossR: 1.0,
    tradesPerDay: 2,
  });

  const [mcParams, setMcParams] = useState({
    accountCost: 500,
    accountSize: 100000,
    riskPerTradePct: 1.0,
    executionCostsEnabled: false,
    slippageCostPerTrade: 0,
    commissionCostPerTrade: 0,
    spreadCostPerTrade: 0,
    drawdownType: 'static',
    totalMaxDDPct: 10,
    dailyMaxDDPct: 5,
    passStructure: 'two_step',
    p1TargetPct: 8,
    p2TargetPct: 5,
    p3TargetPct: 5,
    minTradingDays: 5,
    evalConsistencyEnabled: false,
    evalConsistencyPct: 33,
    fundedTargetPct: 0,
    payoutSplitPct: 80,
    minDaysToPayout: 14,
    fundedConsistencyEnabled: false,
    fundedConsistencyPct: 40,
    numSimulations: 500,
  });

  const [mcResults, setMcResults] = useState(null);

  useEffect(() => {
    setMcResults(null);
  }, [trades, activeProfileId]);

  const switchActiveProfile = (profileId) => {
    setMcResults(null);
    setTradesProfileId(null);
    setTradeFilters({ instrument: 'all', psychology: 'all', direction: 'all', mistake: 'all', timeOfDay: 'all', period: 'all' });
    setDashboardSelectedDate('');
    setActiveProfileId(profileId);
  };

  const runAdvancedMonteCarlo = () => {
    if (mcSource === 'journal' && (tradesProfileId !== activeProfileId || trades.length === 0)) {
      setMcResults(null);
      return;
    }

    const simWinRate = mcSource === 'journal' ? winRate : mcCustomProfile.winRate;
    const simAvgWin = mcSource === 'journal' ? parseFloat(avgWinR) || 0 : mcCustomProfile.avgWinR;
    const simAvgLoss = mcSource === 'journal' ? Math.abs(parseFloat(avgLossR) || 0) : mcCustomProfile.avgLossR;
    const tradesPerDay = mcSource === 'journal' ? 2 : mcCustomProfile.tradesPerDay;

    const winRateDec = simWinRate / 100;
    const initialBalance = mcParams.accountSize;
    const totalMaxDDAmt = initialBalance * (mcParams.totalMaxDDPct / 100);
    const dailyMaxDDAmt = initialBalance * (mcParams.dailyMaxDDPct / 100);

    const p1TargetAmt = initialBalance * (mcParams.p1TargetPct / 100);
    const p2TargetAmt = initialBalance * (mcParams.p2TargetPct / 100);
    const p3TargetAmt = initialBalance * (mcParams.p3TargetPct / 100);
    const executionCostPerTrade = mcParams.executionCostsEnabled
      ? mcParams.slippageCostPerTrade + mcParams.commissionCostPerTrade + mcParams.spreadCostPerTrade
      : 0;
    const fundedTargetAmt = initialBalance * (mcParams.fundedTargetPct / 100);

    let passedCount = 0;
    let blownCount = 0;
    const daysToPassList = [];
    const daysToFirstPayoutList = [];
    const simulatedPaths = [];

    const timeframes = [
      { days: 30, label: '30 Days' },
      { days: 60, label: '60 Days' },
      { days: 90, label: '90 Days' },
      { days: 180, label: '6 Months' },
      { days: 365, label: '1 Year' },
      { days: 730, label: '2 Years' },
      { days: 3650, label: '10 Years' },
    ];

    const profitsByTimeframe = Object.fromEntries(timeframes.map(({ days }) => [days, []]));
    const payoutsByTimeframe = Object.fromEntries(timeframes.map(({ days }) => [days, []]));

    for (let sim = 0; sim < mcParams.numSimulations; sim++) {
      let stage = mcParams.passStructure === 'instant' ? 'funded' : 'p1';
      let currentBalance = initialBalance;
      let peakEquity = initialBalance;
      let dayCount = 0;
      let stageProfit = 0;
      let p1PassedDay = 0;
      let p2PassedDay = 0;
      let passDay = 0;
      let firstPayoutDay = 0;
      let totalPayoutsReceived = 0;

      const recordTimeframe = (day) => {
        timeframes.forEach((timeframe) => {
          if (day === timeframe.days) {
            profitsByTimeframe[timeframe.days].push(totalPayoutsReceived - mcParams.accountCost);
            payoutsByTimeframe[timeframe.days].push(totalPayoutsReceived);
          }
        });
      };

      let dailyProfits = [];
      let isBlown = false;

      const maxDays = 3650;
      const path = [{ day: 0, balance: initialBalance, stage }];

      for (let day = 1; day <= maxDays; day++) {
        if (isBlown) {
          path.push({ day, balance: currentBalance, stage: 'blown' });
          recordTimeframe(day);
          continue;
        }

        dayCount = day;
        let dayProfit = 0;

        for (let t = 0; t < tradesPerDay; t++) {
          const riskAmt = currentBalance * (mcParams.riskPerTradePct / 100);
          const isWin = Math.random() < winRateDec;

          let tradePL = 0;
          if (isWin) {
            tradePL = riskAmt * simAvgWin - executionCostPerTrade;
          } else {
            tradePL = -riskAmt * simAvgLoss - executionCostPerTrade;
          }

          currentBalance += tradePL;
          dayProfit += tradePL;
          stageProfit += tradePL;

          if (dayProfit < 0 && Math.abs(dayProfit) >= dailyMaxDDAmt) {
            isBlown = true;
            break;
          }

          const staticDrawdownAmt = initialBalance - currentBalance;
          if (mcParams.drawdownType === 'static' && staticDrawdownAmt >= totalMaxDDAmt) {
            isBlown = true;
            break;
          }
        }

        if (!isBlown && mcParams.drawdownType === 'trailing') {
          peakEquity = Math.max(peakEquity, currentBalance);
          if (peakEquity - currentBalance >= totalMaxDDAmt) isBlown = true;
        }

        dailyProfits.push(dayProfit);

        if (isBlown) {
          blownCount++;
          path.push({ day, balance: currentBalance, stage: 'blown' });
          recordTimeframe(day);
          continue;
        }

        if (stage === 'p1') {
          const maxSingleDay = Math.max(...dailyProfits, 0);
          const consistencyPassed = !mcParams.evalConsistencyEnabled ||
            (stageProfit > 0 && maxSingleDay / stageProfit <= mcParams.evalConsistencyPct / 100);

          if (stageProfit >= p1TargetAmt && dayCount >= mcParams.minTradingDays && consistencyPassed) {
            p1PassedDay = dayCount;
            if (mcParams.passStructure === 'two_step' || mcParams.passStructure === 'three_step') {
              stage = 'p2';
              stageProfit = 0;
              dailyProfits = [];
              currentBalance = initialBalance;
              peakEquity = initialBalance;
            } else {
              stage = 'funded';
              stageProfit = 0;
              dailyProfits = [];
              currentBalance = initialBalance;
              peakEquity = initialBalance;
              passDay = dayCount;
              passedCount++;
            }
          }
        } else if (stage === 'p2') {
          const maxSingleDay = Math.max(...dailyProfits, 0);
          const consistencyPassed = !mcParams.evalConsistencyEnabled ||
            (stageProfit > 0 && maxSingleDay / stageProfit <= mcParams.evalConsistencyPct / 100);

          if (stageProfit >= p2TargetAmt && (dayCount - p1PassedDay) >= mcParams.minTradingDays && consistencyPassed) {
            if (mcParams.passStructure === 'three_step') {
              stage = 'p3';
              p2PassedDay = dayCount;
              stageProfit = 0;
              dailyProfits = [];
              currentBalance = initialBalance;
              peakEquity = initialBalance;
            } else {
              stage = 'funded';
              stageProfit = 0;
              dailyProfits = [];
              currentBalance = initialBalance;
              peakEquity = initialBalance;
              passDay = dayCount;
              passedCount++;
            }
          }
        } else if (stage === 'p3') {
          const maxSingleDay = Math.max(...dailyProfits, 0);
          const consistencyPassed = !mcParams.evalConsistencyEnabled ||
            (stageProfit > 0 && maxSingleDay / stageProfit <= mcParams.evalConsistencyPct / 100);

          if (stageProfit >= p3TargetAmt && (dayCount - p2PassedDay) >= mcParams.minTradingDays && consistencyPassed) {
            stage = 'funded';
            stageProfit = 0;
            dailyProfits = [];
            currentBalance = initialBalance;
            peakEquity = initialBalance;
            passDay = dayCount;
            passedCount++;
          }
        } else if (stage === 'funded') {
          const daysInFunded = dayCount - passDay;

          if (daysInFunded >= mcParams.minDaysToPayout && daysInFunded % mcParams.minDaysToPayout === 0) {
            const fundedProfit = currentBalance - initialBalance;
            const maxSingleDay = Math.max(...dailyProfits, 0);

            const fundedConsistencyPassed = !mcParams.fundedConsistencyEnabled ||
              (fundedProfit > 0 && maxSingleDay / fundedProfit <= mcParams.fundedConsistencyPct / 100);

            const targetMet = mcParams.fundedTargetPct === 0 || fundedProfit >= fundedTargetAmt;

            if (fundedProfit > 0 && fundedConsistencyPassed && targetMet) {
              const payoutAmt = fundedProfit * (mcParams.payoutSplitPct / 100);
              totalPayoutsReceived += payoutAmt;
              if (firstPayoutDay === 0) firstPayoutDay = dayCount;

              currentBalance = initialBalance;
              peakEquity = initialBalance;
              stageProfit = 0;
              dailyProfits = [];
            }
          }
        }

        path.push({ day, balance: currentBalance, stage });

        recordTimeframe(day);
      }

      if (passDay > 0) daysToPassList.push(passDay);
      if (firstPayoutDay > 0) daysToFirstPayoutList.push(firstPayoutDay);

      if (sim < 30) {
        simulatedPaths.push(path);
      }
    }

    const passRate = ((passedCount / mcParams.numSimulations) * 100).toFixed(1);
    const avgDaysToPass = daysToPassList.length > 0
      ? (daysToPassList.reduce((a, b) => a + b, 0) / daysToPassList.length).toFixed(0)
      : 'N/A';

    const avgDaysToPayout = daysToFirstPayoutList.length > 0
      ? (daysToFirstPayoutList.reduce((a, b) => a + b, 0) / daysToFirstPayoutList.length).toFixed(0)
      : 'N/A';

    const timeframeSummary = timeframes.map((tf) => {
      const profits = profitsByTimeframe[tf.days];
      const payouts = payoutsByTimeframe[tf.days];
      const avgNetProfit = profits.length > 0 ? (profits.reduce((a, b) => a + b, 0) / profits.length).toFixed(0) : 0;
      const avgPayout = payouts.length > 0 ? (payouts.reduce((a, b) => a + b, 0) / payouts.length).toFixed(0) : 0;
      return {
        label: tf.label,
        avgNetProfit: parseFloat(avgNetProfit),
        avgPayout: parseFloat(avgPayout),
      };
    });

    setMcResults({
      passRate,
      blownCount,
      avgDaysToPass,
      avgDaysToPayout,
      timeframeSummary,
      simulatedPaths,
    });
  };

  const topDownProfileData = topDownState.profileId === activeProfileId ? topDownState.data : {};
  const topDownCards = [...(Array.isArray(topDownProfileData.cards) ? topDownProfileData.cards : [])]
    .filter((card) => card.date === topDownSelectedDate)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.id).localeCompare(String(a.id)));
  const openTopDownCardForm = (card = null) => {
    setTopDownCardForm(card ? { ...card } : {
      id: null,
      date: topDownSelectedDate || getLocalDateString(),
      title: '',
      timeframe: '',
      imageData: '',
      imageName: '',
      tradingViewUrl: '',
      referenceUrl: '',
      description: '',
    });
    setIsTopDownCardModalOpen(true);
  };

  const handleTopDownImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imageData = await compressAnalysisImage(file);
      setTopDownCardForm((current) => ({ ...current, imageData, imageName: file.name }));
    } catch (error) {
      setTopDownStorageError(error.message || 'Could not load that image.');
    }
  };

  const saveTopDownCard = (event) => {
    event.preventDefault();
    const savedCard = { ...topDownCardForm, id: topDownCardForm.id || `analysis-${Date.now()}` };
    setTopDownState((current) => {
      const currentData = current.profileId === activeProfileId ? current.data : { cards: [] };
      const cards = Array.isArray(currentData.cards) ? currentData.cards : [];
      const nextCards = savedCard.id === topDownCardForm.id
        ? cards.map((card) => card.id === savedCard.id ? savedCard : card)
        : [savedCard, ...cards];
      return { profileId: activeProfileId, data: { ...currentData, cards: nextCards } };
    });
    setTopDownSelectedDate(savedCard.date);
    setTopDownStorageError('');
    setIsTopDownCardModalOpen(false);
  };

  const deleteTopDownCard = (cardId) => {
    if (!window.confirm('Delete this analysis card?')) return;
    setTopDownState((current) => {
      const currentData = current.profileId === activeProfileId ? current.data : { cards: [] };
      return {
        profileId: activeProfileId,
        data: { ...currentData, cards: (currentData.cards || []).filter((card) => card.id !== cardId) },
      };
    });
  };

  const showAuthError = (error) => {
    const message = error?.message || 'We could not complete that request. Please try again.';
    const normalized = message.toLowerCase();
    if (normalized.includes('invalid login credentials')) {
      setAuthError('That email and password do not match. Check them and try again.');
    } else if (normalized.includes('email not confirmed')) {
      setAuthError('Please confirm your email from the link we sent before signing in.');
    } else if (normalized.includes('password') && (normalized.includes('short') || normalized.includes('least'))) {
      setAuthError('Choose a longer password that meets your Supabase password rules.');
    } else if (normalized.includes('already registered')) {
      setAuthError('An account may already exist for that email. Try signing in instead.');
    } else {
      setAuthError(message);
    }
    setAuthNotice('');
  };

  const openAuthModal = (mode = 'signin') => {
    setAuthMode(mode);
    setAuthError('');
    setAuthNotice('');
    setIsAuthModalOpen(true);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError('');
    setAuthNotice('');
    try {
      if (authMode === 'recovery') {
        const { error } = await supabase.auth.updateUser({ password: authPassword });
        if (error) {
          showAuthError(error);
        } else {
          setAuthPassword('');
          setAuthMode('signin');
          setAuthNotice('Your password has been updated.');
          setIsAuthModalOpen(false);
        }
      } else if (authMode === 'signup') {
        const { data, error } = await signUpWithEmail(authEmail.trim(), authPassword);
        if (error) {
          showAuthError(error);
        } else if (data?.session) {
          setSession(data.session);
          setIsAuthModalOpen(false);
          setAuthPassword('');
        } else {
          setAuthNotice('Account created. Check your email for the confirmation link, then sign in.');
          setAuthPassword('');
        }
      } else {
        const { data, error } = await signInWithEmail(authEmail.trim(), authPassword);
        if (error) {
          showAuthError(error);
        } else {
          setSession(data?.session || null);
          setIsAuthModalOpen(false);
          setAuthPassword('');
        }
      }
    } catch (error) {
      showAuthError(error);
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    const email = authEmail.trim();
    if (!email) {
      setAuthError('Enter your email address first, then choose “Forgot password?”.');
      setAuthNotice('');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    setAuthNotice('');
    try {
      const { error } = await sendPasswordResetEmail(email);
      if (error) showAuthError(error);
      else setAuthNotice('If an account uses that email, a password reset link has been sent.');
    } catch (error) {
      showAuthError(error);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAuthSignOut = async () => {
    const userId = session?.user?.id;
    if (userId) {
      const accountCacheKey = `tradelog_account_trades_${userId}_${activeProfileId}`;
      try { localStorage.setItem(accountCacheKey, JSON.stringify(trades.filter((trade) => !isDemoTrade(trade)))); } catch { /* Cloud data remains available when browser storage is full. */ }
      localStorage.setItem(`tradelog_topdown_${userId}_${activeProfileId}`, JSON.stringify(topDownState.data));
    }
    const { error } = await signOut();
    if (error) {
      showAuthError(error);
      setIsAuthModalOpen(true);
      return;
    }
    localStorage.removeItem(`tradelog_trades_${activeProfileId}`);
    localStorage.removeItem(`tradelog_topdown_${activeProfileId}`);
    setTradesProfileId('');
    setTradesStorageScope('');
    setTopDownState({ profileId: activeProfileId, data: {} });
    setSession(null);
  };

  const handleImportLocalTrades = async () => {
    if (!session?.user?.id || !cloudSyncReady || !pendingLocalTrades.length || cloudImportBusy) return;
    setCloudImportBusy(true);
    setCloudSyncState('loading');
    setCloudSyncMessage('Importing browser trades to your account…');
    try {
      const { data, error } = await supabase
        .from('trades')
        .insert(pendingLocalTrades.map((trade) => journalTradeToDatabaseRow(trade, session.user.id, activeProfileId)))
        .select('*');
      if (error) throw error;
      const importedTrades = (data || []).map(databaseRowToJournalTrade);
      const importedIds = new Set(importedTrades.map((trade) => String(trade._localTradeId || trade.id)));
      setTrades((current) => [
        ...importedTrades,
        ...current.filter((trade) => !importedIds.has(String(trade._localTradeId || trade.id))),
      ]);
      setPendingLocalTrades([]);
      localStorage.removeItem(`tradelog_trades_local_backup_${session.user.id}_${activeProfileId}`);
      const guestOwnerKey = `zerotilt_guest_owner_${activeProfileId}`;
      const guestOwnerId = localStorage.getItem(guestOwnerKey);
      if (!guestOwnerId || guestOwnerId === session.user.id) {
        localStorage.removeItem(`zerotilt_guest_trades_${activeProfileId}`);
        localStorage.removeItem(guestOwnerKey);
      }
      setCloudSyncState('ready');
      setCloudSyncMessage(`${importedTrades.length} local trade${importedTrades.length === 1 ? '' : 's'} imported to your account.`);
    } catch (error) {
      setCloudSyncState('error');
      setCloudSyncMessage(`Could not import browser trades: ${error?.message || 'Unknown database error'}`);
    } finally {
      setCloudImportBusy(false);
    }
  };

  const currentDateTime = () => getZonedDateTime(new Date(), journalTimezone);
  const handleJournalTimezoneChange = async (event) => {
    const nextTimezone = event.target.value;
    if (!isValidTimeZone(nextTimezone)) return;
    const rezoneTrade = (trade) => {
      const instant = getTradeInstant(trade, journalTimezone);
      if (Number.isNaN(instant.getTime())) return { ...trade, timeZone: nextTimezone };
      return { ...trade, ...getZonedDateTime(instant, nextTimezone), _timestamp: instant.toISOString(), _timestampChanged: false };
    };
    setTrades((current) => current.map(rezoneTrade));
    setPendingLocalTrades((current) => current.map(rezoneTrade));
    setJournalTimezone(nextTimezone);
    setJournalClockNow(new Date());
    const storageKey = session?.user?.id
      ? `zerotilt_journal_timezone_user_${session.user.id}`
      : `zerotilt_journal_timezone_guest_${activeProfileId}`;
    try { localStorage.setItem(storageKey, nextTimezone); } catch { /* Keep the selection active for this visit. */ }
    if (!session?.user?.id) {
      setTimezoneSyncMessage('Saved on this device.');
      return;
    }
    setTimezoneSyncMessage('Saving to your account…');
    try {
      const { error } = await supabase.auth.updateUser({ data: { journal_timezone: nextTimezone } });
      setTimezoneSyncMessage(error ? 'Saved on this device; account sync needs attention.' : 'Synced with your account.');
    } catch {
      setTimezoneSyncMessage('Saved on this device; account sync needs attention.');
    }
  };
  const tradeDraftKey = (profileId = activeProfileId) => `tradelog_trade_draft_${profileId}`;

  const handleOpenAddModal = (quick = false) => {
    setTradeEntryMode('standard');
    setQuickAddMode(quick);
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(tradeDraftKey()) || 'null'); } catch { draft = null; }
    setHasRestoredTradeDraft(Boolean(draft));
    setTradeFormTouched(Boolean(draft));
    setFormData(draft
      ? { ...EMPTY_FORM, ...tradeDefaults, ...currentDateTime(), ...draft, timeZone: draft.timeZone || journalTimezone, id: null }
      : { ...EMPTY_FORM, ...tradeDefaults, ...currentDateTime() });
    setIsModalOpen(true);
  };

  const handleDuplicateLastTrade = () => {
    const lastTrade = [...trades].sort((a, b) => getTradeInstant(b, journalTimezone) - getTradeInstant(a, journalTimezone))[0];
    if (!lastTrade) return;
    setQuickAddMode(false); setTradeEntryMode('standard'); setHasRestoredTradeDraft(false); setTradeFormTouched(true);
    setFormData({ ...EMPTY_FORM, ...lastTrade, ...currentDateTime(), timeZone: journalTimezone, _timestamp: null, _timestampChanged: true, id: null, entry: '', stopLoss: '', takeProfit: '', exit: '', risk: '', resultR: '', commissionCost: '', spreadCost: '', notes: '', psychology: [], mistakes: [], screenshotUrl: '', plannedScreenshotUrl: '', tradingViewUrl: '', plannedTradingViewUrl: '' });
    setIsModalOpen(true);
  };

  const handleInstallPwa = async () => {
    if (!deferredPwaInstall) return;
    try {
      await deferredPwaInstall.prompt();
      const choice = await deferredPwaInstall.userChoice;
      if (choice?.outcome === 'accepted') setIsPwaInstalled(true);
    } finally {
      setDeferredPwaInstall(null);
    }
  };

  const exportJournal = (format) => {
    const dateStamp = getZonedDateString(new Date(), journalTimezone);
    const safeName = (currentProfileObj.name || 'journal').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    const fields = ['date', 'time', 'timeZone', 'timestampUTC', 'instrument', 'direction', 'setup', 'entry', 'stopLoss', 'takeProfit', 'exit', 'risk', 'resultR', 'commissionCost', 'spreadCost', 'psychology', 'mistakes', 'notes'];
    let contents; let mime; let extension;
    if (format === 'json') {
      contents = JSON.stringify({ app: 'CookurTrades', version: 1, exportedAt: new Date().toISOString(), journalTimezone, profile: currentProfileObj, trades }, null, 2);
      mime = 'application/json'; extension = 'json';
    } else {
      const quote = (value) => String.fromCharCode(34) + String(Array.isArray(value) ? value.join(String.fromCharCode(59, 32)) : value ?? String()).replaceAll(String.fromCharCode(34), String.fromCharCode(34).repeat(2)) + String.fromCharCode(34);
      contents = String.fromCharCode(0xFEFF) + [fields.join(','), ...trades.map((trade) => fields.map((field) => quote(field === 'timestampUTC' ? (trade._timestamp || getTradeInstant(trade, journalTimezone).toISOString()) : trade[field])).join(','))].join('\r\n');
      mime = 'text/csv;charset=utf-8'; extension = 'csv';
    }
    const url = URL.createObjectURL(new Blob([contents], { type: mime }));
    const link = document.createElement('a'); link.href = url; link.download = `cookurtrades-${safeName}-${dateStamp}.${extension}`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleAddTradeOnDate = (date) => {
    setQuickAddMode(false);
    setHasRestoredTradeDraft(false);
    setTradeFormTouched(false);
    setTradeEntryMode('standard');
    setFormData({
      ...EMPTY_FORM,
      ...currentDateTime(),
      date,
    });
    setIsModalOpen(true);
  };

  const handleEditTrade = (trade) => {
    setQuickAddMode(false);
    setHasRestoredTradeDraft(false);
    setTradeFormTouched(false);
    setTradeEntryMode(
      trade.plannedEntry || trade.plannedStopLoss || trade.plannedTakeProfit || trade.plannedScreenshotUrl
        || trade.plannedTradingViewUrl
        ? 'compare'
        : 'standard'
    );
    setFormData({ ...EMPTY_FORM, ...trade });
    setIsModalOpen(true);
  };

  const handleDeleteTrade = async (id) => {
    if (!window.confirm('Are you sure you want to delete this trade entry?')) return;
    if (session?.user?.id && cloudSyncReady && isDatabaseUuid(id)) {
      const { error } = await supabase.from('trades').delete().eq('id', id).eq('user_id', session.user.id);
      if (error) {
        setCloudSyncState('error');
        setCloudSyncMessage(`Could not delete this cloud trade: ${error.message}`);
        return;
      }
    }
    setTrades((prev) => prev.filter((trade) => trade.id !== id));
    setPendingLocalTrades((prev) => prev.filter((trade) => String(trade.id) !== String(id) && String(trade._localTradeId || '') !== String(id)));
    if (selectedDayTrades) {
      const remainingForDay = trades.filter((trade) => trade.id !== id && trade.date === selectedDayTrades.dateStr);
      if (remainingForDay.length === 0) setSelectedDayTrades(null);
    }
  };

  const handleTagToggle = (tagLabel) => {
    setFormData((prev) => {
      const current = prev.psychology || [];
      const exists = current.includes(tagLabel);
      return {
        ...prev,
        psychology: exists ? current.filter((t) => t !== tagLabel) : [...current, tagLabel],
      };
    });
  };

  const handleMistakeToggle = (tagLabel) => {
    setFormData((prev) => {
      const current = prev.mistakes || [];
      const exists = current.includes(tagLabel);
      return {
        ...prev,
        mistakes: exists ? current.filter((tag) => tag !== tagLabel) : [...current, tagLabel],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const entryTimestamp = formData._timestamp && !formData._timestampChanged
      ? formData._timestamp
      : zonedWallTimeToDate(formData.date, formData.time, formData.timeZone || journalTimezone).toISOString();
    let tradeToSave = {
      ...formData,
      ...(formData.id ? {} : { id: Date.now().toString() }),
      resultR: parseFloat(formData.resultR) || 0,
      timeZone: formData.timeZone || journalTimezone,
      _timestamp: entryTimestamp,
      _timestampChanged: false,
    };

    if (session?.user?.id && cloudSyncReady) {
      setCloudSyncState('loading');
      setCloudSyncMessage('Saving trade to your account…');
      try {
        const row = journalTradeToDatabaseRow(tradeToSave, session.user.id, activeProfileId);
        const result = row.id
          ? await supabase.from('trades').upsert(row, { onConflict: 'id' }).select('*').single()
          : await supabase.from('trades').insert(row).select('*').single();
        if (result.error) throw result.error;
        tradeToSave = databaseRowToJournalTrade(result.data, journalTimezone);
        const syncedLocalId = String(tradeToSave._localTradeId || tradeToSave.id);
        setPendingLocalTrades((current) => current.filter((trade) => String(trade._localTradeId || trade.id) !== syncedLocalId));
        setCloudSyncState('ready');
        setCloudSyncMessage('Trade saved to your Supabase account.');
      } catch (error) {
        setCloudSyncState('error');
        setCloudSyncMessage(`Trade saved in this browser but not in Supabase: ${error?.message || 'Unknown database error'}`);
      }
    }

    if (formData.id) {
      setTrades((prev) => prev.map((trade) => trade.id === formData.id ? tradeToSave : trade));
      if (selectedDayTrades && formData.date !== selectedDayTrades.dateStr) setSelectedDayTrades({ dateStr: formData.date });
    } else {
      setTrades((prev) => [tradeToSave, ...prev]);
    }
    clearNoSetupReview(activeProfileId, tradeToSave.date);
    if (reviewedNoSetupDisplay.profileId === activeProfileId && reviewedNoSetupDisplay.date === tradeToSave.date) {
      setReviewedNoSetupDisplay({ profileId: activeProfileId, date: tradeToSave.date, reviewed: false });
    }

    setIsModalOpen(false);
    setFormData(EMPTY_FORM);
    setHasRestoredTradeDraft(false);
    setTradeFormTouched(false);
    if (!formData.id) {
      try { localStorage.removeItem(tradeDraftKey()); } catch { /* Trade is already saved. */ }
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const changeMonth = (delta) => {
    setCurrentDate(new Date(year, month + delta, 1));
    setDashboardTradePage(1);
  };

  const handleNoSetupReviewToggle = (date) => {
    const reviewed = toggleNoSetupReview(activeProfileId, date);
    setReviewedNoSetupDisplay({ profileId: activeProfileId, date, reviewed });
  };

  const tradesByDate = trades.reduce((acc, trade) => {
    acc[trade.date] = acc[trade.date] || [];
    acc[trade.date].push(trade);
    return acc;
  }, {});
  const dashboardMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const dashboardMonthTrades = trades.filter((trade) => (trade.date || '').startsWith(`${dashboardMonthPrefix}-`));
  const dashboardMonthDays = Object.entries(tradesByDate)
    .filter(([date]) => date.startsWith(`${dashboardMonthPrefix}-`))
    .map(([date, dayTrades]) => ({
      date,
      trades: dayTrades,
      totalR: dayTrades.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0),
    }));
  const dashboardMonthNetR = dashboardMonthTrades.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0);
  const dashboardBestDay = dashboardMonthDays.reduce((best, day) => !best || day.totalR > best.totalR ? day : best, null);
  const dashboardRedDays = dashboardMonthDays.filter((day) => day.totalR < 0).length;
  const dashboardDefaultDate = dashboardMonthTrades[0]?.date || todayKey;
  const dashboardReviewDate = dashboardSelectedDate.startsWith(`${dashboardMonthPrefix}-`)
    ? dashboardSelectedDate
    : dashboardDefaultDate;
  const dashboardReviewTrades = (tradesByDate[dashboardReviewDate] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const dailyTradesPerPage = 3;
  const dashboardTradePages = Math.max(1, Math.ceil(dashboardReviewTrades.length / dailyTradesPerPage));
  const currentDashboardTradePage = Math.min(dashboardTradePage, dashboardTradePages);
  const paginatedDashboardTrades = dashboardReviewTrades.slice((currentDashboardTradePage - 1) * dailyTradesPerPage, currentDashboardTradePage * dailyTradesPerPage);
  const noSetupReviewedForCalendarDate = dashboardReviewDate === todayKey && (
    reviewedNoSetupDisplay.profileId === activeProfileId && reviewedNoSetupDisplay.date === todayKey
      ? reviewedNoSetupDisplay.reviewed
      : readNoSetupReview(activeProfileId, todayKey)
  );
  const dashboardMistakeSummary = MISTAKE_TAGS.map((tag) => {
    const tagged = dashboardMonthTrades.filter((trade) => (trade.mistakes || []).includes(tag));
    const totalR = tagged.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0);
    return { tag, count: tagged.length, totalR, avgR: tagged.length ? totalR / tagged.length : 0 };
  }).filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count);
  const dashboardMindsetSummary = PSYCHOLOGY_OPTIONS.map(({ label }) => {
    const tagged = dashboardMonthTrades.filter((trade) => (trade.psychology || []).includes(label));
    const totalR = tagged.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0);
    return { label, count: tagged.length, avgR: tagged.length ? totalR / tagged.length : 0 };
  }).filter((entry) => entry.count > 0).sort((a, b) => b.avgR - a.avgR);
  const selectedDayTradeList = selectedDayTrades
    ? trades.filter((trade) => trade.date === selectedDayTrades.dateStr).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    : [];
  const selectedDayTradePages = Math.max(1, Math.ceil(selectedDayTradeList.length / dailyTradesPerPage));
  const currentSelectedDayTradePage = Math.min(selectedDayTradePage, selectedDayTradePages);
  const paginatedSelectedDayTrades = selectedDayTradeList.slice((currentSelectedDayTradePage - 1) * dailyTradesPerPage, currentSelectedDayTradePage * dailyTradesPerPage);

  const tradeInstrumentOptions = [...new Set([
    ...INSTRUMENT_PRESETS.flatMap((group) => group.assets),
    ...customAssets,
    ...trades.map((trade) => (trade.instrument || '').trim()).filter(Boolean),
  ])];
  const tradePsychologyOptions = [...new Set([
    ...PSYCHOLOGY_OPTIONS.map((option) => option.label),
    ...trades.flatMap((trade) => trade.psychology || []),
  ])];
  const filteredTrades = trades.filter((trade) => {
    const term = searchTerm.trim().toLowerCase();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const monthStartKey = `${todayKey.slice(0, 7)}-01`;
    const cutoff = new Date(today);
    if (tradeFilters.period === '30d') cutoff.setDate(cutoff.getDate() - 30);
    if (tradeFilters.period === '90d') cutoff.setDate(cutoff.getDate() - 90);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const searchable = [trade.date, trade.time, trade.instrument, trade.setup, trade.direction, trade.resultR, trade.notes, ...(trade.psychology || []), ...(trade.mistakes || [])]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    return (!term || searchable.some((value) => value.includes(term))) &&
      (tradeFilters.instrument === 'all' || trade.instrument === tradeFilters.instrument) &&
      (tradeFilters.direction === 'all' || trade.direction === tradeFilters.direction) &&
      (tradeFilters.timeOfDay === 'all' || getTimeOfDayBucket(trade.time) === tradeFilters.timeOfDay) &&
      (tradeFilters.period === 'all' || (tradeFilters.period === 'month' ? trade.date >= monthStartKey && trade.date <= todayKey : trade.date >= cutoffKey && trade.date <= todayKey)) &&
      (tradeFilters.psychology === 'all' || (trade.psychology || []).includes(tradeFilters.psychology)) &&
      (tradeFilters.mistake === 'all' || (trade.mistakes || []).includes(tradeFilters.mistake));
  });
  const labNetR = filteredTrades.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0);
  const labWins = filteredTrades.filter((trade) => (parseFloat(trade.resultR) || 0) > 0);
  const labLosses = filteredTrades.filter((trade) => (parseFloat(trade.resultR) || 0) < 0);
  const labWinRate = filteredTrades.length ? Math.round((labWins.length / filteredTrades.length) * 100) : 0;
  const labExpectancy = filteredTrades.length ? labNetR / filteredTrades.length : 0;
  const labGrossWins = labWins.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0);
  const labGrossLosses = Math.abs(labLosses.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0));
  const labProfitFactor = labGrossLosses ? (labGrossWins / labGrossLosses).toFixed(2) : labGrossWins ? '∞' : '—';
  const labInstrumentStats = Object.values(filteredTrades.reduce((stats, trade) => {
    const symbol = (trade.instrument || 'Unknown').trim();
    stats[symbol] = stats[symbol] || { symbol, netR: 0, count: 0 };
    stats[symbol].netR += parseFloat(trade.resultR) || 0;
    stats[symbol].count += 1;
    return stats;
  }, {})).sort((a, b) => b.netR - a.netR);
  const labMaxInstrumentR = Math.max(1, ...labInstrumentStats.map((item) => Math.abs(item.netR)));
  const labChartTrades = [...filteredTrades].sort((a, b) => getTradeInstant(a, journalTimezone) - getTradeInstant(b, journalTimezone));
  const labChartMaxR = Math.max(1, ...labChartTrades.map((trade) => Math.abs(parseFloat(trade.resultR) || 0)));
  const tradesPerPage = 10;
  const totalTradePages = Math.max(1, Math.ceil(filteredTrades.length / tradesPerPage));
  const currentTradePage = Math.min(tradePage, totalTradePages);
  const paginatedTrades = filteredTrades.slice((currentTradePage - 1) * tradesPerPage, currentTradePage * tradesPerPage);
  const getTradeCosts = (trade) => (parseFloat(trade.commissionCost) || 0) + (parseFloat(trade.spreadCost) || 0);
  const totalLoggedTradeCosts = trades.reduce((sum, trade) => sum + getTradeCosts(trade), 0);
  const mistakePerformance = MISTAKE_TAGS.map((tag) => {
    const taggedTrades = trades.filter((trade) => (trade.mistakes || []).includes(tag));
    const netR = taggedTrades.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0);
    const wins = taggedTrades.filter((trade) => (parseFloat(trade.resultR) || 0) > 0).length;
    return {
      tag,
      count: taggedTrades.length,
      winRate: taggedTrades.length ? Math.round((wins / taggedTrades.length) * 100) : 0,
      netR,
      avgR: taggedTrades.length ? netR / taggedTrades.length : 0,
    };
  }).filter((stat) => stat.count > 0);
  const sessionDefinitions = [
    { name: 'Asia', color: '#38bdf8', timeZone: 'Asia/Tokyo', start: 9, end: 18 },
    { name: 'London', color: '#f59e0b', timeZone: 'Europe/London', start: 8, end: 17 },
    { name: 'New York', color: '#a78bfa', timeZone: 'America/New_York', start: 8, end: 17 },
  ];
  const sessionClockFormatters = new Map(sessionDefinitions.map((definition) => [definition.name, new Intl.DateTimeFormat('en-GB', {
    timeZone: definition.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })]));
  const offSessionDefinition = { name: 'Off-session', color: '#64748b' };
  const getSessionForTrade = (trade) => {
      const entry = getTradeInstant(trade, journalTimezone);
    if (Number.isNaN(entry.getTime())) return offSessionDefinition.name;
    const activeSessions = sessionDefinitions.filter((definition) => {
      const parts = sessionClockFormatters.get(definition.name).formatToParts(entry);
      const hour = Number(parts.find((part) => part.type === 'hour')?.value);
      return hour >= definition.start && hour < definition.end;
    });
    // During overlaps, assign the trade to the later-opening market session.
    return (activeSessions.find((item) => item.name === 'New York')
      || activeSessions.find((item) => item.name === 'London')
      || activeSessions[0]
      || offSessionDefinition).name;
  };
  const sessionTradeBuckets = new Map([...sessionDefinitions, offSessionDefinition].map((session) => [session.name, []]));
  trades.forEach((trade) => sessionTradeBuckets.get(getSessionForTrade(trade)).push(trade));
  const dashboardSessionStats = [...sessionDefinitions, offSessionDefinition].map((session) => {
    const sessionTrades = sessionTradeBuckets.get(session.name);
    return {
      ...session,
      count: sessionTrades.length,
      netR: sessionTrades.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0),
    };
  });
  const dashboardSessionCount = dashboardSessionStats.reduce((sum, session) => sum + session.count, 0);
  let sessionAngle = 0;
  const dashboardSessionGradient = dashboardSessionCount
    ? `conic-gradient(${dashboardSessionStats.map((session) => { const start = sessionAngle; sessionAngle += session.count / dashboardSessionCount * 360; return `${session.color} ${start}deg ${sessionAngle}deg`; }).join(', ')})`
    : 'conic-gradient(#1c2436 0deg 360deg)';

  useEffect(() => {
    const isTypingTarget = (target) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    const handleShortcuts = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
      if (event.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        return;
      }
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault(); handleOpenAddModal(!event.shiftKey);
      } else if (event.key === '/') {
        event.preventDefault(); setActiveTab('trades'); window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [isModalOpen, activeProfileId, trades]);

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`} data-theme={theme}>
      {/* Sidebar Navigation & Profile Selector */}
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/icons/cookurtrades-mark.svg" alt="" />
          <div className="brand-copy">
            <h2 className="brand-title">CookurTrades</h2>
            <p className="brand-sub">Personal Journal</p>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Profile Switcher Box */}
        {!isSidebarCollapsed && <div className="profile-selector-card">
          <span className="profile-label">Active Journal Profile</span>
          <select
            className="profile-select"
            value={activeProfileId}
            onChange={(e) => switchActiveProfile(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className="manage-profiles-btn"
            onClick={() => setIsProfileModalOpen(true)}
          >
            + Manage Profiles
          </button>
        </div>}
        {isSidebarCollapsed && (
          <button
            className="sidebar-profile-icon"
            type="button"
            title={`Active profile: ${currentProfileObj.name} · Manage profiles`}
            aria-label={`Manage profiles. Active profile: ${currentProfileObj.name}`}
            onClick={() => setIsProfileModalOpen(true)}
          >
            {currentProfileObj.name.slice(0, 1).toUpperCase()}
          </button>
        )}

        <nav className="nav-menu">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            title="Dashboard"
          >
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg></span><span className="nav-label">Dashboard</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
            title="Calendar"
          >
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/></svg></span><span className="nav-label">Calendar</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'trades' ? 'active' : ''}`}
            onClick={() => setActiveTab('trades')}
            title="Trades"
          >
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h13a2 2 0 0 1 2 2v15H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z"/><path d="M7 3v17M10 8h7M10 12h7M10 16h5"/></svg></span><span className="nav-label">Trades</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'topdown' ? 'active' : ''}`}
            onClick={() => setActiveTab('topdown')}
            title="Your Analysis"
          >
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M8 10.5h5M10.5 8v5"/></svg></span><span className="nav-label">Your Analysis</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
            title="Monte Carlo"
          >
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg></span><span className="nav-label">Monte Carlo</span>
          </button>
          <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Settings">
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7 1-1.8-2.1-2.1-1.8 1-1.7-.7L11 2.5H8l-.7 2-1.7.7-1.8-1-2.1 2.1 1 1.8-.7 1.7-2 .7v3l2 .7.7 1.7-1 1.8 2.1 2.1 1.8-1 1.7.7.7 2h3l.7-2 1.7-.7 1.8 1 2.1-2.1-1-1.8.7-1.7 2-.7Z" transform="translate(1.8 1.7) scale(.84)"/></svg></span><span className="nav-label">Settings</span>
          </button>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="main-content">
        <header className="header-bar">
          <div>
            <span className="section-subtitle">
              JOURNAL PROFILE: <span className="text-amber">{currentProfileObj.name}</span>
            </span>
            <span className="journal-clock" aria-label={`Journal timezone ${getTimeZoneCity(journalTimezone)}, ${getUtcOffsetLabel(journalTimezone, journalClockNow)}`}>
              {getTimeZoneCity(journalTimezone)} · {getUtcOffsetLabel(journalTimezone, journalClockNow)}
            </span>
            <h1 className="section-title">
              {activeTab === 'dashboard' && greeting}
              {activeTab === 'calendar' && 'Performance Calendar'}
              {activeTab === 'trades' && 'Performance Lab'}
              {activeTab === 'topdown' && 'Your Analysis'}
              {activeTab === 'simulator' && 'Prop Firm Monte Carlo Engine'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
          </div>
          <div className="header-actions">
            {session ? (
              <div className="auth-header-area">
                <span className="auth-user-email">{session.user.email}</span>
                <span className={`cloud-sync-indicator ${cloudSyncState}`} title={cloudSyncMessage} role="status">
                  <i aria-hidden="true" />{cloudSyncState === 'ready' ? 'Cloud synced' : cloudSyncState === 'loading' ? 'Syncing…' : cloudSyncState === 'error' ? 'Sync issue' : 'Local data'}
                </span>
                {cloudSyncReady && pendingLocalTrades.length > 0 && <button type="button" className="cloud-import-button" onClick={handleImportLocalTrades} disabled={cloudImportBusy}>{cloudImportBusy ? 'Importing…' : `Import ${pendingLocalTrades.length} local`}</button>}
              </div>
            ) : authLoading ? (
              <span className="auth-loading-label">Checking account…</span>
            ) : (
              <div className="auth-header-area">
                <button type="button" className="auth-header-button" onClick={() => openAuthModal('signin')}>Email sign in</button>
              </div>
            )}

            <button className="cal-btn quick-add-header-btn" type="button" onClick={() => handleOpenAddModal(true)} title="Quick add · N">Quick add <kbd>N</kbd></button>
            <button className="cal-btn duplicate-last-header-btn" type="button" onClick={handleDuplicateLastTrade} disabled={!trades.length} title="Duplicate last trade">Duplicate last</button>
            <button className="btn-primary" onClick={() => handleOpenAddModal(false)} title="Full trade entry · Shift+N">+ Add trade</button>
          </div>
        </header>

        {pipSqueakEnabled && activeTab === 'dashboard' && tradesProfileId === activeProfileId && (!session || isProfileDataReady) && (
          <PersonalityNudge category={personalityCategory} contextKey={personalityContextKey} page={activeTab} />
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <>
            {tradesNeedingReview.length > 0 && !reviewReminderDismissed && (
              <aside className="review-reminder" role="status">
                <div><strong>A tiny journal nudge</strong><span>{tradesNeedingReview.length} recent {tradesNeedingReview.length === 1 ? 'trade could use' : 'trades could use'} a note or chart check-in.</span></div>
                <div className="review-reminder-actions">
                  <button type="button" className="cal-btn" onClick={() => handleEditTrade(tradesNeedingReview[0])}>Review latest</button>
                  <button type="button" className="review-reminder-dismiss" onClick={dismissReviewReminder}>Later today</button>
                </div>
              </aside>
            )}
            <div className="stats-grid">
              <div className="stat-card"><span className="stat-label">TOTAL R</span><div className={`stat-value ${parseFloat(totalR) >= 0 ? 'text-green' : 'text-red'}`}>{parseFloat(totalR) >= 0 ? '+' : ''}{totalR}R</div><span className="stat-sub">{trades.length} recorded trades</span></div>
              <div className="stat-card"><span className="stat-label">WIN RATE</span><div className="stat-value text-white">{winRate}%</div><span className="stat-sub">{winCount} wins / {trades.length} trades</span></div>
              <div className="stat-card"><span className="stat-label">AVERAGE R</span><div className={`stat-value ${parseFloat(avgR) >= 0 ? 'text-green' : 'text-red'}`}>{parseFloat(avgR) >= 0 ? '+' : ''}{avgR}R</div><span className="stat-sub">Per trade</span></div>
              <div className="stat-card"><span className="stat-label">P&amp;L</span><div className={`stat-value ${parseFloat(totalPL) >= 0 ? 'text-green' : 'text-red'}`}>{parseFloat(totalPL) >= 0 ? '+' : ''}${totalPL}</div><span className="stat-sub">Illustrative $10/R</span></div>
            </div>
            <div className="analytics-section-title">Expectancy &amp; Profit Factor</div>
            <div className="dashboard-grid">
              <section className="panel-card"><span className="stat-label">EXPECTANCY</span><div className="flex-between"><div><div className={`stat-value ${parseFloat(expectancyR) >= 0 ? 'text-green' : 'text-red'}`}>{parseFloat(expectancyR) >= 0 ? '+' : ''}{expectancyR}R</div><span className="stat-sub">Expected return per trade executed</span></div><div className="expectancy-bar-container"><span className="expectancy-bar-win">+{grossWinsR.toFixed(1)}R</span><span className="expectancy-bar-loss">-{grossLossesR.toFixed(1)}R</span></div></div></section>
              <section className="panel-card flex-between"><div><span className="stat-label">PROFIT FACTOR</span><div className="stat-value text-white">{profitFactor}</div><span className="stat-sub">Gross profit / Gross loss ratio</span></div><div className="pf-gauge" style={{ '--pf-angle': `${profitFactorProgress * 360}deg` }} role="img" aria-label={`Profit factor gauge: ${profitFactor}`} title={`Profit factor: ${profitFactor}`} /></section>
            </div>
            <div className="analytics-section-title">Winners and Losers</div>
            <div className="dashboard-grid mb-6">
              <section className="panel-card border-green-glow"><h3 className="text-green">Winners</h3><p className="panel-sub">Total winners <strong>{winningTrades.length}</strong></p><p className="panel-sub">Best win <strong className="text-green">+{bestTradeR}R</strong></p><p className="panel-sub">Average win <strong className="text-green">+{avgWinR}R</strong></p><p className="panel-sub">Most consecutive wins <strong className="text-green">{maxConsecutiveWins}</strong></p></section>
              <section className="panel-card border-red-glow"><h3 className="text-red">Losers</h3><p className="panel-sub">Total losers <strong>{losingTrades.length}</strong></p><p className="panel-sub">Worst loss <strong className="text-red">{worstTradeR}R</strong></p><p className="panel-sub">Average loss <strong className="text-red">{avgLossR}R</strong></p><p className="panel-sub">Most consecutive losses <strong className="text-red">{maxConsecutiveLosses}</strong></p></section>
            </div>
            <div className="dashboard-equity-sessions-row">
            <div className="panel-card equity-panel">
              <div className="panel-header space-between">
                <div>
                  <h3>{equityChartType === 'line' ? 'Equity Curve' : equityChartType === 'cumulative-bars' ? 'Cumulative R Bars' : equityChartType === 'daily-bars' ? 'Daily Net R' : 'Per-Trade Results'}</h3>
                  <p className="panel-sub">
                    {equityChartType === 'line' || equityChartType === 'cumulative-bars'
                      ? 'Cumulative account growth across logged trades'
                      : equityChartType === 'daily-bars' ? 'Net result for each trading day' : 'R result for each logged trade'}
                  </p>
                </div>
                <select
                  aria-label="Equity graph type"
                  value={equityChartType}
                  onChange={(e) => {
                    setEquityChartType(e.target.value);
                    showBottomBuddyPopup('chart');
                  }}
                  style={{ width: 'auto', minWidth: '170px' }}
                >
                  <option value="line">Equity line</option>
                  <option value="cumulative-bars">Cumulative R bars</option>
                  <option value="daily-bars">Daily net R bars</option>
                  <option value="trade-bars">Per-trade R bars</option>
                </select>
              </div>
              <div className="equity-chart-container">
                {sortedTradesForEquity.length > 0 ? (
                  <svg className="equity-svg" viewBox="0 0 500 150" preserveAspectRatio="none">
                    {(() => {
                      const isLine = equityChartType === 'line';
                      const chartData = isLine || equityChartType === 'cumulative-bars'
                        ? equityCurvePoints
                        : equityChartType === 'daily-bars'
                          ? dailyRPoints
                          : sortedTradesForEquity.map((trade) => ({
                            date: trade.date,
                            totalR: parseFloat(trade.resultR) || 0,
                            label: trade.instrument,
                          }));
                      const values = chartData.map((point) => point.totalR);
                      const min = Math.min(0, ...values);
                      const max = Math.max(0, ...values);
                      const range = max - min || 1;
                      const chartTop = 18;
                      const chartBottom = 116;
                      const zeroY = chartBottom - ((0 - min) / range) * (chartBottom - chartTop);
                      const pointX = (idx) => chartData.length === 1 ? 250 : (idx / (chartData.length - 1)) * 460 + 20;
                      const pointY = (value) => chartBottom - ((value - min) / range) * (chartBottom - chartTop);
                      const pointsStr = chartData.map((point, idx) => `${pointX(idx)},${pointY(point.totalR)}`).join(' ');
                      const barWidth = Math.max(4, Math.min(24, (460 / chartData.length) * 0.62));

                      return (
                        <>
                          <line x1="20" y1={zeroY} x2="480" y2={zeroY} stroke="#334155" strokeWidth="1" />
                          {isLine ? <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={pointsStr} /> : null}
                          {chartData.map((p, idx) => {
                            const x = pointX(idx);
                            const y = pointY(p.totalR);
                            const label = p.label || p.date.slice(5).replace('-', '/');
                            const barHeight = Math.max(1, Math.abs(zeroY - y));
                            const barY = Math.min(zeroY, y);
                            return (
                              <g key={`${p.date}-${idx}`} className="equity-point-group">
                                {isLine ? (
                                  <circle cx={x} cy={y} r="4" fill={p.totalR >= 0 ? '#10b981' : '#ef4444'} />
                                ) : (
                                  <rect x={x - barWidth / 2} y={barY} width={barWidth} height={barHeight} rx="2" fill={p.totalR >= 0 ? '#10b981' : '#ef4444'} />
                                )}
                                {(chartData.length <= 18 || idx % Math.ceil(chartData.length / 18) === 0 || idx === chartData.length - 1) && (
                                  <text x={x} y="139" textAnchor="middle" fill="#94a3b8" fontSize="8">{label}</text>
                                )}
                                <title>{`${p.date}${p.label ? ` · ${p.label}` : ''}: ${p.totalR >= 0 ? '+' : ''}${p.totalR.toFixed(1)}R`}</title>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                ) : (
                  <div className="text-muted text-center py-6">Log trades in this profile to plot performance.</div>
                )}
              </div>
            </div>
              <section className="panel-card session-distribution-panel">
                <div className="panel-header">
                  <h3>Trades by session</h3>
                  <p className="panel-sub">Entry time distribution · UTC windows, DST-aware</p>
                </div>
                <div className="session-chart-content">
                  <div className="session-donut" style={{ background: dashboardSessionGradient }} role="img" aria-label={dashboardSessionCount ? `Session distribution across ${dashboardSessionCount} trades` : 'No trades available for session distribution'}>
                    <div className="session-donut-center"><strong>{dashboardSessionCount}</strong><span>trades</span></div>
                  </div>
                  <div className="session-legend">
                    {dashboardSessionStats.map((session) => {
                      const percent = dashboardSessionCount ? Math.round(session.count / dashboardSessionCount * 100) : 0;
                      return <div className="session-legend-row" key={session.name}><span className="session-name"><i style={{ background: session.color }} />{session.name}</span><strong>{session.count} <small>({percent}%)</small></strong></div>;
                    })}
                  </div>
                </div>
                <p className="session-time-note">Trade time is interpreted in {journalTimezone}. UTC windows: Asia 00:00–09:00 · London 08:00–17:00 standard / 07:00–16:00 DST · New York 13:00–22:00 standard / 12:00–21:00 DST. Overlaps count toward the later-opening session.</p>
              </section>
            </div>
          </>
        )}

        {/* CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <>
            <div className="journal-review-stats">
              <div className="stat-card">
                <span className="stat-label">{monthNames[month]} RESULT</span>
                <div className={`stat-value ${dashboardMonthNetR >= 0 ? 'text-green' : 'text-red'}`}>
                  {dashboardMonthNetR >= 0 ? '+' : ''}{dashboardMonthNetR.toFixed(1)}R
                </div>
                <span className="stat-sub">{dashboardMonthTrades.length} trades this month</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">BEST DAY</span>
                <div className={`stat-value ${dashboardBestDay && dashboardBestDay.totalR >= 0 ? 'text-green' : 'text-dim'}`}>
                  {dashboardBestDay ? `${dashboardBestDay.totalR >= 0 ? '+' : ''}${dashboardBestDay.totalR.toFixed(1)}R` : '—'}
                </div>
                <span className="stat-sub">{dashboardBestDay ? new Date(`${dashboardBestDay.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No trades this month'}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">RED DAYS</span>
                <div className="stat-value text-red">{dashboardRedDays}</div>
                <span className="stat-sub">Of {dashboardMonthDays.length} active days</span>
              </div>
              <div className="stat-card aura-calendar-stat">
                <div className="aura-calendar-circle" style={{ '--aura-progress': `${auraPoints / 10}%` }} role="img" aria-label={`Aura Points: ${auraPoints} out of 1000`} title={`Aura Points: ${auraPoints} out of 1000`}>
                  <div className="aura-calendar-circle-center"><strong>{auraPoints}</strong><span>AURA</span></div>
                </div>
              </div>
            </div>

            <div className="journal-review-grid">
              <section className="panel-card journal-review-calendar-panel">
                <div className="calendar-header">
                  <h2>{monthNames[month]} {year}</h2>
                  <div className="calendar-controls">
                    <button onClick={() => changeMonth(-1)} className="cal-btn" aria-label="Previous month">◄</button>
                    <button onClick={() => { setCurrentDate(new Date(`${todayKey}T12:00:00`)); setDashboardSelectedDate(todayKey); setDashboardTradePage(1); }} className="cal-btn">Today</button>
                    <button onClick={() => changeMonth(1)} className="cal-btn" aria-label="Next month">►</button>
                    <label className="calendar-jump" title="Jump to month">
                      <span>Jump</span><input type="month" value={dashboardMonthPrefix} onChange={(event) => { if (!event.target.value) return; const [jumpYear, jumpMonth] = event.target.value.split('-').map(Number); setCurrentDate(new Date(jumpYear, jumpMonth - 1, 1)); setDashboardTradePage(1); }} aria-label="Jump to calendar month" />
                    </label>
                  </div>
                </div>
                <div className="journal-review-calendar" role="grid" aria-label={`${monthNames[month]} ${year} trading results`}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span className="review-calendar-heading" key={day}>{day}</span>)}
                  {Array.from({ length: firstDayOfMonth }).map((_, idx) => <span className="review-calendar-empty" key={`blank-${idx}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const dateStr = `${dashboardMonthPrefix}-${String(dayNum).padStart(2, '0')}`;
                    const dayData = dashboardMonthDays.find((day) => day.date === dateStr);
                    const selected = dashboardReviewDate === dateStr;
                    const tone = dayData ? dayData.totalR > 0 ? 'profit' : dayData.totalR < 0 ? 'loss' : 'flat' : '';
                    return (
                      <button
                        type="button"
                        key={dateStr}
                        className={`review-calendar-day ${tone} ${selected ? 'selected' : ''}`}
                        onClick={() => { setDashboardSelectedDate(dateStr); setDashboardTradePage(1); }}
                        aria-pressed={selected}
                        aria-label={`${dateStr}${dayData ? `, ${dayData.totalR >= 0 ? 'plus ' : 'minus '}${Math.abs(dayData.totalR).toFixed(1)} R, ${dayData.trades.length} trades` : ', no logged trades'}`}
                      >
                        <span>{dayNum}</span>
                        {dayData && <small>{dayData.totalR >= 0 ? '+' : ''}{dayData.totalR.toFixed(1)}R</small>}
                      </button>
                    );
                  })}
                </div>
                <div className="review-calendar-legend"><span><i className="profit-dot" /> Profitable</span><span><i className="loss-dot" /> Losing</span></div>
              </section>

              <section className="panel-card journal-day-review-panel">
                <div className="panel-header space-between">
                  <div>
                    <h3>{new Date(`${dashboardReviewDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                    <p className="panel-sub">{dashboardReviewTrades.length} trade{dashboardReviewTrades.length === 1 ? '' : 's'}</p>
                  </div>
                  <strong className={`day-review-total ${dashboardReviewTrades.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0) >= 0 ? 'text-green' : 'text-red'}`}>
                    {dashboardReviewTrades.length ? `${dashboardReviewTrades.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0) >= 0 ? '+' : ''}${dashboardReviewTrades.reduce((sum, trade) => sum + (parseFloat(trade.resultR) || 0), 0).toFixed(1)}R` : '—'}
                  </strong>
                </div>
                {dashboardReviewTrades.length > 0 ? (
                  <>
                  <div className="journal-day-trade-list">
                    {paginatedDashboardTrades.map((trade) => (
                      <div className="journal-day-trade" key={trade.id}>
                        <span className="instrument-badge">{trade.instrument}</span>
                        <div className="journal-day-trade-info">
                          <strong>{trade.setup || 'Trade entry'}</strong>
                          <small>{trade.time || 'Time not set'}{(trade.mistakes || []).length ? ` · ${(trade.mistakes || []).join(', ')}` : ''}</small>
                          {(safeExternalUrl(trade.plannedTradingViewUrl) || safeExternalUrl(trade.tradingViewUrl)) && (
                            <div className="journal-day-trade-links">
                              {safeExternalUrl(trade.plannedTradingViewUrl) && <a href={safeExternalUrl(trade.plannedTradingViewUrl)} target="_blank" rel="noopener noreferrer">Plan chart ↗</a>}
                              {safeExternalUrl(trade.tradingViewUrl) && <a href={safeExternalUrl(trade.tradingViewUrl)} target="_blank" rel="noopener noreferrer">Trade chart ↗</a>}
                            </div>
                          )}
                        </div>
                        <strong className={parseFloat(trade.resultR) >= 0 ? 'text-green' : 'text-red'}>{parseFloat(trade.resultR) >= 0 ? '+' : ''}{(parseFloat(trade.resultR) || 0).toFixed(1)}R</strong>
                        <div className="journal-day-trade-actions">
                          <button type="button" className="action-btn icon-btn" onClick={() => setSelectedTradeDetails(trade)} aria-label={`View ${trade.instrument} trade details`} title="View trade details">👁️</button>
                          <button type="button" className="action-btn edit-btn" onClick={() => handleEditTrade(trade)} aria-label={`Edit ${trade.instrument} trade`} title="Edit trade">✏️</button>
                          <button type="button" className="action-btn delete-btn" onClick={() => handleDeleteTrade(trade.id)} aria-label={`Delete ${trade.instrument} trade`} title="Delete trade">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {dashboardReviewTrades.length > dailyTradesPerPage && (
                    <div className="trades-pagination day-trades-pagination" aria-label="Daily trade pages">
                      <span>Page {currentDashboardTradePage} of {dashboardTradePages} · {dashboardReviewTrades.length} trades</span>
                      <div>
                        <button className="cal-btn" type="button" disabled={currentDashboardTradePage <= 1} onClick={() => setDashboardTradePage((page) => Math.max(1, page - 1))}>← Previous</button>
                        <button className="cal-btn" type="button" disabled={currentDashboardTradePage >= dashboardTradePages} onClick={() => setDashboardTradePage((page) => Math.min(dashboardTradePages, page + 1))}>Next →</button>
                      </div>
                    </div>
                  )}
                  </>
                ) : (
                  <>
                    <div className="journal-empty-day">No trades logged for this date.</div>
                    {dashboardReviewDate === todayKey && (
                      <button
                        type="button"
                        className={`no-setup-review ${noSetupReviewedForCalendarDate ? 'selected' : ''}`}
                        aria-pressed={noSetupReviewedForCalendarDate}
                        onClick={() => handleNoSetupReviewToggle(todayKey)}
                      >
                        <span className="no-setup-review-check" aria-hidden="true">✓</span>
                        <span className="no-setup-review-copy">
                          <strong>{noSetupReviewedForCalendarDate ? 'Reviewed: no valid setup' : 'Mark today reviewed · no valid setup'}</strong>
                          <small>This confirms you checked the market and chose not to force a trade.</small>
                        </span>
                      </button>
                    )}
                  </>
                )}
                <button className="cal-btn journal-add-day-trade" onClick={() => handleAddTradeOnDate(dashboardReviewDate)}>＋ Add trade for this date</button>
              </section>
            </div>

            <section className="journal-habits-section">
              <div className="analytics-section-title">Daily habits · {monthNames[month]}</div>
              <div className="journal-habits-grid">
                <div className="panel-card journal-habit-card">
                  <span className="stat-label">MOST COMMON MISTAKE</span>
                  {dashboardMistakeSummary[0] ? (
                    <>
                      <strong>{dashboardMistakeSummary[0].tag}</strong>
                      <span>{dashboardMistakeSummary[0].count} trades · {dashboardMistakeSummary[0].avgR >= 0 ? '+' : ''}{dashboardMistakeSummary[0].avgR.toFixed(2)}R average</span>
                    </>
                  ) : <span>No mistake tags recorded this month.</span>}
                </div>
                <div className="panel-card journal-habit-card">
                  <span className="stat-label">STRONGEST MINDSET TAG</span>
                  {dashboardMindsetSummary[0] ? (
                    <>
                      <strong>{dashboardMindsetSummary[0].label}</strong>
                      <span>{dashboardMindsetSummary[0].count} trades · {dashboardMindsetSummary[0].avgR >= 0 ? '+' : ''}{dashboardMindsetSummary[0].avgR.toFixed(2)}R average</span>
                    </>
                  ) : <span>No psychology tags recorded this month.</span>}
                </div>
              </div>
            </section>

          </>
        )}

        {/* TRADES TAB */}
        {activeTab === 'trades' && (
          <div className="panel-card">
            <section className="trade-lab-explore">
              <div className="trade-lab-section-heading">
                <div><h3>Explore results</h3><p className="panel-sub">Filter the active profile to compare your trading performance.</p></div>
                <span className="trade-lab-count">{currentProfileObj.name} · {filteredTrades.length} matching trades</span>
              </div>
              <div className="trade-lab-filters" aria-label="Performance filters">
                <label><span>Instrument</span><select value={tradeFilters.instrument} onChange={(e) => { setTradeFilters({ ...tradeFilters, instrument: e.target.value }); setTradePage(1); }}><option value="all">All instruments</option>{tradeInstrumentOptions.map((instrument) => <option key={instrument} value={instrument}>{instrument}</option>)}</select></label>
                <label><span>Direction</span><select value={tradeFilters.direction} onChange={(e) => { setTradeFilters({ ...tradeFilters, direction: e.target.value }); setTradePage(1); }}><option value="all">Long and short</option><option value="Long">Long</option><option value="Short">Short</option></select></label>
                <label><span>Entry time</span><select value={tradeFilters.timeOfDay} onChange={(e) => { setTradeFilters({ ...tradeFilters, timeOfDay: e.target.value }); setTradePage(1); }}><option value="all">All entry times</option><option value="00-06">00:00–05:59</option><option value="06-12">06:00–11:59</option><option value="12-18">12:00–17:59</option><option value="18-24">18:00–23:59</option></select></label>
                <label><span>Date range</span><select value={tradeFilters.period} onChange={(e) => { setTradeFilters({ ...tradeFilters, period: e.target.value }); setTradePage(1); }}><option value="all">All time</option><option value="month">This month</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select></label>
              </div>
            </section>

            <div className="trade-lab-stats">
              <div className="stat-card"><span className="stat-label">MATCHING TRADES</span><div className="stat-value text-white">{filteredTrades.length}</div><span className="stat-sub">With current filters</span></div>
              <div className="stat-card"><span className="stat-label">WIN RATE</span><div className="stat-value text-white">{labWinRate}%</div><span className="stat-sub">{labWins.length} wins · {labLosses.length} losses</span></div>
              <div className="stat-card"><span className="stat-label">NET RESULT</span><div className={`stat-value ${labNetR >= 0 ? 'text-green' : 'text-red'}`}>{labNetR >= 0 ? '+' : ''}{labNetR.toFixed(1)}R</div><span className="stat-sub">Across matching trades</span></div>
              <div className="stat-card"><span className="stat-label">EXPECTANCY</span><div className={`stat-value ${labExpectancy >= 0 ? 'text-green' : 'text-red'}`}>{labExpectancy >= 0 ? '+' : ''}{labExpectancy.toFixed(2)}R</div><span className="stat-sub">Profit factor {labProfitFactor}</span></div>
            </div>

            <div className="trade-lab-chart-grid">
              <section className="panel-card trade-lab-chart-card">
                <div className="panel-header space-between"><div><h3>Results by instrument</h3><p className="panel-sub">Net R · filtered trades</p></div><span className="trade-lab-count">{labInstrumentStats.length} assets</span></div>
                {labInstrumentStats.length ? <div className="trade-lab-instrument-list">{labInstrumentStats.map((item) => <div className="trade-lab-instrument-row" key={item.symbol}><strong>{item.symbol}</strong><div className="trade-lab-track"><div className={`trade-lab-fill ${item.netR < 0 ? 'negative' : ''}`} style={{ width: `${Math.max(3, Math.abs(item.netR) / labMaxInstrumentR * 100)}%` }} /></div><b className={item.netR >= 0 ? 'text-green' : 'text-red'}>{item.netR >= 0 ? '+' : ''}{item.netR.toFixed(1)}R</b><small>{item.count}</small></div>)}</div> : <p className="trade-lab-empty">No trades match these filters.</p>}
              </section>
              <section className="panel-card trade-lab-chart-card">
                <div className="panel-header"><h3>Trade results</h3><p className="panel-sub">R per trade · chronological</p></div>
                {labChartTrades.length ? <div className="trade-lab-bars" role="img" aria-label="Chronological results for matching trades">{labChartTrades.map((trade, index) => { const result = parseFloat(trade.resultR) || 0; return <span key={trade.id} className={`trade-lab-bar ${result < 0 ? 'negative' : ''}`} style={{ height: `${Math.max(5, Math.abs(result) / labChartMaxR * 100)}%` }} title={`${trade.date} · ${trade.instrument} · ${result >= 0 ? '+' : ''}${result.toFixed(1)}R`}><i>{index + 1}</i></span>; })}</div> : <p className="trade-lab-empty">Log trades in this profile to see results.</p>}
                {labChartTrades.length > 0 && <div className="trade-lab-chart-caption"><span>Trade 1</span><span>Trade number →</span><span>Trade {labChartTrades.length}</span></div>}
              </section>
            </div>

            <div className="trades-tab-header">
              <div>
                <h3>Recent matching trades</h3>
                <p className="panel-sub">Showing {filteredTrades.length} of {trades.length} logged trades · Total logged costs: ${totalLoggedTradeCosts.toFixed(2)}</p>
              </div>
              <div className="trade-data-actions">
                <button type="button" className="cal-btn" onClick={() => exportJournal('csv')} disabled={!trades.length}>Export CSV</button>
                <button type="button" className="cal-btn" onClick={() => exportJournal('json')} disabled={!trades.length}>Backup JSON</button>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search assets, dates, results, setups, notes... ( / )"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setTradePage(1); }}
                className="trades-search-input"
              />
            </div>

            <details className="trade-extra-filters">
              <summary>More filters <span>Psychology and mistake tags</span></summary>
              <div className="trade-filter-bar" aria-label="Additional trade filters">
                <label>
                  <span>Psychology</span>
                  <select value={tradeFilters.psychology} onChange={(e) => { setTradeFilters({ ...tradeFilters, psychology: e.target.value }); setTradePage(1); }}>
                    <option value="all">All psychology tags</option>
                    {tradePsychologyOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </label>
                <label>
                  <span>Mistake tag</span>
                  <select value={tradeFilters.mistake} onChange={(e) => { setTradeFilters({ ...tradeFilters, mistake: e.target.value }); setTradePage(1); }}>
                    <option value="all">All mistake tags</option>
                    {MISTAKE_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </label>
              </div>
            </details>

            <details className="mistake-performance">
              <summary>Mistake performance <span>See how trades with each mistake tag performed</span></summary>
              {mistakePerformance.length > 0 ? (
                <div className="mistake-performance-table-wrap">
                  <table className="mistake-performance-table">
                    <thead>
                      <tr><th>Mistake tag</th><th>Trades</th><th>Win rate</th><th>Net result</th><th>Average / trade</th></tr>
                    </thead>
                    <tbody>
                      {mistakePerformance.map((stat) => (
                        <tr key={stat.tag}>
                          <td>{stat.tag}</td>
                          <td>{stat.count}</td>
                          <td>{stat.winRate}%</td>
                          <td className={stat.netR >= 0 ? 'text-green' : 'text-red'}>{stat.netR >= 0 ? '+' : ''}{stat.netR.toFixed(1)}R</td>
                          <td className={stat.avgR >= 0 ? 'text-green' : 'text-red'}>{stat.avgR >= 0 ? '+' : ''}{stat.avgR.toFixed(2)}R</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="panel-sub">Each trade contributes to every mistake tag selected for it. Results use all trades in this profile.</p>
                </div>
              ) : (
                <p className="mistake-performance-empty">No mistake tags logged yet. Add tags to trades to build this report.</p>
              )}
            </details>

            <div className="full-trades-table-container">
              <table className="full-trades-table">
                <thead>
                  <tr>
                    <th>Actions</th>
                    <th>Date / Time</th>
                    <th>Pair</th>
                    <th>Dir</th>
                    <th>Setup</th>
                    <th>Plan</th>
                    <th>Actual Entry</th>
                    <th>Actual SL</th>
                    <th>Actual Exit</th>
                    <th>Result (R) / Costs</th>
                    <th>Mindset / Mistakes</th>
                    <th>Charts</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrades.map((t) => (
                    <tr
                      key={t.id}
                      className="trade-row-clickable"
                      tabIndex={0}
                      onClick={(event) => {
                        if (!event.target.closest('button, a')) setSelectedTradeDetails(t);
                      }}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          setSelectedTradeDetails(t);
                        }
                      }}
                      aria-label={`Open ${t.instrument || 'trade'} details`}
                    >
                      <td>
                        <div className="trade-actions">
                          <button
                            className="action-btn icon-btn"
                            onClick={() => setSelectedTradeDetails(t)}
                            title="View trade details"
                            aria-label={`View ${t.instrument || 'trade'} details`}
                          >
                            👁️
                          </button>
                          <button
                            className="action-btn edit-btn"
                            onClick={() => handleEditTrade(t)}
                            title="Edit trade"
                            aria-label={`Edit ${t.instrument || 'trade'}`}
                          >
                            ✏️
                          </button>
                          <button
                            className="action-btn delete-btn"
                            onClick={() => handleDeleteTrade(t.id)}
                            title="Delete trade"
                            aria-label={`Delete ${t.instrument || 'trade'}`}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                      <td className="text-muted">
                        {t.date} <br />
                        <span className="text-xs">{t.time}</span>
                      </td>
                      <td>
                        <span className="instrument-badge">{t.instrument}</span>
                      </td>
                      <td className={t.direction === 'Long' ? 'text-green' : 'text-red'}>
                        {t.direction}
                      </td>
                      <td>{t.setup}</td>
                      <td className="trade-plan-cell">
                        {t.plannedEntry || t.plannedStopLoss || t.plannedTakeProfit ? (
                          <>
                            <span>E: {t.plannedEntry || '—'}</span>
                            <span>SL: {t.plannedStopLoss || '—'}</span>
                            <span>TP: {t.plannedTakeProfit || '—'}</span>
                          </>
                        ) : '-'}
                      </td>
                      <td>{t.entry || '-'}</td>
                      <td>{t.stopLoss || '-'}</td>
                      <td>{t.exit || '-'}</td>
                      <td className={`font-bold ${t.resultR >= 0 ? 'text-green' : 'text-red'}`}>
                        <span>{t.resultR >= 0 ? `+${t.resultR}R` : `${t.resultR}R`}</span>
                        {getTradeCosts(t) > 0 && <small className="trade-cost-meta">Cost ${getTradeCosts(t).toFixed(2)}</small>}
                      </td>
                      <td>
                        <div className="trade-tags">
                          {t.psychology &&
                            t.psychology.map((tag) => (
                              <span key={tag} className="tag-badge">
                                {tag}
                              </span>
                            ))}
                          {(t.mistakes || []).map((tag) => (
                            <span key={`mistake-${tag}`} className="tag-badge mistake-tag-badge">! {tag}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="trade-actions">
                          {safeExternalUrl(t.plannedTradingViewUrl) && (
                            <a className="tradingview-table-link" href={safeExternalUrl(t.plannedTradingViewUrl)} target="_blank" rel="noopener noreferrer" title="Open pre-trade TradingView chart">Plan ↗</a>
                          )}
                          {t.plannedScreenshotUrl && (
                            <button className="action-btn icon-btn" onClick={() => setPreviewImage(t.plannedScreenshotUrl)} title="View pre-trade plan chart" aria-label="View pre-trade plan chart">📋</button>
                          )}
                          {safeExternalUrl(t.tradingViewUrl) && (
                            <a className="tradingview-table-link" href={safeExternalUrl(t.tradingViewUrl)} target="_blank" rel="noopener noreferrer" title="Open executed trade TradingView chart">Trade ↗</a>
                          )}
                          {t.screenshotUrl && (
                            <button className="action-btn icon-btn" onClick={() => setPreviewImage(t.screenshotUrl)} title="View after-trade chart" aria-label="View after-trade chart">🖼️</button>
                          )}
                          {!t.plannedTradingViewUrl && !t.tradingViewUrl && !t.plannedScreenshotUrl && !t.screenshotUrl && '-'}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTrades.length === 0 && (
                    <tr>
                      <td colSpan="12" className="text-center py-6 text-muted">
                        No trades match these search and filter settings.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="trades-pagination">
              <span>Page {currentTradePage} of {totalTradePages} · {tradesPerPage} trades per page</span>
              <div>
                <button className="cal-btn" type="button" disabled={currentTradePage <= 1} onClick={() => setTradePage((page) => Math.max(1, page - 1))}>← Previous</button>
                <button className="cal-btn" type="button" disabled={currentTradePage >= totalTradePages} onClick={() => setTradePage((page) => Math.min(totalTradePages, page + 1))}>Next →</button>
              </div>
            </div>
          </div>
        )}

        {/* TOP DOWN ANALYSIS TAB */}
        {activeTab === 'topdown' && (
          <div className="top-down-page">
            <section className="panel-card top-down-intro">
              <div>
                <h3>Your Analysis Cards</h3>
                <p className="panel-sub">Save a dated market view with your own timeframe, chart screenshot, links, and description. Cards are saved for this profile in this browser.</p>
              </div>
              <div className="top-down-create-controls">
                <label className="top-down-create-date">
                  <span>Date</span>
                  <input type="date" value={topDownSelectedDate} onChange={(event) => setTopDownSelectedDate(event.target.value)} aria-label="Choose analysis card date" />
                </label>
                <button className="btn-primary" type="button" onClick={() => openTopDownCardForm()}>＋ Create analysis card</button>
              </div>
            </section>
            {topDownStorageError && <p className="top-down-error" role="alert">{topDownStorageError}</p>}
            {topDownCards.length ? (
              <div className="top-down-card-list">
                {topDownCards.map((card) => (
                  <article className="panel-card top-down-analysis-card" key={card.id}>
                    <div className="top-down-analysis-header">
                      <div className="top-down-analysis-meta">
                        <span className="top-down-timeframe-badge">{card.timeframe || 'Custom timeframe'}</span>
                        <time dateTime={card.date}>{card.date ? new Date(`${card.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : 'Date not set'}</time>
                      </div>
                      <div className="top-down-card-actions">
                        <button className="action-btn icon-btn" type="button" onClick={() => openTopDownCardForm(card)} aria-label={`Edit ${card.title || 'analysis card'}`} title="Edit card">✏️</button>
                        <button className="action-btn icon-btn" type="button" onClick={() => deleteTopDownCard(card.id)} aria-label={`Delete ${card.title || 'analysis card'}`} title="Delete card">🗑️</button>
                      </div>
                    </div>
                    <h3>{card.title || card.timeframe || 'Analysis card'}</h3>
                    {card.description && <p className="top-down-card-description">{card.description}</p>}
                    {card.imageData && <button className="top-down-card-image" type="button" onClick={() => setPreviewImage(card.imageData)} title="View full screenshot"><img src={card.imageData} alt={`${card.title || card.timeframe} chart screenshot`} /></button>}
                    <div className="top-down-card-links">
                      {safeExternalUrl(card.tradingViewUrl) && <a className="cal-btn" href={safeExternalUrl(card.tradingViewUrl)} target="_blank" rel="noopener noreferrer">Open TradingView ↗</a>}
                      {safeExternalUrl(card.referenceUrl) && <a className="cal-btn" href={safeExternalUrl(card.referenceUrl)} target="_blank" rel="noopener noreferrer">Open reference ↗</a>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <section className="panel-card top-down-empty-state">
                <span aria-hidden="true">🗂️</span>
                <h3>No analysis cards yet</h3>
                <p className="panel-sub">Choose a date above and create your first card. Add any timeframe, chart screenshot, links, and a description.</p>
                <button className="btn-primary" type="button" onClick={() => openTopDownCardForm()}>＋ Create analysis card</button>
              </section>
            )}
          </div>
        )}

        {/* MONTE CARLO TAB */}
        {activeTab === 'simulator' && (
          <div className="panel-card">
            <div className="panel-header space-between mc-page-header">
              <div>
                <h3>Prop Firm Challenge & Funded Simulator</h3>
                <p className="panel-sub">
                  Simulate challenge pass rates, blown accounts, and net profit projections through 10 years
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={runAdvancedMonteCarlo}
                disabled={mcSource === 'journal' && (!isProfileDataReady || trades.length === 0)}
              >
                {mcSource === 'journal' && !isProfileDataReady
                  ? 'Loading profile trades…'
                  : mcSource === 'journal' && trades.length === 0
                    ? 'Log trades to run Monte Carlo'
                    : '⚡ Run Monte Carlo (500 Sims)'}
              </button>
            </div>

            <div className="mc-source-box mb-6">
              <span className="form-label mr-4">Trading Profile Data Source:</span>
              <label className="mr-4">
                <input
                  type="radio"
                  name="mcSource"
                  value="journal"
                  checked={mcSource === 'journal'}
                  onChange={() => setMcSource('journal')}
                />{' '}
                {isProfileDataReady
                  ? `Import Logged Data from "${currentProfileObj.name}" (Win Rate: ${winRate}%, Avg Win: +${avgWinR}R, Avg Loss: ${avgLossR}R)`
                  : `Loading logged trades for "${currentProfileObj.name}"…`}
              </label>
              <label>
                <input
                  type="radio"
                  name="mcSource"
                  value="custom"
                  checked={mcSource === 'custom'}
                  onChange={() => setMcSource('custom')}
                />{' '}
                Create Custom Trading Profile
              </label>

              {mcSource === 'journal' && isProfileDataReady && trades.length === 0 && (
                <p className="panel-sub text-amber mt-4">
                  No trades are logged for “{currentProfileObj.name}”. Net profit is $0 because there is no journal data to simulate. Add trades or select a custom profile to run Monte Carlo.
                </p>
              )}

              {mcSource === 'custom' && (
                <div className="form-row mt-4">
                  <div className="form-group">
                    <label>Win Rate (%)</label>
                    <input
                      type="number"
                      value={mcCustomProfile.winRate}
                      onChange={(e) => setMcCustomProfile({ ...mcCustomProfile, winRate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Avg Win (R)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={mcCustomProfile.avgWinR}
                      onChange={(e) => setMcCustomProfile({ ...mcCustomProfile, avgWinR: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Avg Loss (R)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={mcCustomProfile.avgLossR}
                      onChange={(e) => setMcCustomProfile({ ...mcCustomProfile, avgLossR: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Trades / Day</label>
                    <input
                      type="number"
                      value={mcCustomProfile.tradesPerDay}
                      onChange={(e) => setMcCustomProfile({ ...mcCustomProfile, tradesPerDay: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mc-settings-grid mb-6">
              <div className="mc-setting-card">
                <h4 className="setting-header">1. Account Setup</h4>
                <div className="form-group mb-2">
                  <label>Account Cost ($)</label>
                  <input
                    type="number"
                    value={mcParams.accountCost}
                    onChange={(e) => setMcParams({ ...mcParams, accountCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group mb-2">
                  <label>Account Size ($)</label>
                  <input
                    type="number"
                    value={mcParams.accountSize}
                    onChange={(e) => setMcParams({ ...mcParams, accountSize: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group mb-2">
                  <label>Risk Per Trade (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mcParams.riskPerTradePct}
                    onChange={(e) => setMcParams({ ...mcParams, riskPerTradePct: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group mb-2">
                  <label className="mc-toggle-label">
                    <input
                      type="checkbox"
                      checked={mcParams.executionCostsEnabled}
                      onChange={(e) => setMcParams({ ...mcParams, executionCostsEnabled: e.target.checked })}
                    />
                    Include execution costs
                  </label>
                </div>
                {mcParams.executionCostsEnabled && (
                  <>
                    <div className="form-row mb-2">
                      <div className="form-group">
                        <label>Slippage ($ / trade)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={mcParams.slippageCostPerTrade}
                          onChange={(e) => setMcParams({ ...mcParams, slippageCostPerTrade: Math.max(0, parseFloat(e.target.value) || 0) })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Commission ($ / trade)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={mcParams.commissionCostPerTrade}
                          onChange={(e) => setMcParams({ ...mcParams, commissionCostPerTrade: Math.max(0, parseFloat(e.target.value) || 0) })}
                        />
                      </div>
                    </div>
                    <div className="form-group mb-2">
                      <label>Spread cost ($ / trade)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={mcParams.spreadCostPerTrade}
                        onChange={(e) => setMcParams({ ...mcParams, spreadCostPerTrade: Math.max(0, parseFloat(e.target.value) || 0) })}
                      />
                    </div>
                    <span className="stat-sub mb-2">Costs are dollar amounts per completed trade and reduce each simulated result.</span>
                  </>
                )}
                <div className="form-group mb-2">
                  <label>Drawdown Type</label>
                  <select
                    value={mcParams.drawdownType}
                    onChange={(e) => setMcParams({ ...mcParams, drawdownType: e.target.value })}
                  >
                    <option value="static">Static Balance Drawdown</option>
                    <option value="trailing">End-of-Day Trailing Drawdown</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Total Max DD (%)</label>
                    <input
                      type="number"
                      value={mcParams.totalMaxDDPct}
                      onChange={(e) => setMcParams({ ...mcParams, totalMaxDDPct: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Daily Max DD (%)</label>
                    <input
                      type="number"
                      value={mcParams.dailyMaxDDPct}
                      onChange={(e) => setMcParams({ ...mcParams, dailyMaxDDPct: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              <div className="mc-setting-card">
                <h4 className="setting-header">2. Challenge Rules</h4>
                <div className="form-group mb-2">
                  <label>Pass Structure</label>
                  <select
                    value={mcParams.passStructure}
                    onChange={(e) => setMcParams({ ...mcParams, passStructure: e.target.value })}
                  >
                    <option value="two_step">2-Step Challenge</option>
                    <option value="one_step">1-Step Challenge</option>
                    <option value="three_step">3-Step Challenge</option>
                    <option value="instant">Instant Funding (No Eval)</option>
                  </select>
                </div>
                {mcParams.passStructure !== 'instant' && (
                  <>
                    <div className="form-row mb-2">
                      <div className="form-group">
                        <label>Phase 1 Target (%)</label>
                        <input
                          type="number"
                          value={mcParams.p1TargetPct}
                          onChange={(e) => setMcParams({ ...mcParams, p1TargetPct: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      {(mcParams.passStructure === 'two_step' || mcParams.passStructure === 'three_step') && (
                        <div className="form-group">
                          <label>Phase 2 Target (%)</label>
                          <input
                            type="number"
                            value={mcParams.p2TargetPct}
                            onChange={(e) => setMcParams({ ...mcParams, p2TargetPct: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      )}
                    </div>
                    {mcParams.passStructure === 'three_step' && (
                      <div className="form-group mb-2">
                        <label>Phase 3 Target (%)</label>
                        <input
                          type="number"
                          min="0"
                          value={mcParams.p3TargetPct}
                          onChange={(e) => setMcParams({ ...mcParams, p3TargetPct: Math.max(0, parseFloat(e.target.value) || 0) })}
                        />
                      </div>
                    )}
                    <div className="form-group mb-2">
                      <label>Min Trading Days</label>
                      <input
                        type="number"
                        value={mcParams.minTradingDays}
                        onChange={(e) => setMcParams({ ...mcParams, minTradingDays: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="form-group mb-2">
                      <label className="mc-toggle-label">
                        <input
                          type="checkbox"
                          checked={mcParams.evalConsistencyEnabled}
                          onChange={(e) => setMcParams({ ...mcParams, evalConsistencyEnabled: e.target.checked })}
                        />
                        Apply challenge consistency rule
                      </label>
                    </div>
                    {mcParams.evalConsistencyEnabled && (
                      <div className="form-group mb-2">
                        <label>Max single-day profit (% of phase profit)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={mcParams.evalConsistencyPct}
                          onChange={(e) => setMcParams({ ...mcParams, evalConsistencyPct: Math.min(100, Math.max(1, parseFloat(e.target.value) || 1)) })}
                        />
                        <span className="stat-sub">Largest winning day must be at or below this share of total phase profit.</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="mc-setting-card">
                <h4 className="setting-header">3. Funded & Payout Rules</h4>
                <div className="form-group mb-2">
                  <label>Funded Profit Target (%) [0 = None]</label>
                  <input
                    type="number"
                    placeholder="0 if no profit target required"
                    value={mcParams.fundedTargetPct}
                    onChange={(e) => setMcParams({ ...mcParams, fundedTargetPct: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group mb-2">
                  <label className="mc-toggle-label">
                    <input
                      type="checkbox"
                      checked={mcParams.fundedConsistencyEnabled}
                      onChange={(e) => setMcParams({ ...mcParams, fundedConsistencyEnabled: e.target.checked })}
                    />
                    Apply funded consistency rule
                  </label>
                </div>
                {mcParams.fundedConsistencyEnabled && (
                  <div className="form-group mb-2">
                    <label>Max single-day profit (% of funded profit)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={mcParams.fundedConsistencyPct}
                      onChange={(e) => setMcParams({ ...mcParams, fundedConsistencyPct: Math.min(100, Math.max(1, parseFloat(e.target.value) || 1)) })}
                    />
                    <span className="stat-sub">Largest winning day must be at or below this share before a payout.</span>
                  </div>
                )}
                <div className="form-row mb-2">
                  <div className="form-group">
                    <label>Payout Split (%)</label>
                    <input
                      type="number"
                      value={mcParams.payoutSplitPct}
                      onChange={(e) => setMcParams({ ...mcParams, payoutSplitPct: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Min Days to Payout</label>
                    <input
                      type="number"
                      value={mcParams.minDaysToPayout}
                      onChange={(e) => setMcParams({ ...mcParams, minDaysToPayout: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {mcResults && (
              <>
                <div className="analytics-section-title">Challenge Odds & Timeline Metrics</div>
                <div className="stats-grid mb-6">
                  <div className="stat-card border-green-glow">
                    <span className="stat-label">PASS RATE</span>
                    <div className="stat-value text-green">{mcResults.passRate}%</div>
                    <span className="stat-sub">Probability of passing challenge</span>
                  </div>

                  <div className="stat-card border-red-glow">
                    <span className="stat-label">BLOWN ACCOUNTS</span>
                    <div className="stat-value text-red">{mcResults.blownCount} / {mcParams.numSimulations}</div>
                    <span className="stat-sub">Accounts breached DD limits</span>
                  </div>

                  <div className="stat-card">
                    <span className="stat-label">AVG DAYS TO PASS</span>
                    <div className="stat-value text-white">{mcResults.avgDaysToPass} Days</div>
                    <span className="stat-sub">Evaluation duration</span>
                  </div>

                  <div className="stat-card">
                    <span className="stat-label">DAYS TO FIRST PAYOUT</span>
                    <div className="stat-value text-green">{mcResults.avgDaysToPayout} Days</div>
                    <span className="stat-sub">From day 1 to first check</span>
                  </div>
                </div>

                <div className="analytics-section-title">Average Net Profit by Time Horizon</div>
                <p className="panel-sub mb-4">Average realized payouts minus the account fee, across all simulations.</p>
                <div className="mc-timeframe-grid">
                  {mcResults.timeframeSummary.map((timeframe) => (
                    <div className="stat-card" key={timeframe.label}>
                      <span className="stat-label">{timeframe.label}</span>
                      <div className={`stat-value ${timeframe.avgNetProfit >= 0 ? 'text-green' : 'text-red'}`}>
                        {timeframe.avgNetProfit < 0 ? '-$' : '$'}{Math.abs(timeframe.avgNetProfit).toLocaleString()}
                      </div>
                      <span className="stat-sub">Avg payouts: ${timeframe.avgPayout.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-page">
            <div className="settings-grid">
              <div className="settings-column">
                <section className="panel-card settings-card">
                  <div className="panel-header"><h3>Appearance</h3><p className="panel-sub">Choose the look and time zone for your journal.</p></div>
                  <div className="settings-row"><div><strong>Color theme</strong><span>Saved automatically on this device.</span></div><div className="theme-choice-group" role="group" aria-label="Color theme"><button type="button" className={`theme-choice-button ${theme === 'dark' ? 'selected' : ''}`} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><span aria-hidden="true">◐</span> Dark</button><button type="button" className={`theme-choice-button ${theme === 'light' ? 'selected' : ''}`} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><span aria-hidden="true">☼</span> Light</button></div></div>
                  <label className="journal-timezone-setting"><span><strong>Journal timezone</strong><small>Controls the journal clock and new trade times. DST updates automatically.</small></span><select value={journalTimezone} onChange={handleJournalTimezoneChange} aria-label="Journal timezone">{[...new Set([journalTimezone, ...TIME_ZONE_OPTIONS])].map((timeZone) => <option key={timeZone} value={timeZone}>{timeZone.replaceAll('_', ' ').replaceAll('/', ' / ')}</option>)}</select></label>
                  <p className="journal-timezone-status" role="status">{getUtcOffsetLabel(journalTimezone, journalClockNow)} now · {timezoneSyncMessage}</p>
                </section>
                <section className="panel-card settings-card pip-squeak-settings-card"><div className="panel-header"><h3>Pip Squeak</h3><p className="panel-sub">Choose whether your trading pal chimes in around CookurTrades.</p></div><div className="settings-row"><div><strong>Buddy messages</strong><span>Page quips, bottom pop-ups, and the rare calendar prank.</span></div><label className="pip-squeak-toggle"><input type="checkbox" checked={pipSqueakEnabled} onChange={(event) => setPipSqueakEnabled(event.target.checked)} aria-label="Enable Pip Squeak" /><span className="pip-squeak-toggle-track" aria-hidden="true"><span /></span><span className="pip-squeak-toggle-state">{pipSqueakEnabled ? 'On' : 'Off'}</span></label></div></section>
                <section className="panel-card settings-card trade-defaults-card"><div className="panel-header"><h3>Trade Defaults</h3><p className="panel-sub">Prefill new trade forms with your usual details. You can still change them per trade.</p></div><div className="trade-defaults-grid"><label><span>Default asset</span><select value={tradeDefaults.instrument} onChange={(event) => setTradeDefaults({ ...tradeDefaults, instrument: event.target.value })}>{INSTRUMENT_PRESETS.map((group) => <optgroup label={group.category} key={group.category}>{group.assets.map((asset) => <option value={asset} key={asset}>{asset}</option>)}</optgroup>)}{customAssets.length > 0 && <optgroup label="Custom assets">{customAssets.map((asset) => <option value={asset} key={asset}>{asset}</option>)}</optgroup>}</select></label><label><span>Default direction</span><select value={tradeDefaults.direction} onChange={(event) => setTradeDefaults({ ...tradeDefaults, direction: event.target.value })}><option value="Long">Long</option><option value="Short">Short</option></select></label><label><span>Default setup</span><input type="text" value={tradeDefaults.setup} onChange={(event) => setTradeDefaults({ ...tradeDefaults, setup: event.target.value })} placeholder="e.g. 15m S/R" /></label><label><span>Default risk ($)</span><input type="number" min="0" step="any" value={tradeDefaults.risk} onChange={(event) => setTradeDefaults({ ...tradeDefaults, risk: event.target.value })} placeholder="Leave blank" /></label></div></section>
                <section className="panel-card settings-card"><div className="panel-header"><h3>Account</h3><p className="panel-sub">Sign-in and cloud sync for your journal.</p></div>{session ? <><div className="settings-account-details"><span>Signed in as</span><strong>{session.user.email}</strong><span className={`cloud-sync-indicator ${cloudSyncState}`} role="status"><i aria-hidden="true" />{cloudSyncState === 'ready' ? 'Cloud synced' : cloudSyncState === 'loading' ? 'Syncing…' : cloudSyncState === 'error' ? 'Sync issue' : 'Local data'}</span></div>{cloudSyncMessage && <p className="settings-sync-message">{cloudSyncMessage}</p>}{cloudSyncReady && pendingLocalTrades.length > 0 && <button type="button" className="cloud-import-button" onClick={handleImportLocalTrades} disabled={cloudImportBusy}>{cloudImportBusy ? 'Importing…' : `Import ${pendingLocalTrades.length} local trades`}</button>}<button type="button" className="auth-header-button settings-signout-button" onClick={handleAuthSignOut}>Sign out</button></> : <div className="settings-signed-out"><p>You’re using CookurTrades on this device. Sign in to sync your journal across devices.</p><button type="button" className="auth-header-button" onClick={() => openAuthModal('signin')}>Email sign in</button></div>}</section>
                <section className="panel-card settings-card"><div className="panel-header"><h3>Journal data</h3><p className="panel-sub">Download a copy of this profile from the Trades page.</p></div><button type="button" className="cal-btn" onClick={() => setActiveTab('trades')}>Go to exports <span aria-hidden="true">→</span></button></section>
              </div>
              <div className="settings-column">
                <section className="panel-card settings-card custom-assets-card"><div className="panel-header"><h3>Custom assets</h3><p className="panel-sub">Add the symbols you trade. They’ll appear in the trade picker and Performance Lab filters.</p></div><form className="custom-asset-form" onSubmit={handleAddCustomAsset}><label className="sr-only" htmlFor="custom-asset-symbol">Custom asset symbol</label><input id="custom-asset-symbol" type="text" value={customAssetDraft} onChange={(event) => { setCustomAssetDraft(event.target.value); setCustomAssetError(''); }} placeholder="e.g. M2K, SOL/USD" maxLength={20} autoCapitalize="characters" /><button type="submit" className="cal-btn">Add asset</button></form>{customAssetError && <p className="custom-asset-error" role="alert">{customAssetError}</p>}<div className="custom-asset-list">{customAssets.length ? customAssets.map((symbol) => <div className="custom-asset-item" key={symbol}><span>{symbol}</span><button type="button" onClick={() => handleRemoveCustomAsset(symbol)} aria-label={`Remove ${symbol}`}>Remove</button></div>) : <p className="custom-asset-empty">No custom assets yet.</p>}</div></section>
                <section className="panel-card settings-card"><div className="panel-header"><h3>Keyboard shortcuts</h3><p className="panel-sub">Little time-savers for your daily flow.</p></div><div className="shortcut-list"><div className="shortcut-row"><span>Quick add a trade</span><kbd>N</kbd></div><div className="shortcut-row"><span>Open the full trade form</span><kbd>Shift + N</kbd></div><div className="shortcut-row"><span>Search your trades</span><kbd>/</kbd></div><div className="shortcut-row"><span>Close the trade form</span><kbd>Esc</kbd></div></div></section>
                <section className="panel-card settings-card"><div className="panel-header"><h3>Journal profiles</h3><p className="panel-sub">Keep personal, evaluation, and strategy journals organized.</p></div><div className="settings-row"><div><strong>{currentProfileObj.name}</strong><span>{profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} available</span></div><button type="button" className="cal-btn" onClick={() => setIsProfileModalOpen(true)}>Manage profiles</button></div></section>
                <section className="panel-card settings-card pwa-install-card"><div className="panel-header"><h3>Install CookurTrades</h3><p className="panel-sub">Keep your journal one tap away on your phone or desktop.</p></div><div className="settings-row"><div><strong>{isPwaInstalled ? 'App installed' : 'Add to your home screen'}</strong><span>Previously loaded screens can open offline; cloud sync needs internet.</span></div>{isPwaInstalled ? <span className="pwa-install-status">Installed</span> : deferredPwaInstall ? <button type="button" className="btn-primary pwa-install-button" onClick={handleInstallPwa}>Install app</button> : <span className="pwa-install-guidance">{/iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'Share → Add to Home Screen' : 'Use your browser menu → Install app'}</span>}</div></section>
              </div>
            </div>
          </div>
        )}
      </main>

      {isAuthModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAuthModalOpen(false)}>
          <section className="modal-content auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-sub">COOKURTRADES ACCOUNT</span>
                <h2 id="auth-modal-title">{authMode === 'signin' ? 'Welcome back' : authMode === 'recovery' ? 'Reset your password' : 'Create your account'}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsAuthModalOpen(false)} aria-label="Close sign-in form">✕</button>
            </div>
            <p className="panel-sub auth-intro">{authMode === 'recovery' ? 'Set a new password to get back into your journal.' : 'Sign in to access your journal and sync your trades securely.'}</p>
            {!isSupabaseConfigured && <div className="auth-config-message" role="status">Supabase needs its project URL and public anon key in the Vite build settings before sign-in can work.</div>}
            {authError && <div className="auth-feedback error" role="alert">{authError}</div>}
            {authNotice && <div className="auth-feedback notice" role="status">{authNotice}</div>}

            {authMode === 'recovery' ? (
              <button type="button" className="auth-text-button auth-back-link" onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthNotice(''); }}>Back to sign in</button>
            ) : (
              <div className="auth-mode-switch" role="tablist" aria-label="Account action">
                <button type="button" role="tab" aria-selected={authMode === 'signin'} className={authMode === 'signin' ? 'active' : ''} onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthNotice(''); }}>Sign in</button>
                <button type="button" role="tab" aria-selected={authMode === 'signup'} className={authMode === 'signup' ? 'active' : ''} onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthNotice(''); }}>Create account</button>
              </div>
            )}

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode !== 'recovery' && <div className="form-group">
                <label htmlFor="auth-email">Email</label>
                <input id="auth-email" type="email" autoComplete="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" />
              </div>}
              <div className="form-group">
                <label htmlFor="auth-password">{authMode === 'recovery' ? 'New password' : 'Password'}</label>
                <input id="auth-password" type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder={authMode === 'signin' ? 'Enter your password' : 'At least 6 characters'} />
              </div>
              {authMode === 'signin' && <button type="button" className="auth-text-button" onClick={handlePasswordResetRequest} disabled={authBusy || !isSupabaseConfigured}>Forgot password?</button>}
              <button className="btn-primary auth-submit" type="submit" disabled={authBusy || !isSupabaseConfigured}>
                {authBusy ? 'Please wait…' : authMode === 'recovery' ? 'Save new password' : authMode === 'signin' ? 'Sign in with email' : 'Create account'}
              </button>
            </form>

            {authMode === 'signup' && <p className="auth-confirmation-note">If email confirmation is enabled in Supabase, we’ll ask you to confirm your address before signing in.</p>}
          </section>
        </div>
      )}

      {/* DAILY CALENDAR DETAILS */}
      {selectedDayTrades && (
        <div className="modal-overlay" onClick={() => setSelectedDayTrades(null)}>
          <div className="modal-content calendar-day-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-sub">DAILY TRADES · {currentProfileObj.name}</span>
                <h2>
                  {new Date(`${selectedDayTrades.dateStr}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </h2>
              </div>
              <button className="close-btn" onClick={() => setSelectedDayTrades(null)} aria-label="Close daily trades">
                ✕
              </button>
            </div>

            {selectedDayTradeList.length > 0 ? (
              <>
              <div className="trades-list mb-6">
                {paginatedSelectedDayTrades.map((trade) => (
                  <div className="trade-row calendar-trade-row" key={trade.id}>
                    <span className="instrument-badge">{trade.instrument}</span>
                    <div className="trade-info">
                      <div className="trade-title">{trade.setup || 'Trade entry'}</div>
                      <div className="trade-meta">{trade.time || 'Time not set'}{trade.notes ? ` · ${trade.notes}` : ''}</div>
                    </div>
                    <span className={`trade-result ${trade.resultR >= 0 ? 'text-green' : 'text-red'}`}>
                      {trade.resultR >= 0 ? '+' : ''}{Number(trade.resultR || 0).toFixed(1)}R
                    </span>
                    <div className="trade-actions calendar-trade-actions">
                      <button className="action-btn icon-btn" onClick={() => setSelectedTradeDetails(trade)} aria-label={`View ${trade.instrument} trade details`} title="View trade details">
                        👁️
                      </button>
                      <button className="action-btn" onClick={() => handleEditTrade(trade)} aria-label={`Edit ${trade.instrument} trade`} title="Edit trade">
                        ✏️
                      </button>
                      <button className="action-btn" onClick={() => handleDeleteTrade(trade.id)} aria-label={`Delete ${trade.instrument} trade`} title="Delete trade">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {selectedDayTradeList.length > dailyTradesPerPage && (
                <div className="trades-pagination day-trades-pagination" aria-label="Daily trade pages">
                  <span>Page {currentSelectedDayTradePage} of {selectedDayTradePages} · {selectedDayTradeList.length} trades</span>
                  <div>
                    <button className="cal-btn" type="button" disabled={currentSelectedDayTradePage <= 1} onClick={() => setSelectedDayTradePage((page) => Math.max(1, page - 1))}>← Previous</button>
                    <button className="cal-btn" type="button" disabled={currentSelectedDayTradePage >= selectedDayTradePages} onClick={() => setSelectedDayTradePage((page) => Math.min(selectedDayTradePages, page + 1))}>Next →</button>
                  </div>
                </div>
              )}
              </>
            ) : (
              <p className="panel-sub mb-6">No trades logged for this date.</p>
            )}

            <button className="btn-primary" onClick={() => handleAddTradeOnDate(selectedDayTrades.dateStr)}>
              + Add trade for this date
            </button>
          </div>
        </div>
      )}

      {/* MANAGE PROFILES MODAL */}
      {isProfileModalOpen && (
        <div className="modal-overlay" onClick={() => setIsProfileModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-sub">PROFILE MANAGEMENT</span>
                <h2>Journal Profiles</h2>
              </div>
              <button className="close-btn" onClick={() => setIsProfileModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="modal-form mb-6">
              <div className="form-group">
                <label>Create New Journal Profile</label>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="e.g. 50K Prop Evaluation, Crypto Scalping..."
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary">
                    + Create
                  </button>
                </div>
              </div>
            </form>

            <div className="analytics-section-title">Existing Profiles</div>
            <div className="trades-list">
              {profiles.map((p) => (
                <div key={p.id} className="trade-row">
                  <div className="trade-info">
                    <div className="trade-title">{p.name}</div>
                    <div className="trade-meta">
                      {p.id === activeProfileId ? '(Currently Active)' : ''}
                    </div>
                  </div>
                  {p.id !== activeProfileId && (
                    <button
                      className="cal-btn mr-2"
                      onClick={() => switchActiveProfile(p.id)}
                    >
                      Switch
                    </button>
                  )}
                  {profiles.length > 1 && (
                    <button
                      className="action-btn delete-btn"
                      onClick={() => handleDeleteProfile(p.id)}
                      title="Delete profile"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT TRADE MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-sub">{formData.id ? 'EDIT ENTRY' : 'NEW ENTRY'} · {currentProfileObj.name}</span>
                <h2>{formData.id ? 'Edit trade' : 'Add trade'}</h2>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            {hasRestoredTradeDraft && !formData.id && (
              <div className="draft-restored-note" role="status">Draft restored — your unfinished entry is back.</div>
            )}
            {quickAddMode && !formData.id ? (
              <form onSubmit={handleSubmit} onChange={() => setTradeFormTouched(true)} className="modal-form quick-trade-form">
                <div className="form-row">
                  <div className="form-group"><label>Date · {getTimeZoneCity(journalTimezone)}</label><input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value, timeZone: journalTimezone, _timestampChanged: true })} /></div>
                  <div className="form-group"><label>Time · {getTimeZoneCity(journalTimezone)}</label><input type="time" required value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value, timeZone: journalTimezone, _timestampChanged: true })} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Asset</label><div className="instrument-field-control quick-asset-field"><input type="text" autoFocus required value={formData.instrument} onChange={(e) => setFormData({ ...formData, instrument: e.target.value })} placeholder="NQ, ES, BTC..." /><details className="instrument-picker"><summary aria-label="Choose a built-in or custom asset" title="Choose asset" /><div className="instrument-picker-menu"><div className="instrument-picker-heading">Choose an asset <span>{20 + customAssets.length} available</span></div>{[...INSTRUMENT_PRESETS, ...(customAssets.length ? [{ category: 'Custom', assets: customAssets }] : [])].map((group) => <div className="instrument-picker-group" key={group.category}><span className="instrument-group-label">{group.category}</span><div className="instrument-chip-list">{group.assets.map((asset) => <button type="button" key={asset} className={`instrument-chip ${formData.instrument === asset ? 'selected' : ''}`} aria-pressed={formData.instrument === asset} onClick={() => setFormData({ ...formData, instrument: asset })}>{asset}</button>)}</div></div>)}</div></details></div></div>
                  <div className="form-group"><label>Direction</label><select value={formData.direction} onChange={(e) => setFormData({ ...formData, direction: e.target.value })}><option>Long</option><option>Short</option></select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Result (R)</label><input type="number" step="any" required value={formData.resultR} onChange={(e) => setFormData({ ...formData, resultR: e.target.value })} placeholder="e.g. 1.5 or -1" /></div>
                  <div className="form-group"><label>Setup <span className="mistake-optional-label">Optional</span></label><input type="text" value={formData.setup} onChange={(e) => setFormData({ ...formData, setup: e.target.value })} placeholder="e.g. 15m S/R" /></div>
                </div>
                <div className="quick-form-footer"><span>More detail can be added later by editing the trade.</span><button type="submit" className="btn-primary">Save quick trade</button></div>
              </form>
            ) : (
            <form onSubmit={handleSubmit} onChange={() => setTradeFormTouched(true)} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Date · {getTimeZoneCity(journalTimezone)}</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value, timeZone: journalTimezone, _timestampChanged: true })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Time · {getTimeZoneCity(journalTimezone)}</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value, timeZone: journalTimezone, _timestampChanged: true })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Instrument</label>
                  <div className="instrument-field-control">
                    <input
                      type="text"
                      value={formData.instrument}
                      onChange={(e) => setFormData({ ...formData, instrument: e.target.value })}
                      placeholder="e.g. NQ, GC, BTC"
                      required
                    />
                    <details className="instrument-picker">
                      <summary aria-label="Expand quick-pick instruments" title="Quick-pick instruments" />
                      <div className="instrument-picker-menu">
                        <div className="instrument-picker-heading">Quick-pick instruments <span>{20 + customAssets.length} assets · Selected: {formData.instrument || 'Custom'}</span></div>
                        {[...INSTRUMENT_PRESETS, ...(customAssets.length ? [{ category: 'Custom', assets: customAssets }] : [])].map((group) => (
                          <div className="instrument-picker-group" key={group.category}>
                            <span className="instrument-group-label">{group.category}</span>
                            <div className="instrument-chip-list">
                              {group.assets.map((asset) => (
                                <button
                                  type="button"
                                  key={asset}
                                  className={`instrument-chip ${formData.instrument === asset ? 'selected' : ''}`}
                                  aria-pressed={formData.instrument === asset}
                                  onClick={() => setFormData({ ...formData, instrument: asset })}
                                >
                                  {asset}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
                <div className="form-group">
                  <label>Direction</label>
                  <select
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                  >
                    <option value="Long">Long</option>
                    <option value="Short">Short</option>
                  </select>
                </div>
              </div>

              <div className="entry-mode-picker" role="group" aria-label="Trade entry mode">
                <button type="button" className={`entry-mode-option ${tradeEntryMode === 'standard' ? 'selected' : ''}`} aria-pressed={tradeEntryMode === 'standard'} onClick={() => setTradeEntryMode('standard')}>
                  <strong>Trade details</strong>
                  <span>Log the trade as usual</span>
                </button>
                <button type="button" className={`entry-mode-option ${tradeEntryMode === 'compare' ? 'selected' : ''}`} aria-pressed={tradeEntryMode === 'compare'} onClick={() => setTradeEntryMode('compare')}>
                  <strong>Pre-trade plan vs actual</strong>
                  <span>Record your plan and compare execution</span>
                </button>
              </div>

              {tradeEntryMode === 'compare' && (
                <details className="pretrade-plan-details">
                  <summary>Pre-Trade Plan <span>Optional · enter what you planned before the trade</span></summary>
                  <div className="pretrade-plan-fields">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Planned Entry</label>
                        <input type="number" step="any" value={formData.plannedEntry || ''} onChange={(e) => setFormData({ ...formData, plannedEntry: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Planned Stop Loss</label>
                        <input type="number" step="any" value={formData.plannedStopLoss || ''} onChange={(e) => setFormData({ ...formData, plannedStopLoss: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group mb-4">
                      <label>Planned Take Profit</label>
                      <input type="number" step="any" value={formData.plannedTakeProfit || ''} onChange={(e) => setFormData({ ...formData, plannedTakeProfit: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Pre-Trade TradingView Link</label>
                      <input type="url" value={formData.plannedTradingViewUrl || ''} onChange={(e) => setFormData({ ...formData, plannedTradingViewUrl: e.target.value })} placeholder="https://www.tradingview.com/chart/..." />
                      <small className="panel-sub">Paste a shareable TradingView chart link for your plan.</small>
                      {safeExternalUrl(formData.plannedTradingViewUrl) && <a className="chart-open-link" href={safeExternalUrl(formData.plannedTradingViewUrl)} target="_blank" rel="noopener noreferrer">Open planned chart ↗</a>}
                      {formData.plannedScreenshotUrl && <div className="legacy-screenshot-note"><span>Existing saved screenshot</span><button type="button" className="cal-btn" onClick={() => setPreviewImage(formData.plannedScreenshotUrl)}>View</button><button type="button" className="cal-btn" onClick={() => setFormData({ ...formData, plannedScreenshotUrl: '' })}>Remove</button></div>}
                    </div>
                  </div>
                </details>
              )}

              <details className="pretrade-plan-details actual-trade-details" open>
                <summary>{tradeEntryMode === 'compare' ? 'Actual Trade Details' : 'Trade Details'} <span>Entry, exit, risk, results and notes</span></summary>
                <div className="pretrade-plan-fields">

              <div className="form-row">
                <div className="form-group">
                  <label>Entry</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.entry}
                    onChange={(e) => setFormData({ ...formData, entry: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Stop Loss</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.stopLoss}
                    onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Take Profit</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.takeProfit}
                    onChange={(e) => setFormData({ ...formData, takeProfit: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Exit</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.exit}
                    onChange={(e) => setFormData({ ...formData, exit: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Risk ($)</label>
                  <input
                    type="number"
                    value={formData.risk}
                    onChange={(e) => setFormData({ ...formData, risk: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Result (R)</label>
                  <input
                    type="text"
                    value={formData.resultR}
                    onChange={(e) => setFormData({ ...formData, resultR: e.target.value })}
                    placeholder="Auto-calculated or e.g. 2.8"
                    required
                  />
                </div>
              </div>

              <div className="form-row trade-cost-inputs">
                <div className="form-group">
                  <label>Commission cost ($ / trade)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.commissionCost || ''}
                    onChange={(e) => setFormData({ ...formData, commissionCost: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Spread cost ($ / trade)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.spreadCost || ''}
                    onChange={(e) => setFormData({ ...formData, spreadCost: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="trade-cost-total">Combined execution cost <strong>${((parseFloat(formData.commissionCost) || 0) + (parseFloat(formData.spreadCost) || 0)).toFixed(2)}</strong> per trade</div>

              <div className="form-group">
                <label>Setup</label>
                <input
                  type="text"
                  value={formData.setup}
                  onChange={(e) => setFormData({ ...formData, setup: e.target.value })}
                  placeholder="e.g. 15m S/R, FVG, Sweep"
                />
              </div>

              <div className="form-group">
                <label>Psychology & Mindset</label>
                <div className="psychology-chips-grid">
                  {PSYCHOLOGY_OPTIONS.map((opt) => {
                    const isSelected = (formData.psychology || []).includes(opt.label);
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => handleTagToggle(opt.label)}
                        className={`psych-chip ${opt.type} ${isSelected ? 'active' : ''}`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group mb-4">
                <label>Mistake tracking <span className="mistake-optional-label">Optional · tag any mistakes from this trade</span></label>
                <div className="mistake-chip-list">
                  {MISTAKE_TAGS.map((tag) => {
                    const isSelected = (formData.mistakes || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleMistakeToggle(tag)}
                        className={`mistake-chip ${isSelected ? 'selected' : ''}`}
                      >
                        {isSelected ? '✓ ' : '+ '}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="What happened? What did you do well/wrong?"
                ></textarea>
              </div>

              <div className="form-group mb-6">
                <label>Executed Trade TradingView Link</label>
                <input type="url" value={formData.tradingViewUrl || ''} onChange={(e) => setFormData({ ...formData, tradingViewUrl: e.target.value })} placeholder="https://www.tradingview.com/chart/..." />
                <small className="panel-sub">Optional link to the chart showing your executed trade.</small>
                {safeExternalUrl(formData.tradingViewUrl) && <a className="chart-open-link" href={safeExternalUrl(formData.tradingViewUrl)} target="_blank" rel="noopener noreferrer">Open executed chart ↗</a>}
                {formData.screenshotUrl && <div className="legacy-screenshot-note"><span>Existing saved screenshot</span><button type="button" className="cal-btn" onClick={() => setPreviewImage(formData.screenshotUrl)}>View</button><button type="button" className="cal-btn" onClick={() => setFormData({ ...formData, screenshotUrl: '' })}>Remove</button></div>}
              </div>
                </div>
              </details>

              <button type="submit" className="btn-primary full-width">
                {formData.id ? 'Update Trade' : 'Save Trade'}
              </button>
            </form>
            )}
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {isTopDownCardModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTopDownCardModalOpen(false)}>
          <section className="modal-content top-down-card-modal" role="dialog" aria-modal="true" aria-labelledby="top-down-card-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-sub">YOUR ANALYSIS · {currentProfileObj.name}</span>
                <h2 id="top-down-card-modal-title">{topDownCardForm.id ? 'Edit analysis card' : 'Create analysis card'}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsTopDownCardModalOpen(false)} aria-label="Close analysis card form">✕</button>
            </div>
            <form onSubmit={saveTopDownCard}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="analysis-card-date">Date</label>
                  <input id="analysis-card-date" type="date" required value={topDownCardForm.date || ''} onChange={(event) => setTopDownCardForm({ ...topDownCardForm, date: event.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="analysis-card-timeframe">Custom timeframe</label>
                  <input id="analysis-card-timeframe" type="text" required value={topDownCardForm.timeframe || ''} onChange={(event) => setTopDownCardForm({ ...topDownCardForm, timeframe: event.target.value })} placeholder="e.g. Weekly, 4H, 15m" />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="analysis-card-title">Card title</label>
                <input id="analysis-card-title" type="text" value={topDownCardForm.title || ''} onChange={(event) => setTopDownCardForm({ ...topDownCardForm, title: event.target.value })} placeholder="e.g. NQ weekly bullish setup" />
              </div>
              <div className="form-group">
                <label>Chart screenshot <span className="mistake-optional-label">Optional · saved in this browser</span></label>
                {topDownCardForm.imageData && <div className="top-down-form-image"><img src={topDownCardForm.imageData} alt="Analysis card screenshot preview" /><button className="cal-btn" type="button" onClick={() => setTopDownCardForm({ ...topDownCardForm, imageData: '', imageName: '' })}>Remove image</button></div>}
                <label className="cal-btn top-down-file-picker">＋ {topDownCardForm.imageData ? 'Replace screenshot' : 'Add screenshot'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleTopDownImageChange} />
                </label>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="analysis-card-tv-link">TradingView link</label>
                  <input id="analysis-card-tv-link" type="url" value={topDownCardForm.tradingViewUrl || ''} onChange={(event) => setTopDownCardForm({ ...topDownCardForm, tradingViewUrl: event.target.value })} placeholder="https://www.tradingview.com/chart/..." />
                  {safeExternalUrl(topDownCardForm.tradingViewUrl) && <a className="chart-open-link" href={safeExternalUrl(topDownCardForm.tradingViewUrl)} target="_blank" rel="noopener noreferrer">Open chart ↗</a>}
                </div>
                <div className="form-group">
                  <label htmlFor="analysis-card-reference-link">Other link</label>
                  <input id="analysis-card-reference-link" type="url" value={topDownCardForm.referenceUrl || ''} onChange={(event) => setTopDownCardForm({ ...topDownCardForm, referenceUrl: event.target.value })} placeholder="Optional reference link" />
                  {safeExternalUrl(topDownCardForm.referenceUrl) && <a className="chart-open-link" href={safeExternalUrl(topDownCardForm.referenceUrl)} target="_blank" rel="noopener noreferrer">Open reference ↗</a>}
                </div>
              </div>
              <div className="form-group mb-6">
                <label htmlFor="analysis-card-description">Description and notes</label>
                <textarea id="analysis-card-description" rows="5" value={topDownCardForm.description || ''} onChange={(event) => setTopDownCardForm({ ...topDownCardForm, description: event.target.value })} placeholder="Describe the market structure, key levels, bias, or what you want to watch." />
              </div>
              <div className="top-down-form-actions">
                <button className="cal-btn" type="button" onClick={() => setIsTopDownCardModalOpen(false)}>Cancel</button>
                <button className="btn-primary" type="submit">{topDownCardForm.id ? 'Save changes' : 'Create card'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {selectedTradeDetails && (
        <div className="modal-overlay" onClick={() => setSelectedTradeDetails(null)}>
          <section className="modal-content trade-detail-modal" role="dialog" aria-modal="true" aria-labelledby="trade-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header trade-detail-header">
              <div>
                <span className="text-muted text-xs">{selectedTradeDetails.date} · {selectedTradeDetails.time || 'Time not set'}</span>
                <h2 id="trade-detail-title"><span className="instrument-badge">{selectedTradeDetails.instrument || 'Trade'}</span> {selectedTradeDetails.direction}</h2>
                <span className={`trade-detail-result ${Number(selectedTradeDetails.resultR) >= 0 ? 'text-green' : 'text-red'}`}>
                  {Number(selectedTradeDetails.resultR) > 0 ? '+' : ''}{selectedTradeDetails.resultR || 0}R
                </span>
              </div>
              <button className="close-btn" onClick={() => setSelectedTradeDetails(null)} aria-label="Close trade details">✕</button>
            </div>
            <div className="trade-detail-grid">
              <section className="trade-detail-section">
                <h3>Pre-trade plan</h3>
                <dl>
                  <div><dt>Planned entry</dt><dd>{selectedTradeDetails.plannedEntry || '—'}</dd></div>
                  <div><dt>Planned stop loss</dt><dd>{selectedTradeDetails.plannedStopLoss || '—'}</dd></div>
                  <div><dt>Planned take profit</dt><dd>{selectedTradeDetails.plannedTakeProfit || '—'}</dd></div>
                </dl>
              </section>
              <section className="trade-detail-section">
                <h3>Trade execution</h3>
                <dl>
                  <div><dt>Entry</dt><dd>{selectedTradeDetails.entry || '—'}</dd></div>
                  <div><dt>Stop loss</dt><dd>{selectedTradeDetails.stopLoss || '—'}</dd></div>
                  <div><dt>Take profit</dt><dd>{selectedTradeDetails.takeProfit || '—'}</dd></div>
                  <div><dt>Exit</dt><dd>{selectedTradeDetails.exit || '—'}</dd></div>
                  <div><dt>Risk</dt><dd>{selectedTradeDetails.risk ? `$${selectedTradeDetails.risk}` : '—'}</dd></div>
                  <div><dt>Setup</dt><dd>{selectedTradeDetails.setup || '—'}</dd></div>
                </dl>
              </section>
              <section className="trade-detail-section">
                <h3>Execution costs</h3>
                <dl>
                  <div><dt>Commission</dt><dd>${(parseFloat(selectedTradeDetails.commissionCost) || 0).toFixed(2)}</dd></div>
                  <div><dt>Spread</dt><dd>${(parseFloat(selectedTradeDetails.spreadCost) || 0).toFixed(2)}</dd></div>
                  <div><dt>Total</dt><dd>${getTradeCosts(selectedTradeDetails).toFixed(2)}</dd></div>
                </dl>
              </section>
            </div>
            {(selectedTradeDetails.psychology?.length > 0 || selectedTradeDetails.mistakes?.length > 0) && (
              <section className="trade-detail-section trade-detail-tags-section">
                <h3>Mindset & mistakes</h3>
                <div className="trade-detail-tags">
                  {(selectedTradeDetails.psychology || []).map((tag) => <span className="tag-badge" key={`mind-${tag}`}>{tag}</span>)}
                  {(selectedTradeDetails.mistakes || []).map((tag) => <span className="tag-badge mistake-tag-badge" key={`mistake-${tag}`}>! {tag}</span>)}
                </div>
              </section>
            )}
            {selectedTradeDetails.notes && <section className="trade-detail-section trade-detail-notes"><h3>Notes</h3><p>{selectedTradeDetails.notes}</p></section>}
            <div className="trade-detail-footer">
              <div className="trade-detail-chart-links">
                {safeExternalUrl(selectedTradeDetails.plannedTradingViewUrl) && <a className="cal-btn" href={safeExternalUrl(selectedTradeDetails.plannedTradingViewUrl)} target="_blank" rel="noopener noreferrer">Open plan chart ↗</a>}
                {safeExternalUrl(selectedTradeDetails.tradingViewUrl) && <a className="cal-btn" href={safeExternalUrl(selectedTradeDetails.tradingViewUrl)} target="_blank" rel="noopener noreferrer">Open trade chart ↗</a>}
                {selectedTradeDetails.plannedScreenshotUrl && <button className="cal-btn" onClick={() => setPreviewImage(selectedTradeDetails.plannedScreenshotUrl)}>View plan image</button>}
                {selectedTradeDetails.screenshotUrl && <button className="cal-btn" onClick={() => setPreviewImage(selectedTradeDetails.screenshotUrl)}>View trade image</button>}
              </div>
              <button className="btn-primary" onClick={() => { const trade = selectedTradeDetails; setSelectedTradeDetails(null); handleEditTrade(trade); }}>✏️ Edit trade</button>
            </div>
          </section>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn float-close" onClick={() => setPreviewImage(null)}>
              ✕
            </button>
            <img src={previewImage} alt="Full resolution chart screenshot" />
          </div>
        </div>
      )}
      {pipSqueakEnabled && bottomBuddyPopup && (
        <aside className="bottom-buddy-popup" role="status" aria-live="polite">
          <span className="bottom-buddy-popup-icon" aria-hidden="true">✳</span>
          <div>
            <span className="bottom-buddy-popup-label">PIP SQUEAK</span>
            <p>{bottomBuddyPopup}</p>
            {mindsetPrankStep >= 0 && mindsetPrankStep < 3 && (
              <button type="button" className="bottom-buddy-prank-action" onClick={advanceCalendarMindsetPrank}>Mindset</button>
            )}
          </div>
          <button type="button" onClick={() => { window.clearTimeout(bottomBuddyTimer.current); setBottomBuddyPopup(''); setMindsetPrankStep(-1); }} aria-label="Dismiss buddy message">×</button>
        </aside>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('CookurTrades could not register its offline app shell.', error);
    });
  });
}
