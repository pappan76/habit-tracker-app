// App.js - Complete Habit Tracker for Codespaces
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StatusBar,
  SafeAreaView,
  Platform,
} from 'react-native';

// Storage abstraction for web and mobile
let storage;
if (Platform.OS === 'web') {
  storage = {
    getItem: (key) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key, value) => Promise.resolve(localStorage.setItem(key, value)),
  };
} else {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  storage = AsyncStorage;
}

// Simple Icon Component (works on web without external dependencies)
const SimpleIcon = ({ name, size = 24, color = '#000' }) => {
  const iconMap = {
    'add': '+',
    'checkmark': '✓',
    'pencil': '✏️',
    'trash': '🗑️',
    'clipboard-outline': '📋',
  };
  
  return (
    <Text style={{ fontSize: size, color, textAlign: 'center', fontWeight: 'bold' }}>
      {iconMap[name] || '•'}
    </Text>
  );
};

// Helper function to calculate habit streak
const calculateStreak = (completedDates) => {
  if (completedDates.length === 0) return 0;
  
  const sortedDates = completedDates
    .map(date => new Date(date))
    .sort((a, b) => b - a);
  
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < sortedDates.length; i++) {
    const date = new Date(sortedDates[i]);
    date.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((today - date) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === i || (i === 0 && daysDiff <= 1)) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
};

// Habit Item Component
const HabitItem = ({ habit, onToggle, onDelete, onEdit }) => {
  const today = new Date().toDateString();
  const isCompletedToday = habit.completedDates.includes(today);
  const streak = calculateStreak(habit.completedDates);

  return (
    <View style={styles.habitItem}>
      <View style={styles.habitInfo}>
        <Text style={styles.habitTitle}>{habit.title}</Text>
        <Text style={styles.habitDescription}>{habit.description}</Text>
        <Text style={styles.streakText}>🔥 {streak} day streak</Text>
      </View>
      
      <View style={styles.habitActions}>
        <TouchableOpacity
          style={[
            styles.checkButton,
            isCompletedToday && styles.checkedButton
          ]}
          onPress={() => onToggle(habit.id)}
        >
          <SimpleIcon 
            name={isCompletedToday ? "checkmark" : "add"} 
            size={20} 
            color={isCompletedToday ? "#fff" : "#4CAF50"} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onEdit(habit)}
        >
          <SimpleIcon name="pencil" size={16} color="#2196F3" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onDelete(habit.id)}
        >
          <SimpleIcon name="trash" size={16} color="#f44336" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Add/Edit Habit Modal Component
