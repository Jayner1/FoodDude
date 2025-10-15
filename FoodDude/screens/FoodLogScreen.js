// screens/FoodLogScreen.js
import React, { useState, useEffect } from 'react';
import { View, Button, Text, FlatList, Alert, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import axios from 'axios';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import foodDatabase from '../foodDatabase.json';
import { OPENAI_API_KEY } from '@env';

const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export default function FoodLogScreen() {
  const [recording, setRecording] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [log, setLog] = useState({});
  const [selectedMeal, setSelectedMeal] = useState('Breakfast');
  const [textInput, setTextInput] = useState('');
  const [recordingQueue, setRecordingQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const userId = auth.currentUser?.uid;

  /** Load logs from Firestore */
  useEffect(() => {
    const loadLog = async () => {
      if (!userId) return;

      try {
        const docRef = doc(db, 'foodLogs', userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setLog(docSnap.data());
        } else {
          const emptyLog = {};
          meals.forEach(m => emptyLog[m] = []);
          setLog(emptyLog);
          await setDoc(docRef, emptyLog);
        }
      } catch (err) {
        console.error('Failed to load log from Firestore', err);
        Alert.alert('Error', 'Failed to load your food log. Check your internet connection.');
      }
    };

    loadLog();
  }, [userId]);

  /** Save single food item to Firestore */
  const saveLog = async (mealName, foodItem) => {
    try {
      const docRef = doc(db, 'foodLogs', userId);
      await updateDoc(docRef, { [mealName]: arrayUnion(foodItem) });
    } catch (err) {
      console.error('Failed to save log to Firestore', err);
    }
  };

  /** Audio recording setup */
  const prepareAudio = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  };

  /** Start recording */
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

  /** Stop recording */
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

  /** Process recordings queue one at a time */
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing || recordingQueue.length === 0) return;
      setIsProcessing(true);

      const [uri, ...rest] = recordingQueue;
      setRecordingQueue(rest);

      try {
        // Transcribe audio via OpenAI Whisper
        const formData = new FormData();
        formData.append('file', {
          uri,
          name: 'recording.m4a',
          type: 'audio/m4a',
        });
        formData.append('model', 'whisper-1');

        let responseText = '';
        try {
          const response = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            formData,
            {
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'multipart/form-data',
              },
            }
          );
          responseText = response.data.text;
        } catch (err) {
          console.error(err);
          if (err.response?.status === 429) {
            Alert.alert('Rate limit hit. Try again in a few seconds.');
            responseText = '';
          } else {
            Alert.alert('Transcription failed. Please try again.');
            responseText = '';
          }
        }

        // Clean transcription for database search
        const cleanText = responseText.trim().toLowerCase().replace(/[^a-z\s]/g, '');
        setTranscription(cleanText);

        if (cleanText) addFoodToMeal(cleanText);
      } finally {
        setIsProcessing(false);
      }
    };

    processQueue();
  }, [recordingQueue, isProcessing]);

  /** Add food item to log */
  const addFoodToMeal = (foodName) => {
    const foodItem = foodDatabase.find(
      f => f.foodName.toLowerCase() === foodName
    );

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

  /** Manual text input */
  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    addFoodToMeal(textInput.trim().toLowerCase());
    setTextInput('');
  };

  /** Delete single item */
  const deleteItem = (meal, index) => {
    const newMealLog = [...(log[meal] || [])];
    newMealLog.splice(index, 1);
    setLog(prev => ({ ...prev, [meal]: newMealLog }));
  };

  /** Clear entire meal */
  const clearMeal = async (meal) => {
    setLog(prev => ({ ...prev, [meal]: [] }));
    try {
      const docRef = doc(db, 'foodLogs', userId);
      await setDoc(docRef, { ...log, [meal]: [] }, { merge: true });
    } catch (err) {
      console.error('Failed to clear meal in Firestore', err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Food Dude</Text>
      </View>

      {/* Meal selector */}
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

      {/* Recording buttons */}
      <View style={styles.controls}>
        <Button title="Start Recording" onPress={startRecording} color="#1A237E" />
        <View style={{ height: 10 }} />
        <Button title="Stop Recording" onPress={stopRecording} color="#1A237E" />
      </View>

      {/* Manual input */}
      <TextInput
        style={styles.textInput}
        placeholder="Enter food manually..."
        value={textInput}
        onChangeText={setTextInput}
        onSubmitEditing={handleTextSubmit}
      />
      <Button title="Add Food" onPress={handleTextSubmit} color="#1A237E" />

      <Text style={styles.transcription}>Last Entry: {transcription}</Text>

      {/* Meal log */}
      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>{selectedMeal} Log:</Text>
        <TouchableOpacity onPress={() => clearMeal(selectedMeal)}>
          <Text style={styles.clearButton}>Clear All</Text>
        </TouchableOpacity>
      </View>

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
});
