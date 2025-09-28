import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Target, Users, Plus, Check, Edit3, Save, X, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, query, getDocs, doc, getDoc, setDoc, where, updateDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const [isEditing, setIsEditing] = useState(false);

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

  const initialLoadComplete = React.useRef(false);
  // Permission functions
  const canEditDownlineData = useCallback(() => {
    if (!selectedDownline) return false;
    return selectedDownline.selectedUplines && 
           selectedDownline.selectedUplines.includes(user.uid);
  }, [selectedDownline, user.uid]);

  const isReadOnly = useMemo(() => {
    if (!selectedDownline) return false;
    return !canEditDownlineData() || !editMode;
  }, [selectedDownline, canEditDownlineData, editMode]);
 
  // Load tasks function
const loadTasks = useCallback(async () => {
  try {
    let targetUserIds = [];
    if (selectedDownline) {
      targetUserIds.push(selectedDownline.id);
      if (selectedDownline.partnerId) {
        targetUserIds.push(selectedDownline.partnerId);
      }
    } else {
      targetUserIds.push(user.uid);
      if (selectedPartner?.id || user.partnerId) {
        targetUserIds.push(selectedPartner?.id || user.partnerId);
      }
    }
    targetUserIds = Array.from(new Set(targetUserIds.filter(Boolean)));
    let tasksData = [];
    for (const uid of targetUserIds) {
      const q = query(collection(db, 'tasks'), where('assignedTo', '==', uid));
      const snapshot = await getDocs(q);
      tasksData = tasksData.concat(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    const uniqueTasks = Array.from(new Map(tasksData.map(t => [t.id, t])).values());
    setTasks(uniqueTasks);
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}, [user.uid, selectedDownline?.id, selectedDownline?.partnerId, selectedPartner?.id, user.partnerId]);


  const loadAvailableUplines = useCallback(async () => {
    try {
      if (!user?.uid) return;
      
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      const uplines = usersSnapshot.docs
  .map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.displayName || data.name || 'Unknown User',
      email: data.email,
      role: data.role || 'User',
      photoURL: data.photoURL,
      selectedUplines: data.selectedUplines || []
    };
  })
  .filter(upline => upline.id !== user.uid); // This filters out only the current user
      
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

  const loadUserPartner = useCallback(async () => {
    if (!user?.uid) return;
    
    if (isLoadingPartner) return;
    
    setIsLoadingPartner(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.partnerId) {
          const partnerDoc = await getDoc(doc(db, 'users', userData.partnerId));
          if (partnerDoc.exists()) {
            setSelectedPartner({
              id: userData.partnerId,
              ...partnerDoc.data()
            });
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
  }, [user?.uid]);

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

  const loadGamePlan = useCallback(async (userId = null) => {
  if (!user?.uid || !auth.currentUser) return;

  if (isLoading) return;
  setIsLoading(true);
  try {
    let gamePlanRef;
    let gamePlanId;
    let isSharedGamePlan = false;
    let partnerId = null;
    let partnerInfo = null;
    let downlineUserData = null;
    let uplinesInfo = []; // Define it here at the top level

    if (userId) {
      // Fetch fresh downline data from Firestore
      const downlineDoc = await getDoc(doc(db, 'users', userId));
      if (!downlineDoc.exists()) {
        console.error('Downline user document not found');
        setIsLoading(false);
        return;
      }
      
      downlineUserData = { id: userId, ...downlineDoc.data() };
      const downlineData = downlineDoc.data();
      partnerId = downlineData.partnerId;
      
      // Get uplines info
     if (downlineUserData.selectedUplines && downlineUserData.selectedUplines.length > 0) {
        console.log('Downline selectedUplines:', downlineUserData.selectedUplines);
        console.log('Available uplines:', availableUplines);
        
        // Check for invalid upline IDs
        const invalidUplines = downlineUserData.selectedUplines.filter(
          uplineId => !availableUplines.find(u => u.id === uplineId)
        );
        
        if (invalidUplines.length > 0) {
          console.warn('Invalid upline IDs found:', invalidUplines);
          // Optionally: clean them up from Firestore
        }
        
        uplinesInfo = downlineUserData.selectedUplines
          .map(uplineId => availableUplines.find(u => u.id === uplineId))
          .filter(Boolean);
        
        console.log('Final uplinesInfo:', uplinesInfo);
      }
      
      // Get partner info if exists
      if (partnerId) {
        const partnerDoc = await getDoc(doc(db, 'users', partnerId));
        if (partnerDoc.exists()) {
          partnerInfo = {
            id: partnerId,
            name: partnerDoc.data().displayName || partnerDoc.data().name || 'Unknown Partner'
          };
        }
      }
      
      const month = String(selectedMonth).padStart(2, '0');
      const gameplanId = `${userId}_${selectedYear}_${month}`;
      gamePlanRef = doc(db, 'gameplans', gameplanId);
      
    } else {
      // User's own game plan
      if (selectedPartner) {
        // Handle shared game plan
        const month = String(selectedMonth).padStart(2, '0');
        const userPartnerGameplanId = `${user.uid}_${selectedPartner.id}_${selectedYear}_${month}`;
        const partnerUserGameplanId = `${selectedPartner.id}_${user.uid}_${selectedYear}_${month}`;
        
        const userPartnerRef = doc(db, 'sharedGameplans', userPartnerGameplanId);
        const partnerUserRef = doc(db, 'sharedGameplans', partnerUserGameplanId);
        
        const userPartnerDoc = await getDoc(userPartnerRef);
        const partnerUserDoc = await getDoc(partnerUserRef);
        
        if (userPartnerDoc.exists()) {
          gamePlanRef = userPartnerRef;
          gamePlanId = userPartnerGameplanId;
          isSharedGamePlan = true;
        } else if (partnerUserDoc.exists()) {
          gamePlanRef = partnerUserRef;
          gamePlanId = partnerUserGameplanId;
          isSharedGamePlan = true;
        } else {
          gamePlanId = userPartnerGameplanId;
          gamePlanRef = doc(db, 'sharedGameplans', gamePlanId);
          isSharedGamePlan = true;
        }
      } else {
        const month = String(selectedMonth).padStart(2, '0');
        gamePlanId = `${user.uid}_${selectedYear}_${month}`;
        gamePlanRef = doc(db, 'gameplans', gamePlanId);
      }
    }
    
    const gamePlanDoc = await getDoc(gamePlanRef);
    
    if (gamePlanDoc.exists()) {
      const data = gamePlanDoc.data();
      
      const monthlyGoalsData = data.monthlyGoals || defaultParameters;
      const customParamsData = data.customParameters || [];
      const weeklyProgressData = data.weeklyProgress || {
        week1: {},
        week2: {},
        week3: {},
        week4: {}
      };
      
      setMonthlyGoals(monthlyGoalsData);
      setCustomParameters(customParamsData);
      setWeeklyProgress(weeklyProgressData);
      
      if (userId) {
        setViewingDownlineData({
          monthlyGoals: monthlyGoalsData,
          customParameters: customParamsData,
          weeklyProgress: weeklyProgressData,
          hasPartner: !!partnerId,
          partnerInfo,
          uplinesInfo
        });
      }
      
    } else {
      // Game plan doesn't exist, create default
      if (userId) {
        setViewingDownlineData({
          monthlyGoals: defaultParameters,
          customParameters: [],
          weeklyProgress: {
            week1: {},
            week2: {},
            week3: {},
            week4: {}
          },
          hasPartner: !!partnerId,
          partnerInfo,
          uplinesInfo
        });
        
        setMonthlyGoals(defaultParameters);
        setCustomParameters([]);
        setWeeklyProgress({
          week1: {},
          week2: {},
          week3: {},
          week4: {}
        });
      } else {
        const defaultData = {
          monthlyGoals: defaultParameters,
          customParameters: [],
          weeklyProgress: {
            week1: {},
            week2: {},
            week3: {},
            week4: {}
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        setMonthlyGoals(defaultParameters);
        setCustomParameters([]);
        setWeeklyProgress({
          week1: {},
          week2: {},
          week3: {},
          week4: {}
        });
        
        await setDoc(gamePlanRef, defaultData);
      }
    }
  } catch (error) {
    console.error("Error loading game plan:", error);
  } finally {
    setIsLoading(false);
  }
}, [user?.uid, selectedYear, selectedMonth, defaultParameters, availableUplines, selectedPartner]);

// Partner management
  const sendPartnerRequest = useCallback(async (targetUserId, event) => {
    event?.preventDefault();
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

  // Update goal target
  const updateGoalTarget = async (paramId, target) => {
  if (isReadOnly) return;
  
  setIsEditing(true);
  
  try {
    if (selectedDownline && canEditDownlineData()) {
      const gamePlanRef = selectedDownline.partnerId 
        ? doc(db, 'sharedGamePlans', `shared_${[selectedDownline.id, selectedDownline.partnerId].sort().join('_')}_${selectedYear}_${selectedMonth}`)
        : doc(db, 'gamePlans', `${selectedDownline.id}_${selectedYear}_${selectedMonth}`);
      
      const currentDoc = await getDoc(gamePlanRef);
      const currentData = currentDoc.exists() ? currentDoc.data() : {
        monthlyGoals: defaultParameters,
        customParameters: [],
        weeklyProgress: { week1: {}, week2: {}, week3: {}, week4: {} }
      };
      
      if (paramId.startsWith('custom_')) {
        const paramIndex = currentData.customParameters.findIndex(p => p.id === paramId);
        if (paramIndex >= 0) {
          currentData.customParameters[paramIndex].target = Number(target);
        }
      } else {
        const goalIndex = currentData.monthlyGoals.findIndex(g => g.id === paramId);
        if (goalIndex >= 0) {
          currentData.monthlyGoals[goalIndex].target = Number(target);
        }
      }
      
      currentData.lastUpdated = new Date();
      currentData.lastUpdatedBy = user.uid;
      currentData.lastUpdatedByName = user.displayName || user.name;
      
      await setDoc(gamePlanRef, currentData);
      
      setViewingDownlineData(prev => ({
        ...prev,
        ...currentData
      }));
    } else {
      // For personal or shared plan
      let gamePlanRef;
      
      if (isSharedPlan && sharedPlanId) {
        gamePlanRef = doc(db, 'sharedGamePlans', sharedPlanId);
      } else {
        gamePlanRef = doc(db, 'gamePlans', `${user.uid}_${selectedYear}_${selectedMonth}`);
      }
      
      const currentDoc = await getDoc(gamePlanRef);
      const currentData = currentDoc.exists() ? currentDoc.data() : {
        monthlyGoals: defaultParameters,
        customParameters: [],
        weeklyProgress: { week1: {}, week2: {}, week3: {}, week4: {} },
        userId: user.uid,
        month: selectedMonth,
        year: selectedYear
      };
      
      if (paramId.startsWith('custom_')) {
        const paramIndex = currentData.customParameters.findIndex(p => p.id === paramId);
        if (paramIndex >= 0) {
          currentData.customParameters[paramIndex].target = Number(target);
        }
      } else {
        const goalIndex = currentData.monthlyGoals.findIndex(g => g.id === paramId);
        if (goalIndex >= 0) {
          currentData.monthlyGoals[goalIndex].target = Number(target);
        }
      }
      
      currentData.lastUpdated = new Date();
      await setDoc(gamePlanRef, currentData);
      
      // Update React state to reflect changes immediately
      if (paramId.startsWith('custom_')) {
        setCustomParameters(currentData.customParameters);
      } else {
        setMonthlyGoals(currentData.monthlyGoals);
      }
    }
  } catch (error) {
    console.error('Error updating goal:', error);
  } finally {
    setTimeout(() => setIsEditing(false), 1000);
  }
};

  const addCustomParameter = async (event) => {
    event?.preventDefault();
    if (isReadOnly || !newCustomParam.name.trim()) return;
    
    const customParam = {
      id: `custom_${Date.now()}`,
      name: newCustomParam.name.trim(),
      target: Number(newCustomParam.target) || 0,
      unit: newCustomParam.unit.trim() || 'units'
    };

    setIsEditing(true);
    
    try {
      if (selectedDownline && canEditDownlineData()) {
        const gamePlanRef = selectedDownline.partnerId 
          ? doc(db, 'sharedGamePlans', `shared_${[selectedDownline.id, selectedDownline.partnerId].sort().join('_')}_${selectedYear}_${selectedMonth}`)
          : doc(db, 'gamePlans', `${selectedDownline.id}_${selectedYear}_${selectedMonth}`);
        
        const currentDoc = await getDoc(gamePlanRef);
        const currentData = currentDoc.exists() ? currentDoc.data() : { customParameters: [] };
        
        currentData.customParameters = [...(currentData.customParameters || []), customParam];
        currentData.lastUpdated = new Date();
        
        await setDoc(gamePlanRef, currentData, { merge: true });
        
        setViewingDownlineData(prev => ({
          ...prev,
          customParameters: currentData.customParameters
        }));
      } else {
        const gamePlanRef = doc(db, 'gamePlans', `${user.uid}_${selectedYear}_${selectedMonth}`);
        const currentDoc = await getDoc(gamePlanRef);
        const currentData = currentDoc.exists() ? currentDoc.data() : { customParameters: [] };
        
        currentData.customParameters = [...(currentData.customParameters || []), customParam];
        currentData.lastUpdated = new Date();
        
        await setDoc(gamePlanRef, currentData, { merge: true });
        setCustomParameters(currentData.customParameters);
      }
      
      setNewCustomParam({ name: '', target: 0, unit: '' });
    } catch (error) {
      console.error('Error adding custom parameter:', error);
    } finally {
      setTimeout(() => setIsEditing(false), 1000);
    }
  };

  const updateWeeklyProgress = async (week, paramId, value) => {
    if (isReadOnly) return;
    
    setIsEditing(true);
    
    try {
      if (selectedDownline && canEditDownlineData()) {
        const gamePlanRef = selectedDownline.partnerId 
          ? doc(db, 'sharedGamePlans', `shared_${[selectedDownline.id, selectedDownline.partnerId].sort().join('_')}_${selectedYear}_${selectedMonth}`)
          : doc(db, 'gamePlans', `${selectedDownline.id}_${selectedYear}_${selectedMonth}`);
        
        const currentDoc = await getDoc(gamePlanRef);
        const currentData = currentDoc.exists() ? currentDoc.data() : {
          monthlyGoals: defaultParameters,
          customParameters: [],
          weeklyProgress: { week1: {}, week2: {}, week3: {}, week4: {} }
        };
        
        if (!currentData.weeklyProgress) currentData.weeklyProgress = {};
        if (!currentData.weeklyProgress[week]) currentData.weeklyProgress[week] = {};
        currentData.weeklyProgress[week][paramId] = Number(value) || 0;
        
        currentData.lastUpdated = new Date();
        currentData.lastUpdatedBy = user.uid;
        currentData.lastUpdatedByName = user.displayName || user.name;
        
        await setDoc(gamePlanRef, currentData);
        
        setViewingDownlineData(prev => ({
          ...prev,
          weeklyProgress: currentData.weeklyProgress
        }));
      } else {
        if (isSharedPlan && sharedPlanId) {
          const sharedGamePlanRef = doc(db, 'sharedGamePlans', sharedPlanId);
          const sharedDoc = await getDoc(sharedGamePlanRef);
          const sharedData = sharedDoc.exists() ? sharedDoc.data() : {
            monthlyGoals: defaultParameters,
            customParameters: [],
            weeklyProgress: { week1: {}, week2: {}, week3: {}, week4: {} }
          };
          
          if (!sharedData.weeklyProgress) sharedData.weeklyProgress = {};
          if (!sharedData.weeklyProgress[week]) sharedData.weeklyProgress[week] = {};
          sharedData.weeklyProgress[week][paramId] = Number(value) || 0;
          
          sharedData.lastUpdated = new Date();
          
          await setDoc(sharedGamePlanRef, sharedData);
          setWeeklyProgress(sharedData.weeklyProgress);
        } else {
          const gamePlanRef = doc(db, 'gamePlans', `${user.uid}_${selectedYear}_${selectedMonth}`);
          
          const currentDoc = await getDoc(gamePlanRef);
          const currentData = currentDoc.exists() ? currentDoc.data() : {
            monthlyGoals: defaultParameters,
            customParameters: [],
            weeklyProgress: { week1: {}, week2: {}, week3: {}, week4: {} },
            userId: user.uid,
            month: selectedMonth,
            year: selectedYear
          };
          
          if (!currentData.weeklyProgress) currentData.weeklyProgress = {};
          if (!currentData.weeklyProgress[week]) currentData.weeklyProgress[week] = {};
          currentData.weeklyProgress[week][paramId] = Number(value) || 0;
          
          currentData.lastUpdated = new Date();
          await setDoc(gamePlanRef, currentData);
          setWeeklyProgress(currentData.weeklyProgress);
        }
      }
    } catch (error) {
      console.error('Error updating weekly progress:', error);
    } finally {
      setTimeout(() => setIsEditing(false), 1000);
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
    event?.preventDefault();
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

  // Helper functions
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

  const getWeeksInMonth = () => {
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

  const allParameters = [...displayGoals, ...displayCustomParams];
  const weeks = getWeeksInMonth();

  const calculateProgress = (paramId) => {
    const goal = allParameters.find(p => p.id === paramId);
    if (!goal || goal.target === 0) return 0;
    
    const totalProgress = Object.values(displayProgress).reduce((sum, week) => {
      return sum + (week[paramId] || 0);
    }, 0);
    
    return Math.min((totalProgress / goal.target) * 100, 100);
  };

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      await loadAvailableUplines();
      await loadUserUplines();
      await loadPartnerRequests();
      await loadUserDownlines();
      await loadGamePlan();
      await loadTasks();
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadAvailableUplines, loadUserUplines, loadPartnerRequests, loadUserDownlines, loadGamePlan, loadTasks]);

  useEffect(() => {
  const loadDownlineData = async () => {
    if (selectedDownline) {
      // First ensure uplines are loaded
      if (availableUplines.length === 0) {
        await loadAvailableUplines();
      }
      // Then load the game plan
      await loadGamePlan(selectedDownline.id);
      await loadTasks(selectedDownline.id);
      setEditMode(false);
    } else {
      setViewingDownlineData(null);
      loadGamePlan();
      loadTasks();
      setEditMode(false);
    }
  };
  
  loadDownlineData();
}, [selectedDownline?.id]);

  useEffect(() => {
    if (user?.uid && !selectedDownline && !isEditing) {
      loadGamePlan();
    }
  }, [user?.uid, selectedYear, selectedMonth, loadGamePlan]);

  // Add a separate effect for handling downline changes
useEffect(() => {
  if (selectedDownline?.id) {
    // Consider adding a flag to prevent duplicate loads
    loadGamePlan(selectedDownline.id);
  }
}, [selectedDownline?.id, loadGamePlan]);

useEffect(() => {
  if (user?.uid && !initialLoadComplete.current) {
    initialLoadComplete.current = true;
    loadInitialData();
  }
}, [user?.uid, loadInitialData]);

  // Update useEffect to only depend on selectedDownline and selectedPartner?.id:
  useEffect(() => {
    loadTasks();
  }, [selectedDownline?.id, selectedDownline?.partnerId, selectedPartner?.id, user.uid, user.partnerId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="text-lg text-gray-700 font-medium">Loading game plan...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Target className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Game Planning</h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  {selectedDownline 
                    ? `${selectedDownline.displayName || selectedDownline.name}'s plan` 
                    : 'Track your goals'
                  }
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            <div className="hidden lg:flex items-center gap-3">
              {selectedDownline && canEditDownlineData() && (
                <button
                  onClick={(e) => { e.preventDefault(); setEditMode(!editMode); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium ${
                    editMode 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {editMode ? <Save size={16} /> : <Edit3 size={16} />}
                  {editMode ? 'Editing' : 'Edit'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Menu</h3>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-3">
              {selectedDownline && canEditDownlineData() && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setEditMode(!editMode);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl transition-colors font-medium ${
                    editMode 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {editMode ? <Save size={16} /> : <Edit3 size={16} />}
                  {editMode ? 'Save Mode' : 'Edit Mode'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Partner Banner */}
        {selectedPartner && !selectedDownline && (
          <div className="mb-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg mb-1">Shared Game Plan</h3>
                <p className="text-purple-100 text-sm">
                  Planning together with {selectedPartner.displayName || selectedPartner.name}
                </p>
              </div>
              <button
                onClick={() => setShowRemovePartnerModal(true)}
                className="hidden sm:block px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                Manage
              </button>
            </div>
          </div>
        )}

        {/* Month Navigator & Downline Selector */}
        <div className="mb-6 bg-white rounded-2xl shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Month Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 font-medium"
                >
                  {monthNames.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
                
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 font-medium"
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                </select>
              </div>
              
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Downline Selector */}
            {userDownlines.length > 0 && (
              <select 
                value={selectedDownline?.id || ''}
                onChange={(e) => {
                  const downline = userDownlines.find(d => d.id === e.target.value);
                  setSelectedDownline(e.target.value ? downline : null);
                }}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 font-medium w-full sm:w-auto"
              >
                <option value="">My Game Plan</option>
                {userDownlines.map((downline) => (
                  <option key={downline.id} value={downline.id}>
                    {downline.displayName || downline.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Status Messages */}
          {selectedDownline && viewingDownlineData?.hasPartner && (
            <div className="mt-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-purple-800 mb-2">Partnership Game Plan</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/50 rounded-lg p-3 border border-purple-200/50">
                      <div className="font-medium text-purple-700">Partner 1</div>
                      <div className="text-purple-800">{selectedDownline.displayName || selectedDownline.name}</div>
                    </div>
                    <div className="bg-white/50 rounded-lg p-3 border border-purple-200/50">
                      <div className="font-medium text-purple-700">Partner 2</div>
                      <div className="text-purple-800">{viewingDownlineData.partnerInfo?.name}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg mb-6 overflow-hidden">
          <div className="flex overflow-x-auto">
            {[
              { id: 'goals', label: 'Goals', icon: Target },
              { id: 'tracking', label: 'Tracking', icon: Calendar },
              { id: 'uplines', label: 'Team', icon: Users },
              { id: 'tasks', label: 'Tasks', icon: Check }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={(e) => { e.preventDefault(); setActiveTab(tab.id); }}
                className={`flex items-center gap-2 px-4 sm:px-6 py-4 font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <tab.icon size={18} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Goals Tab */}
        {activeTab === 'goals' && (
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Monthly Goals - {monthNames[selectedMonth]} {selectedYear}
              </h2>
            </div>

            {/* Core Parameters */}
            <div className="space-y-4 mb-8">
              <h3 className="text-lg font-semibold text-gray-700">Core Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayGoals.map(goal => (
                  <div key={goal.id} className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-2">
                      <label className="font-medium text-gray-700">{goal.name}</label>
                      <span className="text-sm text-gray-500">{goal.unit}</span>
                    </div>
                    <input
                      type="number"
                      value={goal.target}
                      onChange={(e) => updateGoalTarget(goal.id, e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter target"
                      min="0"
                      disabled={isReadOnly}
                    />
                    <div className="mt-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span className="font-semibold">{calculateProgress(goal.id).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
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
              <h3 className="text-lg font-semibold text-gray-700">Custom Parameters</h3>
              
              {displayCustomParams.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {displayCustomParams.map(param => (
                    <div key={param.id} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                      <div className="flex justify-between items-center mb-2">
                        <label className="font-medium text-gray-700">{param.name}</label>
                        <span className="text-sm text-gray-500">{param.unit}</span>
                      </div>
                      <input
                        type="number"
                        value={param.target}
                        onChange={(e) => updateGoalTarget(param.id, e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Enter target"
                        min="0"
                        disabled={isReadOnly}
                      />
                      <div className="mt-3">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Progress</span>
                          <span className="font-semibold">{calculateProgress(param.id).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-500"
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
                <div className="border border-dashed border-gray-300 rounded-xl p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-700 mb-3">Add Custom Parameter</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                      type="text"
                      placeholder="Parameter name"
                      value={newCustomParam.name}
                      onChange={(e) => setNewCustomParam(prev => ({ ...prev, name: e.target.value }))}
                      className="border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Target"
                      value={newCustomParam.target}
                      onChange={(e) => setNewCustomParam(prev => ({ ...prev, target: e.target.value }))}
                      className="border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                    />
                    <input
                      type="text"
                      placeholder="Unit"
                      value={newCustomParam.unit}
                      onChange={(e) => setNewCustomParam(prev => ({ ...prev, unit: e.target.value }))}
                      className="border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={addCustomParameter}
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-medium"
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Continue in next message for remaining tabs and modals */}
        {/* Weekly Tracking Tab */}
        {activeTab === 'tracking' && (
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Weekly Progress - {monthNames[selectedMonth]} {selectedYear}
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-blue-50">
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                      Parameter
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-700">
                      Goal
                    </th>
                    {weeks.map(week => (
                      <th key={week.number} className="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-700">
                        Week {week.number}
                        <div className="text-xs font-normal text-gray-500">
                          {week.start}-{week.end}
                        </div>
                      </th>
                    ))}
                    <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-700">
                      Progress
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
                        <td className="border border-gray-200 px-4 py-3 font-medium text-gray-800">
                          {param.name}
                          <div className="text-xs text-gray-500">{param.unit}</div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-center font-semibold text-blue-600">
                          {param.target}
                        </td>
                        {weeks.map(week => (
                          <td key={week.number} className="border border-gray-200 px-2 py-3">
                            <input
                              type="number"
                              value={displayProgress[`week${week.number}`]?.[param.id] || ''}
                              onChange={(e) => updateWeeklyProgress(`week${week.number}`, param.id, e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                              min="0"
                              disabled={isReadOnly}
                            />
                          </td>
                        ))}
                        <td className="border border-gray-200 px-4 py-3">
                          <div className="text-center">
                            <div className="font-semibold text-gray-800">{totalProgress}</div>
                            <div className="text-xs text-gray-600">{progressPercent.toFixed(1)}%</div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1 overflow-hidden">
                              <div 
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  progressPercent >= 100 ? 'bg-green-500' : 
                                  progressPercent >= 75 ? 'bg-blue-500' : 
                                  progressPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'
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

        {/* Team/Uplines Tab */}
        {activeTab === 'uplines' && (
          <div className="space-y-6">
            {/* Partner Management */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Partner Management</h2>
                {!selectedPartner && !selectedDownline && (
                  <button
                    onClick={(e) => { e.preventDefault(); setShowPartnerSelector(!showPartnerSelector); }}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium"
                  >
                    <Plus size={16} />
                    Find Partner
                  </button>
                )}
              </div>
            {selectedPartner && (
              <div className="mb-6">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                       </div>                
                      
                      {/* Only show this block if NOT viewing downline data */}
                      {!selectedDownline && (

                        <div>
                          <div className="font-semibold text-gray-900">
                            {selectedPartner?.displayName || 'No partner'}
                          </div>
                          <div className="text-sm text-purple-600">Game Planning Partner</div>
                        </div>

                      )}
                      {selectedDownline && (
                        <div>
                          <div className="font-semibold text-gray-900">
                            {viewingDownlineData?.partnerInfo?.name || 'No partner'}
                          </div>
                          <div className="text-sm text-purple-600">Game Planning Partner</div>
                        </div>
                      )}
                    </div>
                    {!selectedDownline && (
                      <button
                        onClick={() => setShowRemovePartnerModal(true)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}     
                                         
                  </div>
                </div>
              </div>
            )}

              {pendingPartnerRequests.length > 0 && !selectedDownline && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Partner Requests</h3>
                  <div className="space-y-3">
                    {pendingPartnerRequests.map(request => (
                      <div key={request.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-900">{request.requesterName}</div>
                            <div className="text-sm text-gray-600">{request.message}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => respondToPartnerRequest(request.id, true)}
                              className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600 transition-colors font-medium"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => respondToPartnerRequest(request.id, false)}
                              className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600 transition-colors font-medium"
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

              {showPartnerSelector && !selectedPartner && !selectedDownline &&(
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Select Partner</h3>
                  <div className="space-y-3">
                    {availableUplines.filter(user => !user.partnerId).map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-700 rounded-full flex items-center justify-center text-white font-semibold">
                            {(user.name || '').split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-600">{user.role}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => sendPartnerRequest(user.id)}
                          className="bg-purple-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-600 transition-colors font-medium"
                        >
                          Send Request
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Upline Management */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Upline Management</h2>
                {!selectedDownline && (
                <button
                  onClick={() => setShowUplineSelector(!showUplineSelector)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium"
                >
                  <Edit3 size={16} />
                  Manage
                </button>
                )}
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Your Uplines</h3>
                {selectedDownline && (
  <div className="mb-6">
    <h3 className="text-lg font-semibold text-gray-700 mb-4">
      {selectedDownline.displayName || selectedDownline.name}'s Uplines
    </h3>
                {selectedDownline.selectedUplines && selectedDownline.selectedUplines.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedDownline.selectedUplines.map(uplineId => {
                      const upline = availableUplines.find(u => u.id === uplineId);
                      return upline ? (
                        <div key={upline.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {upline.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{upline.name}</div>
                              <div className="text-sm text-gray-600">{upline.role}</div>
                            </div>
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Users size={32} className="mx-auto mb-2 text-gray-300" />
                    <p>No uplines assigned for this downline.</p>
                  </div>
                )}
              </div>
            )}
                {selectedUplines.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedUplines.map(uplineId => {
                      const upline = availableUplines.find(u => u.id === uplineId);
                      return upline ? (
                        <div key={upline.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-semibold">
                                {upline.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{upline.name}</div>
                                <div className="text-sm text-gray-600">{upline.role}</div>
                              </div>
                            </div>
                            {!selectedDownline && (
                            <button
                              onClick={() => {
                                setUplineToRemove(upline);
                                setShowRemoveUplineModal(true);
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors text-sm font-medium"
                            >
                              Remove
                            </button>
                            )}
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Users size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No uplines selected. Choose uplines to enable visibility.</p>
                    {selectedDownline && (
                      <pre style={{ color: 'red', fontSize: 12 }}>
                        {JSON.stringify(viewingDownlineData, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {showUplineSelector && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Available Uplines</h3>
                  <div className="space-y-3">
                    {availableUplines.map(upline => (
                      <div key={upline.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-700 rounded-full flex items-center justify-center text-white font-semibold">
                            {upline.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{upline.name}</div>
                            <div className="text-sm text-gray-600">{upline.role}</div>
                          </div>
                        </div>
                        {!selectedDownline && (
                        <button
                          onClick={() => toggleUplineSelection(upline.id)}
                          className={`px-4 py-2 rounded-xl transition-all font-medium ${
                            selectedUplines.includes(upline.id)
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {selectedUplines.includes(upline.id) ? 'Selected' : 'Select'}
                        </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Tasks {selectedDownline ? `for ${selectedDownline.displayName || selectedDownline.name}` : ''}
              </h2>
              <button
                onClick={() => setShowTaskModal(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-medium"
              >
                <Plus size={16} />
                Create Task
              </button>
            </div>

            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className={`rounded-xl p-4 border transition-all ${
                  task.completed 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-white border-gray-200 hover:shadow-md'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => toggleTaskCompletion(task.id)}
                        className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          task.completed 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        disabled={selectedDownline && !canEditDownlineData()}
                      >
                        {task.completed && <Check size={16} />}
                      </button>
                      <div className="flex-1">
                        <h3 className={`font-semibold ${
                          task.completed ? 'text-green-800 line-through' : 'text-gray-900'
                        }`}>
                          {task.title}
                        </h3>
                        <p className={`text-sm mt-1 ${
                          task.completed ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {task.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>By: {task.assignedByName}</span>
                          {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            task.priority === 'high' ? 'bg-red-100 text-red-700' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {tasks.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Check size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No tasks assigned yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {/* Task Creation Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Create Task</h3>
                <button onClick={() => setShowTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter task title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={createTask}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg font-semibold"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Partner Modal */}
      {showRemovePartnerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <X size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Remove Partner</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                Are you sure you want to remove <strong>{selectedPartner?.displayName || selectedPartner?.name}</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRemovePartnerModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={removePartner}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Upline Modal */}
      {showRemoveUplineModal && uplineToRemove && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <X size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Remove Upline</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                Remove <strong>{uplineToRemove.name}</strong> as your upline?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRemoveUplineModal(false);
                    setUplineToRemove(null);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toggleUplineSelection(uplineToRemove.id);
                    setShowRemoveUplineModal(false);
                    setUplineToRemove(null);
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold"
                >
                  Remove
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