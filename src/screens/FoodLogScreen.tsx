// src/screens/FoodLogScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfDay, addDays, isToday } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';

import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';

import { auth, db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { initDatabase, searchFoodsLocal } from '../services/FoodDatabase';

type MealName = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';

type FoodEntry = {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type DayLog = {
  [meal in MealName]?: FoodEntry[];
};

type LogsState = Record<string, DayLog>;

const meals: MealName[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const isNative = Capacitor.isNativePlatform();

/** (Optional) STT backend helper (unused when using Apple STT) */
const sendToStt = async (
  base64Audio: string,
  mimeType: string
): Promise<string | null> => {
  try {
    const platform = Capacitor.getPlatform();

    const MAC_LAN_IP = '192.168.1.181';

    const STT_URL =
      platform === 'ios' || platform === 'android'
        ? `http://${MAC_LAN_IP}:4000/transcribe`
        : 'http://localhost:4000/transcribe';

    console.log('[Voice] STT_URL =', STT_URL);

    const resp = await fetch(STT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioBase64: base64Audio,
        mimeType,
      }),
    });

    if (!resp.ok) {
      console.error('[Voice] STT HTTP error:', resp.status);
      return null;
    }

    const data = await resp.json();
    console.log('[Voice] STT response:', data);

    return (data as any).text || null;
  } catch (e) {
    console.error('[Voice] STT request failed:', e);
    return null;
  }
};

/** Speech permission helper (Capgo plugin) */
const ensureSpeechPerms = async (): Promise<boolean> => {
  try {
    const perms = await SpeechRecognition.checkPermissions();
    if ((perms as any).speechRecognition !== 'granted') {
      const req = await SpeechRecognition.requestPermissions();
      return (req as any).speechRecognition === 'granted';
    }
    return true;
  } catch (e) {
    console.error('[Voice] Speech permission check failed:', e);
    return false;
  }
};

/** Start Apple speech listening (partial results improves reliability on iOS) */
const startAppleListening = async () => {
  await SpeechRecognition.start({
    language: 'en-US',
    partialResults: true, 
    popup: false,
    punctuation: false,
  } as any);
};

const normalizeFoodQuery = (s: string) => {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') 
    .replace(
      /\b(i|im|i'm|had|have|ate|for|a|an|the|to|and|with|please|add)\b/g,
      ' '
    )
    .replace(/\b(snack|snacks|breakfast|lunch|dinner)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const FoodLogScreen: React.FC = () => {
  const userId = auth.currentUser?.uid || null;

  const [logs, setLogs] = useState<LogsState>({});
  const [currentDate, setCurrentDate] = useState<Date>(startOfDay(new Date()));
  const [selectedMeal, setSelectedMeal] = useState<MealName>('Breakfast');
  const [textInput, setTextInput] = useState('');
  const [transcription, setTranscription] = useState('');
  const [dbReady, setDbReady] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const lastSpeechRef = useRef<string>('');
  const partialListenerRef = useRef<any>(null);

  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const currentLog = logs[dateKey] || {};

  useEffect(() => {
    initDatabase().then(() => setDbReady(true));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, 'foodLogs', userId, 'daily', dateKey);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setLogs((prev) => ({ ...prev, [dateKey]: snap.data() as DayLog }));
      } else {
        setLogs((prev) => ({ ...prev, [dateKey]: {} }));
      }
    });
    return () => unsub();
  }, [userId, dateKey]);

  const totals = useMemo(() => {
    let c = 0,
      p = 0,
      ca = 0,
      f = 0;

    meals.forEach((m) => {
      (currentLog[m] || []).forEach((item) => {
        c += item.calories || 0;
        p += Number(item.protein || 0);
        ca += Number(item.carbs || 0);
        f += Number(item.fat || 0);
      });
    });

    return {
      calories: c,
      protein: p.toFixed(1),
      carbs: ca.toFixed(1),
      fat: f.toFixed(1),
    };
  }, [currentLog]);

  const speak = (text: string) => {
    if (isNative) {
      console.log('[TTS]', text);
      return;
    }

    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utter);
      } else {
        console.log('[TTS]', text);
      }
    } catch (e) {
      console.log('[TTS fallback]', text, e);
    }
  };

  const persistDayLog = async (updatedDayLog: DayLog) => {
    if (userId) {
      await setDoc(
        doc(db, 'foodLogs', userId, 'daily', dateKey),
        updatedDayLog,
        { merge: true }
      );
    }
  };

  const addFood = (food: any, meal: MealName = selectedMeal) => {
    const item: FoodEntry = {
      foodName: (food.name || '').trim(),
      calories: food.calories || 0,
      protein: food.protein || 0,
      carbs: food.carbs || 0,
      fat: food.fat || 0,
    };

    setLogs((prev) => {
      const dayLog: DayLog = prev[dateKey] || {};
      const updatedDayLog: DayLog = {
        ...dayLog,
        [meal]: [...(dayLog[meal] || []), item],
      };

      persistDayLog(updatedDayLog);

      return {
        ...prev,
        [dateKey]: updatedDayLog,
      };
    });

    speak(`Added ${item.foodName} to ${meal}`);
    setTranscription(item.foodName);
    setTextInput('');
    setSearchModalVisible(false);
  };

  const deleteFood = (index: number) => {
    setLogs((prev) => {
      const dayLog: DayLog = prev[dateKey] || {};
      const list = [...(dayLog[selectedMeal] || [])];
      if (index < 0 || index >= list.length) return prev;

      list.splice(index, 1);
      const updatedDayLog: DayLog = {
        ...dayLog,
        [selectedMeal]: list,
      };

      persistDayLog(updatedDayLog);

      return {
        ...prev,
        [dateKey]: updatedDayLog,
      };
    });
  };

  const clearCurrentMeal = () => {
    const list = currentLog[selectedMeal] || [];
    if (!list.length) return;

    const confirmClear =
      typeof window !== 'undefined'
        ? window.confirm(`Clear all items in ${selectedMeal}?`)
        : true;

    if (!confirmClear) return;

    setLogs((prev) => {
      const dayLog: DayLog = prev[dateKey] || {};
      const updatedDayLog: DayLog = {
        ...dayLog,
        [selectedMeal]: [],
      };

      persistDayLog(updatedDayLog);

      return {
        ...prev,
        [dateKey]: updatedDayLog,
      };
    });
  };

  const handleSearch = async () => {
    if (!textInput.trim()) return;
    const q = textInput.trim();
    setSearchQuery(q);

    const results = await searchFoodsLocal(q, 30);
    setSearchResults(results);
    setSearchModalVisible(true);
  };

  /** Parse transcript -> detect meal -> search DB -> auto-add or open modal */
