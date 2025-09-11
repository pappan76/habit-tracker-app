import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

// Game Plans
export const saveGamePlan = async (userId, month, year, goals, weeklyProgress) => {
  const gamePlanRef = doc(db, 'gamePlans', `${userId}_${year}_${month}`);
  await setDoc(gamePlanRef, {
    userId,
    month,
    year,
    goals,
    weeklyProgress,
    updatedAt: serverTimestamp()
  }, { merge: true });
};


export const getGamePlan = async (userId, month, year) => {
  const gamePlanRef = doc(db, 'gamePlans', `${userId}_${year}_${month}`);
  const gamePlanDoc = await getDoc(gamePlanRef);
  return gamePlanDoc.exists() ? gamePlanDoc.data() : null;
};

// Upline Management
export const updateUserUplines = async (userId, uplineIds) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    selectedUplines: uplineIds,
    updatedAt: serverTimestamp()
  });
};

export const getAvailableUplines = async (currentUserId) => {
  const uplineQuery = query(
    collection(db, 'users'),
    where('isUpline', '==', true)
  );
  const uplineSnapshot = await getDocs(uplineQuery);
  
  return uplineSnapshot.docs
    .filter(doc => doc.id !== currentUserId) // Exclude self
    .map(doc => ({ id: doc.id, ...doc.data() }));
};
export const getUserDownlines = async (uplineUserId) => {
  const downlineQuery = query(
    collection(db, 'users'),
    where('selectedUplines', 'array-contains', uplineUserId)
  );
  const downlineSnapshot = await getDocs(downlineQuery);
  
  return downlineSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
// Tasks
export const createTask = async (taskData) => {
  const taskRef = doc(collection(db, 'tasks'));
  await setDoc(taskRef, {
    ...taskData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return taskRef.id;
};

export const getUserTasks = async (userId) => {
  const taskQuery = query(
    collection(db, 'tasks'),
    where('assignedTo', '==', userId)
  );
  const taskSnapshot = await getDocs(taskQuery);
  return taskSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateTask = async (taskId, updates) => {
  const taskRef = doc(db, 'tasks', taskId);
  await updateDoc(taskRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};