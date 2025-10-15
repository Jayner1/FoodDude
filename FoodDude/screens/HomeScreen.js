import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Food Dude</Text>

      {/* Optional hero image */}
      {/* <Image
        source={require('../assets/scale-flex.png')}
        style={styles.image}
        resizeMode="contain"
      /> */}

      <TouchableOpacity
        style={styles.getStartedButton}
        onPress={() => navigation.navigate('Auth')}
      >
        <Text style={styles.getStartedText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFD54F', // warm yellow/gold
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#1A237E', // dark navy contrast
    marginBottom: 40,
  },
  image: {
    width: 250,
    height: 250,
    marginBottom: 40,
  },
  getStartedButton: {
    backgroundColor: '#1A237E', 
    paddingVertical: 15,
    paddingHorizontal: 60,
    borderRadius: 30,
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD54F',
  },
});
