// screens/AuthScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

export default function AuthScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    if (!email || !password) return Alert.alert('Please enter both email and password');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        Alert.alert('Login successful!');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        Alert.alert('Account created! Logged in successfully.');
      }
      navigation.replace('FoodLog'); 
    } catch (err) {
      Alert.alert('Authentication Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLogin ? 'Login to Food Dude' : 'Register for Food Dude'}</Text>

      {/* Email Input */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* Password Input */}
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {/* Login/Register Button */}
      <TouchableOpacity style={styles.authButton} onPress={handleAuth}>
        <Text style={styles.authButtonText}>{isLogin ? 'Login' : 'Register'}</Text>
      </TouchableOpacity>

      {/* Toggle Login/Register */}
      <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
        <Text style={styles.toggleText}>
          {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
        </Text>
      </TouchableOpacity>

      {/* Google Login Placeholder */}
      <TouchableOpacity
        style={styles.googleButton}
        onPress={() => Alert.alert('Google login coming soon!')}
      >
        <Text style={styles.googleText}>Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8DC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
    color: '#1A237E',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#1A237E',
    padding: 12,
    marginVertical: 10,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  authButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 15,
    paddingHorizontal: 60,
    borderRadius: 30,
    marginTop: 15,
    marginBottom: 15,
  },
  authButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  toggleText: {
    marginBottom: 20,
    color: '#1A237E',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  googleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