const handleVoiceCommand = async (text: string) => {
  let meal: MealName = selectedMeal;
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();

  if (/\blunch\b/.test(lower)) meal = 'Lunch';
  else if (/\bdinner\b/.test(lower)) meal = 'Dinner';
  else if (/\bbreakfast\b/.test(lower)) meal = 'Breakfast';
  else if (/\bsnacks?\b/.test(lower)) meal = 'Snacks';

  let cleanedPhrase = lower
    .replace(/\b(add|log|track)\b/g, ' ')
    .replace(/\b(i|i'm|im)\b/g, ' ')
    .replace(/\b(had|have|ate)\b/g, ' ')
    .replace(/\b(please)\b/g, ' ')
    .replace(/\b(and|with)\b/g, ' ')
    .replace(/\b(to|for)\s+(breakfast|lunch|dinner|snacks?)\b/g, ' ')
    .replace(/\b(breakfast|lunch|dinner|snacks?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanedPhrase) {
    speak("Didn't catch that");
    return;
  }

  const query = cleanedPhrase
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log('[Voice] raw transcript:', raw);
  console.log('[Voice] phrase:', cleanedPhrase, '| query:', query);

  let results = await searchFoodsLocal(query, 12);

  if (!results?.length) {
    const parts = query.split(' ').filter(Boolean);
    const last2 = parts.length >= 2 ? parts.slice(-2).join(' ') : '';
    if (last2 && last2 !== query) results = await searchFoodsLocal(last2, 12);
  }

  if (!results?.length) {
    const parts = query.split(' ').filter(Boolean);
    const last1 = parts[parts.length - 1];
    if (last1) results = await searchFoodsLocal(last1, 12);
  }

  const topName = (results?.[0]?.name || '').toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);

  const looksLikeMatch =
    tokens.length === 1
      ? topName.includes(tokens[0])
      : tokens.some((t) => topName.includes(t));

  if (results?.[0] && looksLikeMatch) {
    addFood(results[0], meal);
    return;
  }

  setSearchQuery(query);
  setSearchResults(results || []);
  setSearchModalVisible(true);
  speak('Pick the closest match.');
};

  /** Tap once = start listening, tap again = stop and commit last partial */
  const handleMicPress = async () => {
    if (isTranscribing) return;

    if (!isNative) {
      alert('Voice logging works in the iOS app. For web, use text search.');
      return;
    }

    if (isRecording) {
      try {
        setIsRecording(false);
        setIsTranscribing(true);

        try {
          await SpeechRecognition.stop();
        } catch (e) {
          console.warn('[Voice] stop() threw (ignored):', e);
        }

        await new Promise((r) => setTimeout(r, 350));

        const finalText = (lastSpeechRef.current || '').trim();
        lastSpeechRef.current = '';

        try {
          await partialListenerRef.current?.remove?.();
        } catch (_) {}
        partialListenerRef.current = null;

        try {
          await SpeechRecognition.removeAllListeners();
        } catch (_) {}

        if (!finalText) {
          speak("Sorry, I couldn't understand that.");
          return;
        }

        console.log('[Voice] Apple Transcript:', finalText);
        await handleVoiceCommand(finalText);
      } catch (e) {
        console.error('[Voice] Apple STT stop error:', e);
        speak("Sorry, I couldn't understand that audio.");
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    try {
      const ok = await ensureSpeechPerms();
      if (!ok) {
        alert('Speech recognition permission is required for voice logging.');
        return;
      }

      lastSpeechRef.current = '';

      try {
        await SpeechRecognition.removeAllListeners();
      } catch (_) {}

      partialListenerRef.current = await SpeechRecognition.addListener(
        'partialResults',
        (data: any) => {
          const t =
            (data as any)?.matches?.[(data as any)?.matches?.length - 1] ??
            (data as any)?.value ??
            (data as any)?.text ??
            '';
          if (typeof t === 'string') lastSpeechRef.current = t;
        }
      );

      await startAppleListening();
      setIsRecording(true);
    } catch (e) {
      console.error('[Voice] Apple STT start error:', e);
      setIsRecording(false);
    }
  };

  // Calendar UI
  const renderCalendar = () => {
    const days: React.ReactElement[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = addDays(currentDate, i);
      const key = format(d, 'yyyy-MM-dd');
      const active = key === dateKey;

      days.push(
        <button
          key={i}
          style={{
            ...styles.dateBtn,
            ...(active ? styles.activeDateBtn : {}),
          }}
          onClick={() => setCurrentDate(startOfDay(d))}
        >
          <span style={active ? styles.activeDateText : styles.dateText}>
            {isToday(d) ? 'Today' : format(d, 'EEE')}
          </span>
          <span style={active ? styles.activeDateNum : styles.dateNum}>
            {format(d, 'd')}
          </span>
        </button>
      );
    }
    return <div style={styles.calendar}>{days}</div>;
  };

  if (!dbReady) {
    return (
      <div style={styles.fullscreenCenter}>
        <p style={styles.loadingText}>Loading 326,760 foods...</p>
      </div>
    );
  }

  const currentMealEntries = currentLog[selectedMeal] || [];

  return (
    <div style={styles.viewport}>
      <div style={styles.content}>
        <h1 style={styles.title}>FoodDude</h1>

        {renderCalendar()}

        <div style={styles.totalsCard}>
          <p style={styles.totalsDate}>{format(currentDate, 'EEEE, MMMM d')}</p>
          <p style={styles.totalsCalories}>{totals.calories} cal</p>
          <div style={styles.macrosRow}>
            <span style={styles.macro}>P {totals.protein}g</span>
            <span style={styles.macro}>C {totals.carbs}g</span>
            <span style={styles.macro}>F {totals.fat}g</span>
          </div>
        </div>

        <div style={styles.mealRow}>
          {meals.map((m) => (
            <button
              key={m}
              style={{
                ...styles.mealTab,
                ...(selectedMeal === m ? styles.activeMealTab : {}),
              }}
              onClick={() => setSelectedMeal(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={styles.searchSection}>
          <div style={styles.searchRow}>
            <input
              style={styles.input}
              placeholder="Search foods..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button style={styles.searchBtn} onClick={handleSearch}>
              Search
            </button>
          </div>

          <button
            style={{
              ...styles.micBtn,
              ...(isRecording || isTranscribing ? styles.micActive : {}),
              ...(isNative ? {} : styles.micDisabled),
            }}
            onClick={handleMicPress}
            disabled={isTranscribing || (!isNative && false)}
          >
            {isTranscribing
              ? 'Transcribing…'
              : isRecording
              ? 'Tap to stop'
              : isNative
              ? 'Tap to speak'
              : 'Mic (app only)'}
          </button>
        </div>

        <p style={styles.lastAdded}>Last: {transcription || 'None'}</p>

        <div style={styles.listContainer}>
          {currentMealEntries.map((item, i) => (
            <div key={i} style={styles.foodCard}>
              <div style={styles.foodTextWrapper}>
                <p style={styles.foodText}>
                  {item.foodName} — {item.calories} cal | {item.protein}g P |{' '}
                  {item.carbs}g C | {item.fat}g F
                </p>
              </div>
              <button style={styles.deleteBtn} onClick={() => deleteFood(i)}>
                ✕
              </button>
            </div>
          ))}
          {!currentMealEntries.length && (
            <p style={styles.emptyText}>No foods logged for this meal yet.</p>
          )}
        </div>

        <button
          style={{
            ...styles.clearMealBtn,
            opacity: currentMealEntries.length ? 1 : 0.5,
          }}
          onClick={clearCurrentMeal}
          disabled={!currentMealEntries.length}
        >
          Clear all {selectedMeal}
        </button>
      </div>

      {searchModalVisible && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <button
                style={styles.backButton}
                onClick={() => setSearchModalVisible(false)}
              >
                ←
              </button>
              <p style={styles.modalTitle}>“{searchQuery}”</p>
            </div>
            <div style={styles.modalList}>
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  style={styles.resultItem}
                  onClick={() => addFood(item)}
                >
                  <span style={styles.resultName}>{item.name}</span>
                  <span style={styles.resultCals}>
                    {Math.round(item.calories)} cal
                  </span>
                </button>
              ))}
              {!searchResults.length && (
                <p style={{ padding: 16 }}>No results found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  viewport: {
    minHeight: '100vh',
    backgroundColor: '#fff',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    overflowX: 'hidden',
  },
  content: {
    width: '100%',
    maxWidth: 480,
    margin: '0 auto',
    padding: '24px 16px 40px',
    boxSizing: 'border-box',
  },
  fullscreenCenter: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 18,
    color: '#C19A00',
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    textAlign: 'center',
    color: '#C19A00',
    marginBottom: 16,
  },

  calendar: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 4px',
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    overflowX: 'auto',
  },
  dateBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    minWidth: 60,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  activeDateBtn: {
    backgroundColor: '#C19A00',
  },
  dateText: {
    fontSize: 13,
    color: '#666',
  },
  activeDateText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: 600,
  },
  dateNum: {
    fontSize: 20,
    fontWeight: 700,
    color: '#333',
    marginTop: 2,
  },
  activeDateNum: {
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
    marginTop: 2,
  },

  totalsCard: {
    backgroundColor: '#C19A00',
    marginTop: 16,
    marginBottom: 12,
    padding: '20px 20px 18px',
    borderRadius: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 6px 12px rgba(0,0,0,0.18)',
  },
  totalsDate: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 4,
  },
  totalsCalories: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 900,
  },
  macrosRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 24,
    marginTop: 10,
  },
  macro: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
  },

  mealRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  mealTab: {
    padding: '10px 18px',
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
  },
  activeMealTab: {
    backgroundColor: '#C19A00',
    color: '#fff',
  },

  searchSection: {
    marginTop: 4,
    marginBottom: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  searchRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  searchBar: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: '0 14px',
    fontSize: 17,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#ddd',
    outline: 'none',
  },
  searchBtn: {
    height: 48,
    padding: '0 16px',
    borderRadius: 16,
    border: 'none',
    backgroundColor: '#C19A00',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  micBtn: {
    width: '100%',
    height: 48,
    padding: '0 14px',
    borderRadius: 16,
    border: 'none',
    backgroundColor: '#C19A00',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  micActive: {
    backgroundColor: '#ff4444',
  },
  micDisabled: {
    opacity: 0.6,
  },

  lastAdded: {
    textAlign: 'center',
    color: '#C19A00',
    fontWeight: 600,
    marginTop: 6,
    marginBottom: 8,
    fontSize: 14,
  },

  listContainer: {
    marginTop: 4,
    marginBottom: 12,
  },
  foodCard: {
    backgroundColor: '#f8f8f8',
    padding: '12px 10px 12px 14px',
    borderRadius: 16,
    marginBottom: 6,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foodTextWrapper: {
    flex: 1,
  },
  foodText: {
    fontSize: 15,
    color: '#333',
  },
  deleteBtn: {
    border: 'none',
    background: 'transparent',
    color: '#c62828',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },

  clearMealBtn: {
    width: '100%',
    marginTop: 4,
    padding: '10px 0',
    borderRadius: 20,
    border: 'none',
    backgroundColor: '#ffe5e5',
    color: '#c62828',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxWidth: 480,
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottom: '1px solid #eee',
    gap: 8,
  },
  backButton: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#C19A00',
  },
  modalList: {
    overflowY: 'auto',
  },
  resultItem: {
    padding: 14,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    border: 'none',
    background: '#fff',
    width: '100%',
    cursor: 'pointer',
  },
  resultName: {
    fontSize: 15,
    fontWeight: 600,
  },
  resultCals: {
    color: '#C19A00',
    fontWeight: 700,
  },
};

export default FoodLogScreen;
