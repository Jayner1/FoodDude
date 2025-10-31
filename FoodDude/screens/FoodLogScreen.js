// screens/FoodLogScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Alert,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Button,
  ActivityIndicator,
  AppState,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  onSnapshot,
} from 'firebase/firestore';
import foodDatabase from '../foodDatabase.json';
import * as Speech from 'expo-speech';
import Voice from '@react-native-voice/voice';

const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export default function FoodLogScreen() {
  const userId = auth.currentUser?.uid;
  const appState = useRef(AppState.currentState);

  const [log, setLog] = useState({});
  const [selectedMeal, setSelectedMeal] = useState('Breakfast');
  const [textInput, setTextInput] = useState('');
  const [manualQueue, setManualQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [recognizing, setRecognizing] = useState(false);

  // ─── Initialize Voice ────────────────────────────────
  useEffect(() => {
    Voice.onSpeechResults = e => {
      const spoken = e.value?.[0]?.toLowerCase().trim();
      if (spoken) {
        setTranscription(spoken);
        saveVoiceLog(spoken);
        addFoodToMeal(spoken);
        Speech.speak(`Added ${spoken}`);
      }
      setRecognizing(false);
    };

    Voice.onSpeechError = e => {
      console.error('Voice error:', e);
      setRecognizing(false);
      Alert.alert('Speech recognition error', e.error?.message || 'Unknown error');
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  // ─── Firestore Sync ────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const docRef = doc(db, 'foodLogs', userId);
    const unsubscribe = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) setLog(snapshot.data());
        else {
          const empty = {};
          meals.forEach(m => (empty[m] = []));
          setLog(empty);
          setDoc(docRef, empty);
        }
        setOffline(false);
        setLoading(false);
      },
      () => {
        setOffline(true);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // ─── AppState Sync for Offline Queue ────────────────────────────────
  useEffect(() => {
    const sync = async () => {
      if (!userId || manualQueue.length === 0) return;
      for (const { meal, foodItem } of manualQueue) {
        await updateDoc(doc(db, 'foodLogs', userId), { [meal]: arrayUnion(foodItem) }).catch(() => {});
      }
      setManualQueue([]);
    };

    const handler = next => {
      if (appState.current.match(/inactive|background/) && next === 'active') sync();
      appState.current = next;
    };

    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [manualQueue, userId]);

  // ─── Permission Helper ────────────────────────────────
  const requestMicPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'Food Dude needs access to your microphone for voice logging.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  // ─── Core Firestore Operations ────────────────────────────────
  const saveLog = async (meal, item) => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'foodLogs', userId), { [meal]: arrayUnion(item) });
    } catch {
      setManualQueue(p => [...p, { meal, foodItem: item }]);
    }
  };

  const saveVoiceLog = async text => {
    if (!userId || !text) return;
    const entry = { text, createdAt: new Date().toISOString() };
    const ref = doc(db, 'voiceLogs', userId);
    const snap = await getDoc(ref);
    if (snap.exists()) await updateDoc(ref, { logs: arrayUnion(entry) });
    else await setDoc(ref, { logs: [entry] });
  };

  // ─── Voice Recognition ────────────────────────────────
  const startRecognition = async () => {
    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      Alert.alert('Permission denied', 'Please enable microphone access in settings.');
      return;
    }

    if (recognizing) return;
    setRecognizing(true);
    setTranscription('');
    Alert.alert('Listening...', 'Say a food name (e.g., "apple")');

    try {
      await Voice.start('en-US');
    } catch (err) {
      console.error(err);
      setRecognizing(false);
      Alert.alert('Speech error', err.message);
    }
  };

  // ─── Add Food Logic ────────────────────────────────
  const addFoodToMeal = name => {
    const item = foodDatabase.find(f => f.foodName.toLowerCase() === name);
    if (item) {
      setLog(p => ({ ...p, [selectedMeal]: [...(p[selectedMeal] || []), item] }));
      saveLog(selectedMeal, item);
      Speech.speak(`Added ${item.foodName}`);
    } else {
      Alert.alert(`Food "${name}" not found.`);
    }
  };

  // ─── Manual Add ────────────────────────────────
  const handleTextSubmit = () => {
    const t = textInput.trim().toLowerCase();
    if (t) addFoodToMeal(t);
    setTextInput('');
  };

  // ─── Delete / Clear ────────────────────────────────
  const deleteItem = (meal, idx) => {
    const newMeal = [...(log[meal] || [])];
    newMeal.splice(idx, 1);
    setLog(p => ({ ...p, [meal]: newMeal }));
    setDoc(doc(db, 'foodLogs', userId), { ...log, [meal]: newMeal }, { merge: true }).catch(() => {});
  };

  const clearMeal = meal => {
    setLog(p => ({ ...p, [meal]: [] }));
    setDoc(doc(db, 'foodLogs', userId), { ...log, [meal]: [] }, { merge: true }).catch(() => {});
  };

  // ─── Render ────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Food Dude</Text>
      </View>

      <View style={styles.mealSelector}>
        {meals.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.mealButton, selectedMeal === m && styles.selectedMeal]}
            onPress={() => setSelectedMeal(m)}
          >
            <Text style={[styles.mealText, selectedMeal === m && { color: '#FFD54F' }]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.controls}>
        <Button
          title={recognizing ? 'Listening...' : 'Start Voice'}
          onPress={startRecognition}
          disabled={recognizing}
          color="#1A237E"
        />
      </View>

      <TextInput
        style={styles.textInput}
        placeholder="Enter food manually..."
        value={textInput}
        onChangeText={setTextInput}
        onSubmitEditing={handleTextSubmit}
      />
      <Button title="Add Food" onPress={handleTextSubmit} color="#1A237E" />

      <Text style={styles.transcription}>Last Entry: {transcription}</Text>

      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>{selectedMeal} Log:</Text>
        <TouchableOpacity onPress={() => clearMeal(selectedMeal)}>
          <Text style={styles.clearButton}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1A237E" />
      ) : offline ? (
        <Text style={styles.offlineText}>Offline — data may be outdated.</Text>
      ) : (
        <FlatList
          data={log[selectedMeal] || []}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item, index }) => (
            <View style={styles.logItem}>
              <Text style={styles.logText}>
                {item.foodName} - {item.calories} cal, {item.protein}g P, {item.carbs}g C, {item.fat}g F
              </Text>
              <TouchableOpacity onPress={() => deleteItem(selectedMeal, index)} style={styles.deleteButton}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#FFD54F' },
  header: { paddingVertical: 15, alignItems: 'center', backgroundColor: '#1A237E', marginBottom: 20, borderRadius: 8 },
  headerText: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  mealSelector: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  mealButton: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 5, backgroundColor: '#FFF8DC' },
  selectedMeal: { backgroundColor: '#1A237E' },
  mealText: { fontWeight: 'bold', color: '#1A237E' },
  controls: { marginBottom: 20 },
  transcription: { marginBottom: 20, fontWeight: 'bold', fontSize: 16, color: '#1A237E' },
  textInput: { borderWidth: 1, borderColor: '#1A237E', padding: 10, marginBottom: 10, borderRadius: 5, backgroundColor: '#FFF' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  logTitle: { fontWeight: 'bold', fontSize: 18, color: '#1A237E' },
  clearButton: { color: '#FF5252', fontWeight: 'bold' },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#ccc' },
  logText: { fontSize: 16, color: '#1A237E' },
  deleteButton: { backgroundColor: '#FF5252', paddingHorizontal: 10, borderRadius: 5 },
  deleteText: { color: '#fff', fontWeight: 'bold' },
  offlineText: { textAlign: 'center', marginTop: 20, color: 'red', fontWeight: 'bold' },
});
