import React, { useState } from 'react';
import { SafeAreaView, View, Button, Text, FlatList, Alert } from 'react-native';
import { Audio } from 'expo-av';
import axios from 'axios';
import foodDatabase from './foodDatabase.json';
import { OPENAI_API_KEY } from '@env';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [log, setLog] = useState([]);

  // Set iOS audio mode 11
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

      // Read file as binary
      const file = {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      };

      // Prepare form for OpenAI Whisper API
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
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
        // Fallback transcription for testing
        text = 'Apple, medium';
      }

      setTranscription(text);

      // Lookup in local DB
      const foodItem = foodDatabase.find(
        f => f.foodName.toLowerCase() === text.toLowerCase()
      );
      if (foodItem) {
        setLog([...log, foodItem]);
      } else {
        Alert.alert('Food not found in database.');
      }

      setRecording(null);

      // Delete temporary file immediately
    } catch (err) {
      console.error(err);
      Alert.alert('Failed to stop recording.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 20, flex: 1 }}>
        <View style={{ marginVertical: 10 }}>
          <Button title="Start Recording" onPress={startRecording} />
        </View>

        <View style={{ marginVertical: 10 }}>
          <Button title="Stop Recording" onPress={stopRecording} />
        </View>

        <Text style={{ marginVertical: 10, fontWeight: 'bold' }}>
          Transcription: {transcription}
        </Text>

        <Text style={{ marginTop: 20, fontWeight: 'bold' }}>Food Log:</Text>
        <FlatList
          data={log}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <Text>
              {item.foodName} - {item.calories} cal, {item.protein}g P, {item.carbs}g C, {item.fat}g F
            </Text>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
