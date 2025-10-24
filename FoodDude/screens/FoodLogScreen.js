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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
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
import { AZURE_SPEECH_KEY, AZURE_REGION } from '@env';

const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export default function FoodLogScreen() {
  const userId = auth.currentUser?.uid;
  const appState = useRef(AppState.currentState);

  const [log, setLog] = useState({});
  const [selectedMeal, setSelectedMeal] = useState('Breakfast');
  const [textInput, setTextInput] = useState('');
  const [recording, setRecording] = useState(null);
  const [recordingQueue, setRecordingQueue] = useState([]);
  const [manualQueue, setManualQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // -------------------------
  // Real-time food log listener
  // -------------------------
  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const docRef = doc(db, 'foodLogs', userId);

    const unsubscribe = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          setLog(snapshot.data());
        } else {
          const emptyLog = {};
          meals.forEach(m => (emptyLog[m] = []));
          setLog(emptyLog);
          setDoc(docRef, emptyLog);
        }
        setOffline(false);
        setLoading(false);
      },
      err => {
        console.warn('Offline — using cached data', err);
        setOffline(true);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // -------------------------
  // Sync offline manual queue when app comes online
  // -------------------------
  useEffect(() => {
    const syncOfflineData = async () => {
      if (!userId || manualQueue.length === 0) return;

      for (const { meal, foodItem } of manualQueue) {
        try {
          const docRef = doc(db, 'foodLogs', userId);
          await updateDoc(docRef, { [meal]: arrayUnion(foodItem) });
        } catch (err) {
          console.warn('Failed to sync manual queue', err);
        }
      }

      setManualQueue([]);
    };

    const handleAppStateChange = nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        syncOfflineData();
      }
      appState.current = nextAppState;
    };

    AppState.addEventListener('change', handleAppStateChange);
    return () => AppState.removeEventListener('change', handleAppStateChange);
  }, [manualQueue, userId]);

  // -------------------------
  // Save manual food item
  // -------------------------
  const saveLog = async (mealName, foodItem) => {
    if (!userId) return;
    try {
      const docRef = doc(db, 'foodLogs', userId);
      await updateDoc(docRef, { [mealName]: arrayUnion(foodItem) });
    } catch (err) {
      console.warn('Offline — queuing manual entry', err);
      setManualQueue(prev => [...prev, { meal: mealName, foodItem }]);
    }
  };

  // -------------------------
  // Save voice log
  // -------------------------
  const saveVoiceLog = async text => {
    if (!userId || !text) return;
    try {
      const voiceRef = doc(db, 'voiceLogs', userId);
      const docSnap = await getDoc(voiceRef);
      const entry = { text, createdAt: new Date().toISOString() };

      if (docSnap.exists()) {
        await updateDoc(voiceRef, { logs: arrayUnion(entry) });
      } else {
        await setDoc(voiceRef, { logs: [entry] });
      }
    } catch (err) {
      console.warn('Offline — voice log queued', err);
      setManualQueue(prev => [...prev, { meal: 'voice', foodItem: { text } }]);
    }
  };

  // -------------------------
  // Audio recording
  // -------------------------
  const prepareAudio = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  };

  const startRecording = async () => {
    if (recording) return Alert.alert('Recording already in progress');
    try {
      await prepareAudio();
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Microphone permission required.');

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      Alert.alert('Recording started. Speak now!');
    } catch (err) {
      console.error(err);
      Alert.alert('Failed to start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingQueue(prev => [...prev, uri]);
      setRecording(null);
      Alert.alert('Recording saved. Processing transcription...');
    } catch (err) {
      console.error(err);
      Alert.alert('Failed to stop recording.');
    }
  };

  // -------------------------
  // Process queued recordings (Azure)
  // -------------------------
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing || recordingQueue.length === 0) return;
      setIsProcessing(true);

      const [uri, ...rest] = recordingQueue;
      setRecordingQueue(rest);

      try {
        const audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

        const response = await axios.post(
          `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`,
          audioBytes,
          {
            headers: {
              'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
              'Content-Type': 'audio/m4a',
              Accept: 'application/json',
            },
          }
        );

        const responseText = response.data.DisplayText || '';
        const cleanText = responseText.trim().toLowerCase().replace(/[^a-z\s]/g, '');
        setTranscription(cleanText);

        await saveVoiceLog(cleanText);
        if (cleanText) addFoodToMeal(cleanText);
      } catch (err) {
        console.error('Azure transcription error:', err.response?.data || err);
        Alert.alert('Transcription failed. Check your Azure credentials.');
      } finally {
        setIsProcessing(false);
      }
    };

    processQueue();
  }, [recordingQueue, isProcessing]);

  // -------------------------
  // Add food item
  // -------------------------
  const addFoodToMeal = foodName => {
    const foodItem = foodDatabase.find(f => f.foodName.toLowerCase() === foodName);
    if (foodItem) {
      setLog(prev => {
        const updated = { ...prev, [selectedMeal]: [...(prev[selectedMeal] || []), foodItem] };
        saveLog(selectedMeal, foodItem);
        return updated;
      });
    } else {
      Alert.alert(`Food "${foodName}" not found in database.`);
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    addFoodToMeal(textInput.trim().toLowerCase());
    setTextInput('');
  };

  const deleteItem = (meal, index) => {
    const newMealLog = [...(log[meal] || [])];
    newMealLog.splice(index, 1);
    setLog(prev => ({ ...prev, [meal]: newMealLog }));

    const docRef = doc(db, 'foodLogs', userId);
    setDoc(docRef, { ...log, [meal]: newMealLog }, { merge: true }).catch(err => {
      console.warn('Offline — delete queued', err);
    });
  };

  const clearMeal = meal => {
    setLog(prev => ({ ...prev, [meal]: [] }));
    const docRef = doc(db, 'foodLogs', userId);
    setDoc(docRef, { ...log, [meal]: [] }, { merge: true }).catch(err => {
      console.warn('Offline — clear queued', err);
    });
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Food Dude</Text>
      </View>

      <View style={styles.mealSelector}>
        {meals.map(meal => (
          <TouchableOpacity
            key={meal}
            style={[styles.mealButton, selectedMeal === meal && styles.selectedMeal]}
            onPress={() => setSelectedMeal(meal)}
          >
            <Text style={[styles.mealText, selectedMeal === meal && { color: '#FFD54F' }]}>{meal}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.controls}>
        <Button title="Start Recording" onPress={startRecording} color="#1A237E" />
        <View style={{ height: 10 }} />
        <Button title="Stop Recording" onPress={stopRecording} color="#1A237E" />
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
          keyExtractor={(item, index) => index.toString()}
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
