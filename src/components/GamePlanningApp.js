import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Calendar, Target, Users, Plus, Check, Settings, Edit3, Save, X } from 'lucide-react';
import { collection, query, getDocs, doc, getDoc, setDoc, where, updateDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { debounce } from 'lodash'; // If you have lodash available
import ContactManagement from './ContactManagementPage';



const GamePlanningApp = ({ user, onRefreshData }) => {
  // State variables
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('goals');
  const [showUplineSelector, setShowUplineSelector] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isLoadingPartner, setIsLoadingPartner] = useState(false);

  // Partner
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [showPartnerSelector, setShowPartnerSelector] = useState(false);
  const [pendingPartnerRequests, setPendingPartnerRequests] = useState([]);
  const [showRemovePartnerModal, setShowRemovePartnerModal] = useState(false);
  const [isSharedPlan, setIsSharedPlan] = useState(false);
  const [sharedPlanId, setSharedPlanId] = useState(null);

  // Data states
  const [availableUplines, setAvailableUplines] = useState([]);
  const [userDownlines, setUserDownlines] = useState([]);
  const [selectedDownline, setSelectedDownline] = useState(null);
  const [viewingDownlineData, setViewingDownlineData] = useState(null);
  const [selectedUplines, setSelectedUplines] = useState([]);

  // Upline removal
  const [showRemoveUplineModal, setShowRemoveUplineModal] = useState(false);
  const [uplineToRemove, setUplineToRemove] = useState(null);

  // Default parameters
  const defaultParameters = useMemo(() => [
    { id: 'group_pv', name: 'Group PV', target: 0, unit: 'points' },
    { id: 'contacts_offline', name: 'Contacts - Offline', target: 0, unit: 'contacts' },
    { id: 'process_appointments', name: 'Process Appointments', target: 0, unit: 'appointments' },
    { id: 'skin_sessions', name: 'Skin Sessions', target: 0, unit: 'sessions' },
    { id: 'health_assessments', name: 'Health Assessments', target: 0, unit: 'assessments' },
    { id: 'launch', name: 'Launch', target: 0, unit: 'launches' }
  ], []);

  const [monthlyGoals, setMonthlyGoals] = useState(() => defaultParameters);
  const [customParameters, setCustomParameters] = useState([]);
  const [newCustomParam, setNewCustomParam] = useState({ name: '', target: 0, unit: '' });
  const [weeklyProgress, setWeeklyProgress] = useState({
    week1: {},
    week2: {},
    week3: {},
    week4: {}
  });

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium'
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Load tasks function - declared before use
  const loadTasks = useCallback(async (userId = null) => {
    try {
      const targetUserId = userId || user.uid;
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', targetUserId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [user.uid]);

  // Permission and utility functions
  const canEditDownlineData = useCallback(() => {
    if (!selectedDownline) return false;
    return selectedDownline.selectedUplines && 
           selectedDownline.selectedUplines.includes(user.uid);
  }, [selectedDownline, user.uid]);

  const isReadOnly = useMemo(() => {
    if (!selectedDownline) return false;
    return !canEditDownlineData() || !editMode;
  }, [selectedDownline, canEditDownlineData, editMode]);

  // Data loading functions
  const loadAvailableUplines = useCallback(async () => {
    try {
     // console.log('Loading available uplines...');
    // console.log('Current user UID:', user?.uid);
      
      if (!user?.uid) {
        console.log('No user UID available');
        return;
      }
      
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
     // console.log('Total users found:', usersSnapshot.docs.length);
      
      if (usersSnapshot.empty) {
        console.log('No users found in database');
        setAvailableUplines([]);
        return;
      }
      
      const uplines = usersSnapshot.docs
        .map(doc => {
          const data = doc.data();
         // console.log('Processing user:', doc.id, data);
          return {
            id: doc.id,
            name: data.displayName || data.name || 'Unknown User',
            email: data.email,
            role: data.role || 'User',
            photoURL: data.photoURL,
            selectedUplines: data.selectedUplines || []
          };
        })
        .filter(upline => {
          const isNotCurrentUser = upline.id !== user.uid;
         // console.log(`User ${upline.id} (${upline.name}): isNotCurrentUser = ${isNotCurrentUser}`);
          return isNotCurrentUser;
        });
      
      // console.log('Filtered uplines:', uplines);
      setAvailableUplines(uplines);
    } catch (error) {
      console.error('Error loading uplines:', error);
      setAvailableUplines([]);
    }
  }, [user?.uid]);

  const loadUserDownlines = useCallback(async () => {
    try {
      const downlineQuery = query(
        collection(db, 'users'),
        where('selectedUplines', 'array-contains', user.uid)
      );
      const downlineSnapshot = await getDocs(downlineQuery);
      
      const downlines = downlineSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setUserDownlines(downlines);
    } catch (error) {
      console.error('Error loading downlines:', error);
    }
  }, [user.uid]);

  const loadUserUplines = useCallback(async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setSelectedUplines(userData.selectedUplines || []);
      }
    } catch (error) {
      console.error('Error loading user uplines:', error);
    }
  }, [user.uid]);

  const isLoadingPartnerRef = useRef(false);

const loadUserPartner = useCallback(async () => {
  if (!user?.uid) return;
  console.log('Loading user partner for UID:', user.uid);

  // Check loading state without making it a dependency
  if (isLoadingPartner) return;
  
  setIsLoadingPartner(true);
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    console.log('User document fetched:', userDoc.exists());

    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.partnerId) {
        const partnerDoc = await getDoc(doc(db, 'users', userData.partnerId));
        if (partnerDoc.exists()) {
          setSelectedPartner({
            id: userData.partnerId,
            ...partnerDoc.data()
          });
          console.log('Partner loaded:', partnerDoc.data());
        }
      } else {
        setSelectedPartner(null);
      }
    }
  } catch (error) {
    console.error('Error loading partner:', error);
    setSelectedPartner(null);
  } finally {
    setIsLoadingPartner(false);
  }
}, [user?.uid]); // ✅ Only user.uid as dependency


  const loadPartnerRequests = useCallback(async () => {
    try {
      const requestsQuery = query(
        collection(db, 'partnerRequests'),
        where('requestedUserId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      
      const requests = [];
      for (const requestDoc of requestsSnapshot.docs) {
        const requestData = requestDoc.data();
        const requesterDoc = await getDoc(doc(db, 'users', requestData.requesterId));
        
        if (requesterDoc.exists()) {
          requests.push({
            id: requestDoc.id,
            ...requestData,
            requesterName: requesterDoc.data().displayName || requesterDoc.data().name
          });
        }
      }
      
      setPendingPartnerRequests(requests);
    } catch (error) {
      console.error('Error loading partner requests:', error);
    }
  }, [user.uid]);

// Add this check at the beginning of loadGamePlan
const loadGamePlan = useCallback(async (userId = null) => {
  if (!user?.uid || !auth.currentUser) {
    console.log('Authentication check failed');
    return;
  }

  try {
    let gamePlanRef;
    let gamePlanId;
    let isSharedGamePlan = false;
    let partnerId = null; // Declare it here

    if (userId) {
      // Loading downline data - use personal game plan
      gamePlanId = `${userId}_${selectedYear}_${selectedMonth}`;
      gamePlanRef = doc(db, 'gamePlans', gamePlanId);
    } else {
      // For current user: First check if they have a partner by checking their user document
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        partnerId = userData.partnerId; // Now it's properly assigned
      }
      console.log('Current user partnerId:', partnerId);
      if (partnerId) {
        // User has a partner - try to load shared game plan
        const sortedIds = [user.uid, partnerId].sort();
        gamePlanId = `shared_${sortedIds.join('_')}_${selectedYear}_${selectedMonth}`;
        gamePlanRef = doc(db, 'sharedGamePlans', gamePlanId);
        isSharedGamePlan = true;
        
        // Set partner info in state
        const partnerDoc = await getDoc(doc(db, 'users', partnerId));
        if (partnerDoc.exists()) {
          setSelectedPartner({
            id: partnerId,
            ...partnerDoc.data()
          });
        }
        
        setIsSharedPlan(true);
        setSharedPlanId(gamePlanId);
      } else {
        // No partner - load personal game plan
        gamePlanId = `${user.uid}_${selectedYear}_${selectedMonth}`;
        gamePlanRef = doc(db, 'gamePlans', gamePlanId);
        setSelectedPartner(null);
        setIsSharedPlan(false);
        setSharedPlanId(null);
      }
    }
    
    console.log(`Loading ${isSharedGamePlan ? 'shared' : 'personal'} game plan:`, gamePlanId);
    
    const gamePlanDoc = await getDoc(gamePlanRef);
    
    if (gamePlanDoc.exists()) {
      const data = gamePlanDoc.data();
      
      if (userId) {
        setViewingDownlineData(data);
      } else {
        setMonthlyGoals(data.monthlyGoals || defaultParameters);
        setCustomParameters(data.customParameters || []);
        setWeeklyProgress(data.weeklyProgress || { week1: {}, week2: {}, week3: {}, week4: {} });
      }
    } else {
      // Document doesn't exist - create it
      console.log('Document does not exist, creating...');
      
      const defaultData = {
        monthlyGoals: defaultParameters,
        customParameters: [],
        weeklyProgress: { week1: {}, week2: {}, week3: {}, week4: {} },
        month: selectedMonth,
        year: selectedYear,
        lastUpdated: new Date()
      };

      if (isSharedGamePlan && partnerId) { // Use partnerId here instead of selectedPartner
        defaultData.isShared = true;
        defaultData.partners = [user.uid, partnerId];
        
        // Get partner name from the partner document we already fetched
        const partnerDoc = await getDoc(doc(db, 'users', partnerId));
        const partnerData = partnerDoc.exists() ? partnerDoc.data() : {};
        
        defaultData.partnerNames = [
          user.displayName || user.name,
          partnerData.displayName || partnerData.name || 'Unknown Partner'
        ];
        defaultData.createdBy = user.uid;
      } else {
        defaultData.userId = userId || user.uid;
      }
      
      await setDoc(gamePlanRef, defaultData);
      
      if (userId) {
        setViewingDownlineData(defaultData);
      } else {
        setMonthlyGoals(defaultParameters);
        setCustomParameters([]);
        setWeeklyProgress({ week1: {}, week2: {}, week3: {}, week4: {} });
      }
    }
  } catch (error) {
    console.error('Error loading game plan:', error);
    // Set fallback state
    if (userId) {
      setViewingDownlineData({
        monthlyGoals: defaultParameters,
        customParameters: [],
        weeklyProgress: { week1: {}, week2: {}, week3: {}, week4: {} }
      });
    } else {
      setMonthlyGoals(defaultParameters);
      setCustomParameters([]);
      setWeeklyProgress({ week1: {}, week2: {}, week3: {}, week4: {} });
      setSelectedPartner(null);
      setIsSharedPlan(false);
      setSharedPlanId(null);
    }
  }
}, [user?.uid, selectedYear, selectedMonth, defaultParameters]);



 const sendPartnerRequest = useCallback(async (targetUserId, event) => {
  event?.preventDefault(); // Prevent form submission
  try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().partnerId) {
        alert('You already have a partner. Remove your current partner first.');
        return;
      }

      const targetDoc = await getDoc(doc(db, 'users', targetUserId));
      if (targetDoc.exists() && targetDoc.data().partnerId) {
        alert('This user already has a partner.');
        return;
      }

      const existingRequestQuery = query(
        collection(db, 'partnerRequests'),
        where('requesterId', '==', user.uid),
        where('requestedUserId', '==', targetUserId),
        where('status', '==', 'pending')
      );
      const existingRequestSnapshot = await getDocs(existingRequestQuery);
      
      if (!existingRequestSnapshot.empty) {
        alert('Partner request already sent to this user.');
        return;
      }

      const requestData = {
        requesterId: user.uid,
        requesterName: user.displayName || user.name,
        requestedUserId: targetUserId,
        status: 'pending',
        createdAt: new Date(),
        message: `${user.displayName || user.name} wants to be your game planning partner.`
      };

      await addDoc(collection(db, 'partnerRequests'), requestData);
      setShowPartnerSelector(false);
      
      alert('Partner request sent successfully!');
    } catch (error) {
      console.error('Error sending partner request:', error);
      alert('Error sending partner request.');
    }
  }, [user.uid, user.displayName, user.name]);

  const respondToPartnerRequest = async (requestId, accept) => {
    try {
      const requestRef = doc(db, 'partnerRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) return;
      
      const requestData = requestDoc.data();
      
      if (accept) {
        await updateDoc(doc(db, 'users', user.uid), {
          partnerId: requestData.requesterId
        });
        
        await updateDoc(doc(db, 'users', requestData.requesterId), {
          partnerId: user.uid
        });
        
        await updateDoc(requestRef, {
          status: 'accepted',
          respondedAt: new Date()
        });
        
        await loadUserPartner();
        await loadGamePlan();
        
      } else {
        await updateDoc(requestRef, {
          status: 'declined',
          respondedAt: new Date()
        });
      }
      
      await loadPartnerRequests();
    } catch (error) {
      console.error('Error responding to partner request:', error);
    }
  };

  const removePartner = useCallback(async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        partnerId: null
      });
      
      if (selectedPartner) {
        await updateDoc(doc(db, 'users', selectedPartner.id), {
          partnerId: null
        });
      }
      
      setSelectedPartner(null);
      setIsSharedPlan(false);
      setSharedPlanId(null);
      setShowRemovePartnerModal(false);
      
      await loadGamePlan();
    } catch (error) {
      console.error('Error removing partner:', error);
    }
  }, [user.uid, selectedPartner, loadGamePlan]);

  // Data saving function
  const saveGamePlan = useCallback(async (targetUserId = null) => {
    try {
      let gamePlanRef;
      let dataToSave;
      
      if (targetUserId && viewingDownlineData) {
        gamePlanRef = doc(db, 'gamePlans', `${targetUserId}_${selectedYear}_${selectedMonth}`);
        dataToSave = {
          ...viewingDownlineData,
          lastUpdated: new Date(),
          lastUpdatedBy: user.uid,
          lastUpdatedByName: user.displayName || user.name || 'Unknown User'
        };
      } else if (selectedPartner) {
        const sortedIds = [user.uid, selectedPartner.id].sort();
        const sharedGamePlanId = `shared_${sortedIds.join('_')}_${selectedYear}_${selectedMonth}`;
        gamePlanRef = doc(db, 'sharedGamePlans', sharedGamePlanId);
        
        dataToSave = {
          monthlyGoals,
          customParameters,
          weeklyProgress,
          month: selectedMonth,
          year: selectedYear,
          lastUpdated: new Date(),
          lastUpdatedBy: user.uid,
          lastUpdatedByName: user.displayName || user.name,
          isShared: true,
          partners: [user.uid, selectedPartner.id],
          partnerNames: [
            user.displayName || user.name,
            selectedPartner.displayName || selectedPartner.name
          ]
        };
      } else {
        gamePlanRef = doc(db, 'gamePlans', `${user.uid}_${selectedYear}_${selectedMonth}`);
        dataToSave = {
          monthlyGoals,
          customParameters,
          weeklyProgress,
          userId: user.uid,
          month: selectedMonth,
          year: selectedYear,
          lastUpdated: new Date()
        };
      }
      
      await setDoc(gamePlanRef, dataToSave, { merge: true });
      
      if (targetUserId) {
        await loadGamePlan(targetUserId);
      }
    } catch (error) {
      console.error('Error saving game plan:', error);
    }
  }, [user.uid, user.displayName, user.name, selectedYear, selectedMonth, monthlyGoals, customParameters, weeklyProgress, viewingDownlineData, loadGamePlan, selectedPartner]);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      console.log('Loading uplines...');
      await loadAvailableUplines();
      
      console.log('Loading user uplines...');
      await loadUserUplines();
      
      
      console.log('Loading partner requests...');
      await loadPartnerRequests();
      
     console.log('Loading downlines...');
     await loadUserDownlines();
      
      console.log('Loading game plan...');
      await loadGamePlan();
      
      console.log('Loading tasks...');
      await loadTasks();

     // console.log('Loading partner...');
      //await loadUserPartner();
      
      
      console.log('Initial data loading complete');
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadAvailableUplines, loadUserUplines, loadUserPartner, loadPartnerRequests, loadUserDownlines, loadGamePlan, loadTasks]);

  useEffect(() => {
    if (selectedDownline) {
      loadGamePlan(selectedDownline.id);
      loadTasks(selectedDownline.id);
      setEditMode(false);
    } else {
      setViewingDownlineData(null);
      loadGamePlan();
      loadTasks();
      setEditMode(false);
    }
  }, [selectedDownline, loadGamePlan, loadTasks]);

  

  useEffect(() => {
  if (user?.uid) {
    if (selectedDownline) {
      loadGamePlan(selectedDownline.id);
    } else {
      loadGamePlan();
    }
  }
}, [selectedMonth, selectedYear, user?.uid, selectedDownline?.id]); // Only depend on selectedDownline.id

  useEffect(() => {
  if (user?.uid && !selectedDownline) {
    loadGamePlan();
  }
}, [selectedPartner?.id, user?.uid, selectedDownline?.id]); // Use stable object properties

  useEffect(() => {
    if (user?.uid) {
      console.log('User authenticated, loading initial data...');
      loadInitialData();
    } else {
      console.log('User not authenticated yet');
    }
  }, [user?.uid, loadInitialData]);

  // Data manipulation functions
  const getDisplayData = () => {
    if (selectedDownline && viewingDownlineData) {
      return {
        monthlyGoals: viewingDownlineData.monthlyGoals || defaultParameters,
        weeklyProgress: viewingDownlineData.weeklyProgress || { week1: {}, week2: {}, week3: {}, week4: {} },
        customParameters: viewingDownlineData.customParameters || []
      };
    }
    return {
      monthlyGoals,
      weeklyProgress,
      customParameters
    };
  };

  const { monthlyGoals: displayGoals, weeklyProgress: displayProgress, customParameters: displayCustomParams } = getDisplayData();

  const getWeeksInMonth = (month, year) => {
    const weeks = [];
    for (let i = 1; i <= 4; i++) {
      weeks.push({
        number: i,
        start: (i - 1) * 7 + 1,
        end: i * 7
      });
    }
    return weeks;
  };