const HabitModal = ({ visible, habit, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (habit) {
      setTitle(habit.title);
      setDescription(habit.description);
    } else {
      setTitle('');
      setDescription('');
    }
  }, [habit, visible]);

  const handleSave = () => {
    if (!title.trim()) {
      if (Platform.OS === 'web') {
        alert('Please enter a habit title');
      } else {
        Alert.alert('Error', 'Please enter a habit title');
      }
      return;
    }

    const habitData = {
      id: habit ? habit.id : Date.now().toString(),
      title: title.trim(),
      description: description.trim(),
      completedDates: habit ? habit.completedDates : [],
      createdAt: habit ? habit.createdAt : new Date().toISOString(),
    };

    onSave(habitData);
    setTitle('');
    setDescription('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {habit ? 'Edit Habit' : 'Add New Habit'}
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Habit title (e.g., 'Drink 8 glasses of water')"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />
          
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>
                {habit ? 'Update' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Statistics Component
const Statistics = ({ habits }) => {
  const totalHabits = habits.length;
  const today = new Date().toDateString();
  const completedToday = habits.filter(habit => 
    habit.completedDates.includes(today)
  ).length;
  
  const completionRate = totalHabits > 0 
    ? Math.round((completedToday / totalHabits) * 100) 
    : 0;

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{totalHabits}</Text>
        <Text style={styles.statLabel}>Total Habits</Text>
      </View>
      
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{completedToday}</Text>
        <Text style={styles.statLabel}>Completed Today</Text>
      </View>
      
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{completionRate}%</Text>
        <Text style={styles.statLabel}>Completion Rate</Text>
      </View>
    </View>
  );
};

// Main App Component
export default function App() {
  const [habits, setHabits] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load habits from storage on app start
  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = async () => {
    try {
      const stored = await storage.getItem('habits');
      if (stored) {
        setHabits(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading habits:', error);
      if (Platform.OS !== 'web') {
        Alert.alert('Error', 'Failed to load habits');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveHabits = async (newHabits) => {
    try {
      await storage.setItem('habits', JSON.stringify(newHabits));
      setHabits(newHabits);
    } catch (error) {
      console.error('Error saving habits:', error);
      if (Platform.OS !== 'web') {
        Alert.alert('Error', 'Failed to save habits');
      }
    }
  };

  const toggleHabit = (habitId) => {
    const today = new Date().toDateString();
    const newHabits = habits.map(habit => {
      if (habit.id === habitId) {
        const isCompleted = habit.completedDates.includes(today);
        const completedDates = isCompleted
          ? habit.completedDates.filter(date => date !== today)
          : [...habit.completedDates, today];
        
        return { ...habit, completedDates };
      }
      return habit;
    });
    
    saveHabits(newHabits);
  };

  const addOrEditHabit = (habitData) => {
    const newHabits = editingHabit
      ? habits.map(h => h.id === habitData.id ? habitData : h)
      : [...habits, habitData];
    
    saveHabits(newHabits);
    setModalVisible(false);
    setEditingHabit(null);
  };

  const deleteHabit = (habitId) => {
    const confirmDelete = Platform.OS === 'web' 
      ? confirm('Are you sure you want to delete this habit?')
      : true;
    
    if (confirmDelete) {
      if (Platform.OS !== 'web') {
        Alert.alert(
          'Delete Habit',
          'Are you sure you want to delete this habit? This action cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => performDelete(habitId),
            },
          ]
        );
      } else {
        performDelete(habitId);
      }
    }
  };

  const performDelete = (habitId) => {
    const newHabits = habits.filter(h => h.id !== habitId);
    saveHabits(newHabits);
  };

  const editHabit = (habit) => {
    setEditingHabit(habit);
    setModalVisible(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your habits...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {Platform.OS !== 'web' && (
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      )}
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>RWW Habit Tracker</Text>
          <Text style={styles.subtitle}>
            {Platform.OS === 'web' ? 'Running in Codespaces' : 'Mobile App'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <SimpleIcon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Statistics habits={habits} />

      {habits.length === 0 ? (
        <View style={styles.emptyState}>
          <SimpleIcon name="clipboard-outline" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>No habits yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Tap the + button to add your first habit and start building better routines!
          </Text>
        </View>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <HabitItem
              habit={item}
              onToggle={toggleHabit}
              onDelete={deleteHabit}
              onEdit={editHabit}
            />
          )}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <HabitModal
        visible={modalVisible}
        habit={editingHabit}
        onSave={addOrEditHabit}
        onCancel={() => {
          setModalVisible(false);
          setEditingHabit(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...(Platform.OS === 'web' && { 
      maxWidth: 500, 
      margin: '0 auto',
      minHeight: '100vh'
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    ...(Platform.OS === 'web' && { 
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    }),
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    ...(Platform.OS === 'web' && { 
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)',
    }),
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 15,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...(Platform.OS === 'web' && { 
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
    }),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  habitItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...(Platform.OS === 'web' && { 
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      transition: 'transform 0.2s ease',
    }),
  },
  habitInfo: {
    flex: 1,
  },
  habitTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  habitDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  streakText: {
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '500',
  },
  habitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' && { 
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
  },
  checkedButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 20,
    ...(Platform.OS === 'web' && { 
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
    }),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#999',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    ...(Platform.OS === 'web' && { outline: 'none' }),
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  cancelButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  saveButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});