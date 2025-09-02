import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

const HABITS_COLLECTION = 'habits';
const HABIT_LOGS_COLLECTION = 'habitLogs';

// Habits CRUD operations
export const createHabit = async (userId, habitData) => {
  try {
    const docRef = await addDoc(collection(db, HABITS_COLLECTION), {
      ...habitData,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating habit:', error);
    throw error;
  }
};

export const getUserHabits = async (userId) => {
  try {
    const q = query(
      collection(db, HABITS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching habits:', error);
    throw error;
  }
};

export const updateHabit = async (habitId, updates) => {
  try {
    const habitRef = doc(db, HABITS_COLLECTION, habitId);
    await updateDoc(habitRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating habit:', error);
    throw error;
  }
};

export const deleteHabit = async (habitId) => {
  try {
    await deleteDoc(doc(db, HABITS_COLLECTION, habitId));
  } catch (error) {
    console.error('Error deleting habit:', error);
    throw error;
  }
};

// Habit logging operations
export const logHabit = async (userId, habitId, date, completed = true) => {
  try {
    const logId = `${habitId}_${date}`;
    const docRef = doc(db, HABIT_LOGS_COLLECTION, logId);
    
    await updateDoc(docRef, {
      userId,
      habitId,
      date,
      completed,
      loggedAt: serverTimestamp()
    }).catch(async () => {
      // Document doesn't exist, create it
      await addDoc(collection(db, HABIT_LOGS_COLLECTION), {
        userId,
        habitId,
        date,
        completed,
        loggedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error('Error logging habit:', error);
    throw error;
  }
};

export const getHabitLogs = async (userId, startDate, endDate) => {
  try {
    const q = query(
      collection(db, HABIT_LOGS_COLLECTION),
      where('userId', '==', userId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching habit logs:', error);
    throw error;
  }
};
