import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in, navigate directly to FoodLog
        navigation.replace('FoodLog');
      } else {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1A237E" />
      </View>
    );
  }

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
    backgroundColor: '#FFD54F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#1A237E',
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
