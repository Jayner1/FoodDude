import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Button, Text, FlatList, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import foodDatabase from './foodDatabase.json';
import { OPENAI_API_KEY } from '@env';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [log, setLog] = useState([]);

  useEffect(() => {
    const loadLog = async () => {
      try {
        const savedLog = await AsyncStorage.getItem('@food_log');
        if (savedLog) setLog(JSON.parse(savedLog));
      } catch (err) {
        console.error('Failed to load log', err);
      }
    };
    loadLog();
  }, []);

  useEffect(() => {
    const saveLog = async () => {
      try {
        await AsyncStorage.setItem('@food_log', JSON.stringify(log));
      } catch (err) {
        console.error('Failed to save log', err);
      }
    };
    saveLog();
  }, [log]);

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
      console.log('Recording temporary file:', uri);

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
        if (err.response?.status === 429) {
          Alert.alert('Rate limit exceeded. Using mock transcription.');
        } else {
          console.error(err);
          Alert.alert('OpenAI transcription failed. Using mock transcription.');
        }
        text = 'Apple, medium'; // fallback
      }

      setTranscription(text);

      const foodItem = foodDatabase.find(
        f => f.foodName.toLowerCase() === text.toLowerCase()
      );

      if (foodItem) {
        setLog(prev => [...prev, foodItem]);
      } else {
        Alert.alert('Food not found in database.');
      }

      setRecording(null);
    } catch (err) {
      console.error(err);
      Alert.alert('Failed to stop recording.');
    }
  };

  const deleteItem = async index => {
    const newLog = [...log];
    newLog.splice(index, 1);
    setLog(newLog);
  };

  const clearLog = async () => {
    setLog([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Food Dude</Text>
      </View>

      <View style={styles.controls}>
        <Button title="Start Recording" onPress={startRecording} />
        <View style={{ height: 10 }} />
        <Button title="Stop Recording" onPress={stopRecording} />
      </View>

      <Text style={styles.transcription}>Transcription: {transcription}</Text>

      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>Food Log:</Text>
        <TouchableOpacity onPress={clearLog}>
          <Text style={styles.clearButton}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={log}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.logItem}>
            <Text style={styles.logText}>
              {item.foodName} - {item.calories} cal, {item.protein}g P, {item.carbs}g C, {item.fat}g F
            </Text>
            <TouchableOpacity onPress={() => deleteItem(index)} style={styles.deleteButton}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F5F5F5' },
  header: {
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    marginBottom: 20,
    borderRadius: 8,
  },
  headerText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  controls: { marginBottom: 20 },
  transcription: { marginBottom: 20, fontWeight: 'bold', fontSize: 16 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  logTitle: { fontWeight: 'bold', fontSize: 18 },
  clearButton: { color: 'red', fontWeight: 'bold' },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#ccc' },
  logText: { fontSize: 16 },
  deleteButton: { backgroundColor: '#FF5252', paddingHorizontal: 10, borderRadius: 5 },
  deleteText: { color: '#fff', fontWeight: 'bold' },
});