// Create debounced save function
const debouncedSave = useCallback(
  debounce((userId) => {
    if (userId) {
      saveGamePlan(userId);
    } else {
      saveGamePlan();
    }
  }, 500),
  [saveGamePlan]
);
  const updateGoalTarget = async (paramId, target) => {
  if (isReadOnly) return;
  
  if (selectedDownline && canEditDownlineData()) {
    setViewingDownlineData(prev => {
      if (!prev) return prev;
      
      const updated = { ...prev };
      if (paramId.startsWith('custom_')) {
        updated.customParameters = (prev.customParameters || []).map(param => 
          param.id === paramId ? { ...param, target: Number(target) } : param
        );
      } else {
        updated.monthlyGoals = (prev.monthlyGoals || defaultParameters).map(goal => 
          goal.id === paramId ? { ...goal, target: Number(target) } : goal
        );
      }
      
      return updated;
    });
    debouncedSave(selectedDownline.id);

  } else {
    // This is for shared plans or personal plans (no selectedDownline)
    if (paramId.startsWith('custom_')) {
      setCustomParameters(prev => {
        const updated = prev.map(param => 
          param.id === paramId ? { ...param, target: Number(target) } : param
        );
        return updated;
      });
      debouncedSave(); // ✅ No parameter for shared/personal plans
    } else {
      setMonthlyGoals(prev => {
        const updated = prev.map(goal => 
          goal.id === paramId ? { ...goal, target: Number(target) } : goal
        );
        return updated;
      });
      debouncedSave(); // ✅ No parameter for shared/personal plans
    }
  }
};

  const addCustomParameter = async (event) => {
  event?.preventDefault(); // Prevent form submission
  if (isReadOnly || !newCustomParam.name.trim()) return;
  
  const customParam = {
    id: `custom_${Date.now()}`,
    name: newCustomParam.name.trim(),
    target: Number(newCustomParam.target) || 0,
    unit: newCustomParam.unit.trim() || 'units'
  };

    if (selectedDownline && canEditDownlineData()) {
      setViewingDownlineData(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          customParameters: [...(prev.customParameters || []), customParam]
        };
        setTimeout(() => saveGamePlan(selectedDownline.id), 500);
        return updated;
      });
    } else {
      setCustomParameters(prev => {
        const updated = [...prev, customParam];
        setTimeout(() => saveGamePlan(), 500);
        return updated;
      });
    }
    
    setNewCustomParam({ name: '', target: 0, unit: '' });
  };

  const updateWeeklyProgress = async (week, paramId, value) => {
    if (isReadOnly) return;
    
    if (selectedDownline && canEditDownlineData()) {
      setViewingDownlineData(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          weeklyProgress: {
            ...prev.weeklyProgress,
            [week]: {
              ...prev.weeklyProgress[week],
              [paramId]: Number(value) || 0
            }
          }
        };
        setTimeout(() => saveGamePlan(selectedDownline.id), 500);
        return updated;
      });
    } else {
      setWeeklyProgress(prev => {
        const updated = {
          ...prev,
          [week]: {
            ...prev[week],
            [paramId]: Number(value) || 0
          }
        };
        setTimeout(() => saveGamePlan(), 500);
        return updated;
      });
    }
  };

  const toggleUplineSelection = async (uplineId) => {
    const newSelectedUplines = selectedUplines.includes(uplineId)
      ? selectedUplines.filter(id => id !== uplineId)
      : [...selectedUplines, uplineId];
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        selectedUplines: newSelectedUplines
      });
      
      setSelectedUplines(newSelectedUplines);
    } catch (error) {
      console.error('Error updating uplines:', error);
    }
  };

 const createTask = async (event) => {
  event?.preventDefault(); // Prevent form submission
  if (!newTask.title.trim()) return;
  
  try {
    const taskData = {
      ...newTask,
      assignedBy: user.uid,
      assignedByName: user.displayName || user.name,
      assignedTo: selectedDownline ? selectedDownline.id : user.uid,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
      const taskRef = doc(collection(db, 'tasks'));
      await setDoc(taskRef, taskData);

      if (selectedDownline) {
        loadTasks(selectedDownline.id);
      } else {
        loadTasks();
      }

      setNewTask({ title: '', description: '', dueDate: '', priority: 'medium' });
      setShowTaskModal(false);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const toggleTaskCompletion = async (taskId) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      const updatedTask = { ...task, completed: !task.completed, updatedAt: new Date() };
      
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        completed: updatedTask.completed,
        updatedAt: updatedTask.updatedAt
      });

      setTasks(prev => 
        prev.map(task => 
          task.id === taskId ? updatedTask : task
        )
      );
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const allParameters = [...displayGoals, ...displayCustomParams];
  const weeks = getWeeksInMonth(selectedMonth, selectedYear);

  const calculateProgress = (paramId) => {
    const goal = allParameters.find(p => p.id === paramId);
    if (!goal || goal.target === 0) return 0;
    
    const totalProgress = Object.values(displayProgress).reduce((sum, week) => {
      return sum + (week[paramId] || 0);
    }, 0);
    
    return Math.min((totalProgress / goal.target) * 100, 100);
  };

  // RENDER PART - HEADER AND BASIC STRUCTURE
  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 bg-gray-50 min-h-screen">
      {/* Loading Spinner */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Target className="text-blue-600" size={24} />
              <span className="hidden sm:inline">Game Planning Session</span>
              <span className="sm:hidden">Game Planning</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              {selectedDownline 
                ? `Viewing ${selectedDownline.displayName || selectedDownline.name}'s plan` 
                : 'Set monthly goals and track weekly progress'
              }
            </p>
            {selectedDownline && viewingDownlineData?.lastUpdatedBy && (
              <p className="text-xs text-gray-500 mt-1">
                Last updated by {viewingDownlineData.lastUpdatedByName || 'Unknown'} on{' '}
                {new Date(viewingDownlineData.lastUpdated?.toDate?.() || viewingDownlineData.lastUpdated).toLocaleDateString()}
              </p>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            {/* Edit Mode Toggle for Uplines */}
            {selectedDownline && canEditDownlineData() && (
              <button type="button"
                onClick={(e) => {
                   e.preventDefault(); setEditMode(!editMode)}}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                  editMode 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {editMode ? <Save size={16} /> : <Edit3 size={16} />}
                {editMode ? 'Save Mode' : 'Edit Mode'}
              </button>
            )}

            {/* Downline Selector */}
            {userDownlines.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select 
                  value={selectedDownline?.id || ''}
                  onChange={(e) => {
                    const downline = userDownlines.find(d => d.id === e.target.value);
                    setSelectedDownline(e.target.value ? downline : null);
                  }}
                  className="border border-gray-300 rounded-lg px-2 sm:px-3 py-1 sm:py-2 text-sm sm:text-base flex-1 sm:flex-none"
                >
                  <option value="">My Game Plan</option>
                  {userDownlines.map((downline) => (
                    <option key={downline.id} value={downline.id}>
                      {downline.displayName || downline.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Month/Year Selectors */}
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <Calendar size={16} className="text-gray-500 flex-shrink-0" />
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 sm:px-3 py-1 sm:py-2 text-sm sm:text-base flex-1 sm:flex-none"
              >
                {monthNames.map((month, index) => (
                  <option key={index} value={index}>{month}</option>
                ))}
              </select>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 sm:px-3 py-1 sm:py-2 text-sm sm:text-base"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status indicators */}
        {!selectedDownline && selectedPartner && (
          <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-800">
              <span className="font-medium">Shared Game Plan:</span> You and{' '}
              {selectedPartner.displayName || selectedPartner.name} are working together. 
              All goals and progress are shared between both partners.
            </p>
          </div>
        )}

        {!selectedDownline && !selectedPartner && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Individual Game Plan:</span> This is your personal game plan. 
              Add a partner in the Uplines tab to create shared goals.
            </p>
          </div>
        )}

        {/* Permission Banners */}
        {selectedDownline && !canEditDownlineData() && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <span className="font-medium">View Only:</span> You can view this user's game plan but cannot make changes.
            </p>
          </div>
        )}

        {selectedDownline && canEditDownlineData() && !editMode && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Edit Available:</span> You have permission to edit this user's game plan. Click "Edit Mode" to enable editing.
            </p>
          </div>
        )}

        {selectedDownline && editMode && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              <span className="font-medium">Edit Mode Active:</span> You are currently editing {selectedDownline.displayName || selectedDownline.name}'s game plan. Changes are auto-saved.
            </p>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border mb-4 sm:mb-6">
        <div className="flex border-b overflow-x-auto">
          {[
            { id: 'goals', label: 'Monthly Goals', icon: Target, shortLabel: 'Goals' },
            { id: 'tracking', label: 'Weekly Tracking', icon: Calendar, shortLabel: 'Tracking' },
            { id: 'uplines', label: 'Upline Management', icon: Users, shortLabel: 'Uplines' },
            { id: 'tasks', label: 'Tasks', icon: Check, shortLabel: 'Tasks' }
          ].map(tab => (
            <button type="button"
              key={tab.id}
              onClick={(e) => {
    e.preventDefault();setActiveTab(tab.id)}}
              className={`flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4 font-medium transition-colors whitespace-nowrap text-xs sm:text-sm ${
                activeTab === tab.id 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={16} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              Monthly Goals - {monthNames[selectedMonth]} {selectedYear}
            </h2>
          </div>

          {/* Default Parameters */}
          <div className="space-y-4 mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold text-gray-700">Core Parameters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {displayGoals.map(goal => (
                <div key={goal.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-medium text-gray-700 text-sm sm:text-base">{goal.name}</label>
                    <div className="text-xs sm:text-sm text-gray-500">{goal.unit}</div>
                  </div>
                  <input
                    type="number"
                    value={goal.target}
                    onChange={(e) => updateGoalTarget(goal.id, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                    placeholder="Enter target"
                    min="0"
                    disabled={isReadOnly}
                  />
                  <div className="mt-2">
                    <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                      <span>Progress</span>
                      <span>{calculateProgress(goal.id).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${calculateProgress(goal.id)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Parameters */}
          <div className="space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-700">Custom Parameters</h3>
            
            {displayCustomParams.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                {displayCustomParams.map(param => (
                  <div key={param.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-blue-50">
                    <div className="flex justify-between items-center mb-2">
                      <label className="font-medium text-gray-700 text-sm sm:text-base">{param.name}</label>
                      <div className="text-xs sm:text-sm text-gray-500">{param.unit}</div>
                    </div>
                    <input
                      type="number"
                      value={param.target}
                      onChange={(e) => updateGoalTarget(param.id, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                      placeholder="Enter target"
                      min="0"
                      disabled={isReadOnly}
                    />
                    <div className="mt-2">
                      <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                        <span>Progress</span>
                        <span>{calculateProgress(param.id).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${calculateProgress(param.id)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Custom Parameter */}
            {!isReadOnly && (
              <div className="border border-dashed border-gray-300 rounded-lg p-3 sm:p-4">
                <h4 className="font-medium text-gray-700 mb-3 text-sm sm:text-base">Add Custom Parameter</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Parameter name"
                    value={newCustomParam.name}
                    onChange={(e) => setNewCustomParam(prev => ({ ...prev, name: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  />
                  <input
                    type="number"
                    placeholder="Target"
                    value={newCustomParam.target}
                    onChange={(e) => setNewCustomParam(prev => ({ ...prev, target: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                    min="0"
                  />
                  <input
                    type="text"
                    placeholder="Unit (e.g., sessions)"
                    value={newCustomParam.unit}
                    onChange={(e) => setNewCustomParam(prev => ({ ...prev, unit: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  />
                  <button  type="button"
                    onClick={(e) => {e.preventDefault();addCustomParameter();}}
                    className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Add</span>
                    <span className="sm:hidden">+</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weekly Tracking Tab */}
      {activeTab === 'tracking' && (
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6">
            Weekly Progress - {monthNames[selectedMonth]} {selectedYear}
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold text-gray-700 text-xs sm:text-sm">
                    Parameter
                  </th>
                  <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700 text-xs sm:text-sm">
                    Monthly Goal
                  </th>
                  {weeks.map(week => (
                    <th key={week.number} className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700 text-xs sm:text-sm">
                      Week {week.number}
                      <div className="text-xs font-normal text-gray-500">
                        {week.start}-{week.end}
                      </div>
                    </th>
                  ))}
                  <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-700 text-xs sm:text-sm">
                    Total / Progress
                  </th>
                </tr>
              </thead>
              <tbody>
                {allParameters.map(param => {
                  const totalProgress = Object.values(displayProgress).reduce((sum, week) => {
                    return sum + (week[param.id] || 0);
                  }, 0);
                  const progressPercent = param.target > 0 ? (totalProgress / param.target) * 100 : 0;

                  return (
                    <tr key={param.id} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-2 sm:px-4 py-3 font-medium text-gray-800 text-xs sm:text-sm">
                        {param.name}
                        <div className="text-xs text-gray-500">{param.unit}</div>
                      </td>
                      <td className="border border-gray-200 px-2 sm:px-4 py-3 text-center font-semibold text-blue-600 text-xs sm:text-sm">
                        {param.target}
                      </td>
                      {weeks.map(week => (
                        <td key={week.number} className="border border-gray-200 px-1 sm:px-4 py-3">
                          <input
                            type="number"
                            value={displayProgress[`week${week.number}`]?.[param.id] || ''}
                            onChange={(e) => updateWeeklyProgress(`week${week.number}`, param.id, e.target.value)}
                            className="w-full border border-gray-300 rounded px-1 sm:px-2 py-1 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
                            placeholder="0"
                            min="0"
                            disabled={isReadOnly}
                          />
                        </td>
                      ))}
                      <td className="border border-gray-200 px-2 sm:px-4 py-3">
                        <div className="text-center">
                          <div className="font-semibold text-gray-800 text-xs sm:text-sm">{totalProgress}</div>
                          <div className="text-xs text-gray-600">{progressPercent.toFixed(1)}%</div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 mt-1">
                            <div 
                              className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                                progressPercent >= 100 ? 'bg-green-600' : 
                                progressPercent >= 75 ? 'bg-blue-600' : 
                                progressPercent >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                              }`}
                              style={{ width: `${Math.min(progressPercent, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Partner Management Section */}
      {activeTab === 'uplines' && !selectedDownline && (
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Partner Management</h2>
            {!selectedPartner && (
              <button type="button"
                onClick={(e) => {
    e.preventDefault(); setShowPartnerSelector(!showPartnerSelector)}}
                className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm sm:text-base"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Find Partner</span>
                <span className="sm:hidden">Find</span>
              </button>
            )}
          </div>

          {/* Current Partner */}
          {selectedPartner && (
            <div className="mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">Your Partner</h3>
              <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {(selectedPartner.displayName || selectedPartner.name || '').split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{selectedPartner.displayName || selectedPartner.name}</div>
                      <div className="text-sm text-gray-600">{selectedPartner.email}</div>
                      <div className="text-xs text-purple-600 font-medium">Game Planning Partner</div>
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => setShowRemovePartnerModal(true)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove Partner
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pending Partner Requests */}
          {pendingPartnerRequests.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">Partner Requests</h3>
              <div className="space-y-3">
                {pendingPartnerRequests.map(request => (
                  <div key={request.id} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-800">{request.requesterName}</div>
                        <div className="text-sm text-gray-600">{request.message}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(request.createdAt.toDate()).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button"
                          onClick={() => respondToPartnerRequest(request.id, true)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Accept
                        </button>
                        <button type="button"
                          onClick={() => respondToPartnerRequest(request.id, false)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Partner Selector */}
          {showPartnerSelector && !selectedPartner && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">Select Partner</h3>
              <div className="space-y-3">
                {availableUplines.filter(user => !user.partnerId).map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {(user.name || '').split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">{user.name}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => sendPartnerRequest(user.id)}
                      className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                    >
                      Send Request
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">About Partners:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• You can only have one partner at a time</li>
              <li>• Partners can share game plans and work toward common goals</li>
              <li>• Both partners can edit shared plans and track progress together</li>
              <li>• Partner requests must be accepted by both parties</li>
            </ul>
          </div>
        </div>
      )}

      {/* Uplines Tab - When viewing own data */}
      {activeTab === 'uplines' && !selectedDownline && (
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Upline Management</h2>
            <button type="button"
              onClick={() => setShowUplineSelector(!showUplineSelector)}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm sm:text-base"
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Manage Uplines</span>
              <span className="sm:hidden">Manage</span>
            </button>
          </div>

          {/* Current Uplines */}
          <div className="mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">Your Uplines</h3>
            {selectedUplines.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {selectedUplines.map(uplineId => {
                  const upline = availableUplines.find(u => u.id === uplineId);
                  return upline ? (
                    <div key={upline.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-green-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 sm:w-10 h-8 sm:h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {upline.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800 text-sm sm:text-base">{upline.name}</div>
                            <div className="text-xs sm:text-sm text-gray-600">{upline.role}</div>
                            <div className="text-xs text-gray-500">{upline.email}</div>
                          </div>
                        </div>
                       <button
                            type="button"
                            onClick={() => {
                              setUplineToRemove(upline);
                              setShowRemoveUplineModal(true);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors text-xs sm:text-sm"
                            title="Remove upline"
                          >
                            Remove
                          </button>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <Users size={40} className="mx-auto mb-4 text-gray-300" />
                <p className="text-sm sm:text-base">No uplines selected. Choose uplines to enable game planning visibility.</p>
              </div>
            )}
          </div>

          {/* Upline Selector */}
          {showUplineSelector && (
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">Available Uplines</h3>
              <div className="space-y-3">
                {availableUplines.map(upline => (
                  <div key={upline.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 sm:w-10 h-8 sm:h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {upline.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 text-sm sm:text-base">{upline.name}</div>
                        <div className="text-xs sm:text-sm text-gray-600">{upline.role}</div>
                        <div className="text-xs text-gray-500">{upline.email}</div>
                      </div>
                    </div> 
                    <button type="button"
                      onClick={() => toggleUplineSelection(upline.id)}
                      className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                        selectedUplines.includes(upline.id)
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {selectedUplines.includes(upline.id) ? 'Selected' : 'Select'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Permissions Info */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <h4 className="font-semibold text-blue-800 mb-2 text-sm sm:text-base">Permissions Granted to Selected Uplines:</h4>
            <ul className="text-xs sm:text-sm text-blue-700 space-y-1">
              <li>• View your monthly goals and weekly progress</li>
              <li>• Edit your goals and progress when in edit mode</li>
              <li>• Create and assign tasks to you</li>
              <li>• Access your game planning dashboard</li>
              <li>• Monitor your performance metrics</li>
            </ul>
          </div>
        </div>
      )}

      {/* Uplines Tab - When viewing downline */}
      {activeTab === 'uplines' && selectedDownline && (
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              {selectedDownline.displayName || selectedDownline.name}'s Uplines
            </h2>
          </div>

          <div className="mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-4">Selected Uplines</h3>
            {selectedDownline.selectedUplines && selectedDownline.selectedUplines.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {selectedDownline.selectedUplines.map(uplineId => {
                  const upline = availableUplines.find(u => u.id === uplineId);
                  return upline ? (
                    <div key={upline.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-green-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 sm:w-10 h-8 sm:h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {upline.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 text-sm sm:text-base">{upline.name}</div>
                          <div className="text-xs sm:text-sm text-gray-600">{upline.role}</div>
                          <div className="text-xs text-gray-500">{upline.email}</div>
                          {upline.id === user.uid && (
                            <div className="text-xs text-green-600 font-medium">You</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <Users size={40} className="mx-auto mb-4 text-gray-300" />
                <p className="text-sm sm:text-base">This user has not selected any uplines.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              Tasks {selectedDownline ? `for ${selectedDownline.displayName || selectedDownline.name}` : ''}
            </h2>
            <button type="button"
              onClick={() => setShowTaskModal(true)}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm sm:text-base"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Create Task</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {tasks.map(task => (
              <div key={task.id} className={`border rounded-lg p-3 sm:p-4 ${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <button type="button"
                      onClick={() => toggleTaskCompletion(task.id)}
                      className={`mt-1 w-4 sm:w-5 h-4 sm:h-5 rounded border-2 flex items-center justify-center ${
                        task.completed 
                          ? 'bg-green-600 border-green-600 text-white' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      disabled={selectedDownline && !canEditDownlineData()}
                    >
                      {task.completed && <Check size={12} />}
                    </button>
                    <div>
                      <h3 className={`font-semibold text-sm sm:text-base ${task.completed ? 'text-green-800 line-through' : 'text-gray-800'}`}>
                        {task.title}
                      </h3>
                      <p className={`text-xs sm:text-sm mt-1 ${task.completed ? 'text-green-600' : 'text-gray-600'}`}>
                        {task.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Assigned by: {task.assignedByName}</span>
                        {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          task.priority === 'high' ? 'bg-red-100 text-red-700' :
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {task.priority} priority
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {tasks.length === 0 && (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <Check size={40} className="mx-auto mb-4 text-gray-300" />
                <p className="text-sm sm:text-base">No tasks assigned yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Remove Upline Modal */}
      {showRemoveUplineModal && uplineToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <X size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Remove Upline</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-gray-700 mb-6">
                Are you sure you want to remove <strong>{uplineToRemove.name}</strong> as your upline? 
                They will no longer have access to view or edit your game plans.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRemoveUplineModal(false);
                    setUplineToRemove(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleUplineSelection(uplineToRemove.id);
                    setShowRemoveUplineModal(false);
                    setUplineToRemove(null);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Remove Upline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Task Creation Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Create New Task {selectedDownline ? `for ${selectedDownline.displayName || selectedDownline.name}` : ''}
                </h3>
                <button type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter task description"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button type="button"
                  onClick={createTask}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Create Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Partner Modal */}
      {showRemovePartnerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <X size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Remove Partner</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-gray-700 mb-6">
                Are you sure you want to remove <strong>{selectedPartner?.displayName || selectedPartner?.name}</strong> as your partner? 
                This will end your shared game planning and both of you will return to individual plans.
              </p>

              <div className="flex gap-3">
                <button type="button"
                  onClick={() => setShowRemovePartnerModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button type="button"
                  onClick={removePartner}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Remove Partner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamePlanningApp;