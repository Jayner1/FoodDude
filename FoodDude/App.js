import React, { useState } from 'react';
import { View, Button, Text, FlatList, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import foodDatabase from './foodDatabase.json';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [log, setLog] = useState([]);

  const startRecording = async () => {
    try {
      // Request microphone permission
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return alert('Microphone permission required.');

      // iOS audio mode setup
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      alert('Recording started. Speak now!');
    } catch (err) {
      console.error(err);
      alert('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording saved at', uri);

      // Mock transcription 
      const mockText = "Pizza, 1 slice";
      setTranscription(mockText);

      // Lookup in local DB
      const foodItem = foodDatabase.find(
        f => f.foodName.toLowerCase() === mockText.toLowerCase()
      );
      if (foodItem) {
        setLog([...log, foodItem]);
      } else {
        alert('Food not found in database.');
      }

      setRecording(null);
    } catch (err) {
      console.error(err);
      alert('Failed to stop recording');
    }
  };

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
