import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Button, Text, FlatList, Alert, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
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

  const userId = auth.currentUser?.uid;

  // Load logs from Firestore
  useEffect(() => {
    const loadLog = async () => {
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
      }
    };
    if (userId) loadLog();
  }, [userId]);

  // Save log to Firestore
  const saveLog = async (mealName, foodItem) => {
    try {
      const docRef = doc(db, 'foodLogs', userId);
      await updateDoc(docRef, {
        [mealName]: arrayUnion(foodItem)
      });
    } catch (err) {
      console.error('Failed to save log to Firestore', err);
    }
  };

  const prepareAudio = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
  };

  const startRecording = async () => {
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

      const file = {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-1');

      let text = '';
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
        text = response.data.text;
      } catch (err) {
        console.error(err);
        Alert.alert('Transcription failed. Using fallback.');
        text = 'Apple, medium';
      }

      setTranscription(text);
      addFoodToMeal(text);
      setRecording(null);
    } catch (err) {
      console.error(err);
      Alert.alert('Failed to stop recording.');
    }
  };

  const addFoodToMeal = (foodName) => {
    const foodItem = foodDatabase.find(f => f.foodName.toLowerCase() === foodName.toLowerCase());
    if (foodItem) {
      setLog(prev => {
        const updated = {
          ...prev,
          [selectedMeal]: [...prev[selectedMeal], foodItem]
        };
        saveLog(selectedMeal, foodItem);
        return updated;
      });
    } else {
      Alert.alert('Food not found in database.');
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    addFoodToMeal(textInput.trim());
    setTextInput('');
  };

  const deleteItem = (meal, index) => {
    const newMealLog = [...log[meal]];
    newMealLog.splice(index, 1);
    setLog(prev => ({ ...prev, [meal]: newMealLog }));
    // Firestore does not have remove by index easily; would require overwriting array
    // We'll skip sync for deletion for now
  };

  const clearMeal = (meal) => {
    setLog(prev => ({ ...prev, [meal]: [] }));
    // Firestore: overwrite with empty array
    const docRef = doc(db, 'foodLogs', userId);
    setDoc(docRef, { ...log, [meal]: [] }, { merge: true });
  };

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
