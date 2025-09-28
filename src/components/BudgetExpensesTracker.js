import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PlusCircle, TrendingUp, TrendingDown, Calendar, Tag, Trash2, Edit3, Save, X, Loader, AlertCircle, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { PoundSterling } from 'lucide-react';

import { 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const bankList = [
  "American Express", "Bank of America", "Barclays", "Barclays Credit Card", "Capital One",
  "Chase", "Citi", "Halifax", "HSBC", "HSBC Credit Card", "Lloyds", "Metro Bank",
  "Monzo", "Nationwide", "NatWest", "Revolut", "Santander", "Starling",
  "Sainsbury's Bank", "Tesco Bank", "TSB", "Wells Fargo"
];

const BudgetExpensesTracker = ({ user, onRefreshData }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Upline/Downline system
  const [availableUplines, setAvailableUplines] = useState([]);
  const [userDownlines, setUserDownlines] = useState([]);
  const [selectedUplines, setSelectedUplines] = useState([]);
  const [showUplineSelector, setShowUplineSelector] = useState(false);

  // Partner system
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [showPartnerSelector, setShowPartnerSelector] = useState(false);
  const [pendingPartnerRequests, setPendingPartnerRequests] = useState([]);
  const [showRemovePartnerModal, setShowRemovePartnerModal] = useState(false);
  const [isSharedPlan, setIsSharedPlan] = useState(false);
  const [sharedPlanId, setSharedPlanId] = useState(null);

  // Budget data
  const [transactions, setTransactions] = useState([]);
  const [budgetCategories, setBudgetCategories] = useState([]);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newTransaction, setNewTransaction] = useState({
    type: 'expense',
    amount: '',
    description: '',
    category: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [newCategory, setNewCategory] = useState({ name: '', budget: '', color: '#3b82f6', type: 'expense' });

  // CSV/Mapping
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvTransactions, setCsvTransactions] = useState([]);
  const [showEditMappings, setShowEditMappings] = useState(false);
  const [selectedBank, setSelectedBank] = useState('');
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [rawCsvRows, setRawCsvRows] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({
    amount: '',
    date: '',
    description: '',
    type: '',
    category: ''
  });
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [savedMappings, setSavedMappings] = useState([]);
  const [editingTransaction, setEditingTransaction] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  // Default categories for new users
  const defaultCategories = useMemo(() => [
    { name: 'Food & Dining', budget: 500, color: '#ef4444', type: 'expense' },
    { name: 'Transportation', budget: 200, color: '#3b82f6', type: 'expense' },
    { name: 'Shopping', budget: 300, color: '#8b5cf6', type: 'expense' },
    { name: 'Entertainment', budget: 150, color: '#06d6a0', type: 'expense' },
    { name: 'Bills & Utilities', budget: 400, color: '#f59e0b', type: 'expense' },
    { name: 'Healthcare', budget: 100, color: '#ec4899', type: 'expense' },
    { name: 'Salary', budget: 2000, color: '#22c55e', type: 'income' }
  ], []);

  // Utility functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const isInSelectedMonth = (dateStr) => {
    const date = new Date(dateStr);
    return (
      date.getFullYear() === selectedYear &&
      date.getMonth() === selectedMonth
    );
  };

  const parseDate = (dateStr) => {
    const match = dateStr.match(/^(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return dateStr;
  };

  const getDisplayData = () => ({
    categories: budgetCategories,
    transactions: transactions
  });

  const { categories: displayCategories, transactions: displayTransactions } = getDisplayData();

  const currentMonthTransactions = displayTransactions.filter(t => isInSelectedMonth(t.date));

  const totalBudget = displayCategories.filter(cat => cat.type === 'expense').reduce((sum, cat) => sum + cat.budget, 0);
  const totalExpenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = displayCategories.filter(cat => cat.type === 'income').reduce((sum, cat) => sum + cat.budget, 0);
  const remainingBudget = totalBudget - totalExpenses;

  const getProgressColor = (spent, budget) => {
    const percentage = (spent / budget) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Firestore functions
  const getAllBankMappings = useCallback(async () => {
    if (!user?.uid) return [];
    const q = query(collection(db, 'bankMappings'), where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, [user?.uid]);

  const saveBankMapping = useCallback(async (bank, headers, mapping) => {
    if (!user?.uid) return;
    const q = query(collection(db, 'bankMappings'), where('userId', '==', user.uid), where('bank', '==', bank));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docRef = doc(db, 'bankMappings', snapshot.docs[0].id);
      await setDoc(docRef, { userId: user.uid, bank, headers, mapping }, { merge: true });
    } else {
      await addDoc(collection(db, 'bankMappings'), { userId: user.uid, bank, headers, mapping });
    }
    setSavedMappings(await getAllBankMappings());
  }, [user?.uid, getAllBankMappings]);

  const deleteBankMapping = useCallback(async (mappingId) => {
    if (!mappingId) return;
    await deleteDoc(doc(db, 'bankMappings', mappingId));
    setSavedMappings(await getAllBankMappings());
  }, [getAllBankMappings]);

  const findMatchingMapping = useCallback(async (headers) => {
    const all = await getAllBankMappings();
    return all.find(m => {
      const a = new Set(m.headers.map(h => h.toLowerCase()));
      const b = new Set(headers.map(h => h.toLowerCase()));
      return a.size === b.size && [...a].every(x => b.has(x));
    });
  }, [getAllBankMappings]);

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
        .filter(upline => upline.id !== user.uid);
      setAvailableUplines(uplines);
    } catch (error) {
      console.error('Error loading uplines:', error);
      setAvailableUplines([]);
    }
  }, [user?.uid]);

  const handlePDFFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    console.log(fullText);
  };

  const handleSaveTransaction = async () => {
    if (!editingTransaction) return;
    try {
      const updatedTransactions = displayTransactions.map(t =>
        t.id === editingTransaction.id ? { ...editingTransaction, amount: parseFloat(editingTransaction.amount) } : t
      );
      await updateBudgetData(displayCategories, updatedTransactions);
      await saveCategoryMapping(editingTransaction.description.toLowerCase(), editingTransaction.category);
      setEditingTransaction(null);
      showNotification('Transaction updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating transaction:', error);
      showNotification('Error updating transaction', 'error');
    }
  };

  const loadUserDownlines = useCallback(async () => {
    try {
      const downlineQuery = query(collection(db, 'users'), where('selectedUplines', 'array-contains', user.uid));
      const downlineSnapshot = await getDocs(downlineQuery);
      const downlines = downlineSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.partnerId) {
          const partnerDoc = await getDoc(doc(db, 'users', userData.partnerId));
          if (partnerDoc.exists()) {
            setSelectedPartner({ id: userData.partnerId, ...partnerDoc.data() });
          }
        } else {
          setSelectedPartner(null);
        }
      }
    } catch (error) {
      console.error('Error loading partner:', error);
      setSelectedPartner(null);
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

  const loadBudgetData = useCallback(async (userId = null) => {
    if (!user?.uid || !auth.currentUser) {
      console.log('Authentication check failed');
      return;
    }
    try {
      let budgetRef;
      let budgetId;
      let isSharedBudget = false;
      let partnerId = null;
      
      if (userId) {
        const downlineUserDoc = await getDoc(doc(db, 'users', userId));
        if (downlineUserDoc.exists()) {
          const downlineUserData = downlineUserDoc.data();
          partnerId = downlineUserData.partnerId;
          if (partnerId) {
            const sortedIds = [userId, partnerId].sort();
            budgetId = `shared_${sortedIds.join('_')}_budget`;
            budgetRef = doc(db, 'sharedBudgets', budgetId);
            isSharedBudget = true;
          } else {
            budgetId = `${userId}_budget`;
            budgetRef = doc(db, 'budgets', budgetId);
          }
        } else {
          budgetId = `${userId}_budget`;
          budgetRef = doc(db, 'budgets', budgetId);
        }
      } else {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          partnerId = userData.partnerId;
        }
        if (partnerId) {
          const sortedIds = [user.uid, partnerId].sort();
          budgetId = `shared_${sortedIds.join('_')}_budget`;
          budgetRef = doc(db, 'sharedBudgets', budgetId);
          isSharedBudget = true;
          const partnerDoc = await getDoc(doc(db, 'users', partnerId));
          if (partnerDoc.exists()) {
            setSelectedPartner({ id: partnerId, ...partnerDoc.data() });
          }
          setIsSharedPlan(true);
          setSharedPlanId(budgetId);
        } else {
          budgetId = `${user.uid}_budget`;
          budgetRef = doc(db, 'budgets', budgetId);
          setSelectedPartner(null);
          setIsSharedPlan(false);
          setSharedPlanId(null);
        }
      }
      
      const budgetDoc = await getDoc(budgetRef);
      if (budgetDoc.exists()) {
        const data = budgetDoc.data();
        // Ensure all categories have a type property
        const categoriesWithType = (data.categories || []).map(cat => ({
          ...cat,
          type: cat.type || 'expense',
          spent: cat.spent || 0
        }));
        setBudgetCategories(categoriesWithType.length > 0 ? categoriesWithType : defaultCategories.map((cat, index) => ({
          ...cat,
          id: `default-${index}`,
          spent: 0
        })));
        setTransactions(data.transactions || []);
      } else {
        const defaultData = {
          categories: defaultCategories.map((cat, index) => ({
            ...cat,
            id: `default-${index}`,
            spent: 0,
            type: cat.type || 'expense'
          })),
          transactions: [],
          lastUpdated: new Date()
        };
        if (isSharedBudget && partnerId) {
          defaultData.isShared = true;
          defaultData.partners = userId ? [userId, partnerId] : [user.uid, partnerId];
          const partnerDoc = await getDoc(doc(db, 'users', partnerId));
          const partnerData = partnerDoc.exists() ? partnerDoc.data() : {};
          if (userId) {
            const downlineDoc = await getDoc(doc(db, 'users', userId));
            const downlineData = downlineDoc.exists() ? downlineDoc.data() : {};
            defaultData.partnerNames = [
              downlineData.displayName || downlineData.name || 'Unknown',
              partnerData.displayName || partnerData.name || 'Unknown Partner'
            ];
            defaultData.createdBy = user.uid;
          } else {
            defaultData.partnerNames = [
              user.displayName || user.name,
              partnerData.displayName || partnerData.name || 'Unknown Partner'
            ];
            defaultData.createdBy = user.uid;
          }
        } else {
          defaultData.userId = userId || user.uid;
        }
        await setDoc(budgetRef, defaultData);
        setBudgetCategories(defaultData.categories);
        setTransactions(defaultData.transactions);
      }
    } catch (error) {
      console.error('Error loading budget data:', error);
      setBudgetCategories(defaultCategories.map((cat, index) => ({
        ...cat,
        id: `default-${index}`,
        spent: 0
      })));
      setTransactions([]);
      setSelectedPartner(null);
      setIsSharedPlan(false);
      setSharedPlanId(null);
    }
  }, [user?.uid, user?.displayName, user?.name, defaultCategories]);

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
        message: `${user.displayName || user.name} wants to be your budget planning partner.`
      };
      await addDoc(collection(db, 'partnerRequests'), requestData);
      setShowPartnerSelector(false);
      showNotification('Partner request sent successfully!', 'success');
    } catch (error) {
      console.error('Error sending partner request:', error);
      showNotification('Error sending partner request', 'error');
    }
  }, [user.uid, user.displayName, user.name]);

  const respondToPartnerRequest = async (requestId, accept) => {
    try {
      const requestRef = doc(db, 'partnerRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      if (!requestDoc.exists()) return;
      const requestData = requestDoc.data();
      if (accept) {
        await updateDoc(doc(db, 'users', user.uid), { partnerId: requestData.requesterId });
        await updateDoc(doc(db, 'users', requestData.requesterId), { partnerId: user.uid });
        await updateDoc(requestRef, { status: 'accepted', respondedAt: new Date() });
        await loadUserPartner();
        await loadBudgetData();
        showNotification('Partner request accepted!', 'success');
      } else {
        await updateDoc(requestRef, { status: 'declined', respondedAt: new Date() });
        showNotification('Partner request declined', 'info');
      }
      await loadPartnerRequests();
    } catch (error) {
      console.error('Error responding to partner request:', error);
      showNotification('Error responding to partner request', 'error');
    }
  };

  const removePartner = useCallback(async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { partnerId: null });
      if (selectedPartner) {
        await updateDoc(doc(db, 'users', selectedPartner.id), { partnerId: null });
      }
      setSelectedPartner(null);
      setIsSharedPlan(false);
      setSharedPlanId(null);
      setShowRemovePartnerModal(false);
      await loadBudgetData();
      showNotification('Partner removed successfully', 'success');
    } catch (error) {
      console.error('Error removing partner:', error);
      showNotification('Error removing partner', 'error');
    }
  }, [user.uid, selectedPartner, loadBudgetData]);

  const updateBudgetData = async (updatedCategories, updatedTransactions) => {
    if (!user?.uid) return;
    setIsEditing(true);
    try {
      const budgetRef = isSharedPlan && sharedPlanId
        ? doc(db, 'sharedBudgets', sharedPlanId)
        : doc(db, 'budgets', `${user.uid}_budget`);
      const budgetData = {
        categories: updatedCategories,
        transactions: updatedTransactions,
        lastUpdated: new Date()
      };
      await setDoc(budgetRef, budgetData, { merge: true });
      setBudgetCategories(updatedCategories);
      setTransactions(updatedTransactions);
    } catch (error) {
      console.error('Budget update failed:', error);
      showNotification('Error updating budget data', 'error');
    } finally {
      setTimeout(() => setIsEditing(false), 1000);
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getSuggestedCategory = useCallback(async (description) => {
    if (!user?.uid || !description) return '';
    const q = query(collection(db, 'categoryMappings'), where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    const desc = description.toLowerCase();
    for (const docSnap of snapshot.docs) {
      if (docSnap.data().pattern === desc) {
        return docSnap.data().category;
      }
    }
    for (const docSnap of snapshot.docs) {
      if (desc.includes(docSnap.data().pattern)) {
        return docSnap.data().category;
      }
    }
    return '';
  }, [user?.uid]);

  const saveCategoryMapping = useCallback(async (pattern, category) => {
    if (!user?.uid || !pattern || !category) return;
    const q = query(collection(db, 'categoryMappings'), where('userId', '==', user.uid), where('pattern', '==', pattern));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docRef = doc(db, 'categoryMappings', snapshot.docs[0].id);
      await setDoc(docRef, { userId: user.uid, pattern, category }, { merge: true });
    } else {
      await addDoc(collection(db, 'categoryMappings'), { userId: user.uid, pattern, category });
    }
  }, [user?.uid]);

  const handleAddTransaction = async () => {
    if (!user || !newTransaction.amount || !newTransaction.description) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    try {
      const transaction = {
        id: `trans-${Date.now()}`,
        ...newTransaction,
        amount: parseFloat(newTransaction.amount),
        userId: user.uid,
        createdAt: new Date()
      };
      const updatedTransactions = [transaction, ...displayTransactions];
      await updateBudgetData(displayCategories, updatedTransactions);
      await saveCategoryMapping(newTransaction.description.toLowerCase(), newTransaction.category);
      setNewTransaction({
        type: 'expense',
        amount: '',
        description: '',
        category: '',
        date: new Date().toISOString().split('T')[0]
      });
      setShowAddTransaction(false);
      showNotification('Transaction added successfully!', 'success');
    } catch (error) {
      console.error('Error adding transaction:', error);
      showNotification('Error adding transaction', 'error');
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      const updatedTransactions = displayTransactions.filter(t => t.id !== id);
      await updateBudgetData(displayCategories, updatedTransactions);
      showNotification('Transaction deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showNotification('Error deleting transaction', 'error');
    }
  };

  const handleAddCategory = async (event) => {
    event?.preventDefault();
    if (!newCategory.name.trim()) return;
    const category = {
      id: `cat-${Date.now()}`,
      name: newCategory.name.trim(),
      budget: parseFloat(newCategory.budget) || 0,
      color: newCategory.color,
      type: newCategory.type || 'expense',
      spent: 0
    };
    try {
      const updatedCategories = [...displayCategories, category];
      await updateBudgetData(updatedCategories, displayTransactions);
      setNewCategory({ name: '', budget: '', color: '#3b82f6', type: 'expense' });
      setShowAddCategory(false);
      showNotification('Category added successfully!', 'success');
    } catch (error) {
      console.error('Error adding category:', error);
      showNotification('Error adding category', 'error');
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory({ ...category });
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) return;
    try {
      const updatedCategories = displayCategories.map(cat => 
        cat.id === editingCategory.id ? editingCategory : cat
      );
      await updateBudgetData(updatedCategories, displayTransactions);
      setEditingCategory(null);
      showNotification('Category updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating category:', error);
      showNotification('Error updating category', 'error');
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      const updatedCategories = displayCategories.filter(cat => cat.id !== id);
      await updateBudgetData(updatedCategories, displayTransactions);
      showNotification('Category deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting category:', error);
      showNotification('Error deleting category', 'error');
    }
  };

  const toggleUplineSelection = async (uplineId) => {
    const newSelectedUplines = selectedUplines.includes(uplineId)
      ? selectedUplines.filter(id => id !== uplineId)
      : [...selectedUplines, uplineId];
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { selectedUplines: newSelectedUplines });
      setSelectedUplines(newSelectedUplines);
      showNotification('Uplines updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating uplines:', error);
      showNotification('Error updating uplines', 'error');
    }
  };

  const handleCSVFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const headers = results.meta.fields;
        setCsvHeaders(headers);
        setRawCsvRows(results.data);
        const match = await findMatchingMapping(headers);
        if (match) {
          setSelectedBank(match.bank);
          setFieldMapping(match.mapping);
          handleMapAndImport(results.data, match.mapping);
        } else {
          setShowMappingModal(true);
          setSavedMappings(await getAllBankMappings());
        }
      }
    });
  };

  const handleMapAndImport = async (rows, mapping) => {
    const mapped = await Promise.all(rows.map(async row => {
      const description = row[mapping.description]?.toLowerCase() || '';
      let category = await getSuggestedCategory(description);
      if (!category) {
        category = row[mapping.category] || '';
      }
      const cleanAmount = parseFloat((row[mapping.amount] || '').replace(/[^0-9.\-]/g, ''));
      const rawDate = row[mapping.date] || new Date().toISOString().split('T')[0];
      const date = parseDate(rawDate);
      return {
        id: `csv-${Date.now()}-${Math.random()}`,
        type: row[mapping.type]?.toLowerCase() === 'income' ? 'income' : 'expense',
        amount: cleanAmount,
        description: row[mapping.description] || '',
        category,
        date,
        userId: user.uid,
        createdAt: new Date()
      };
    }));
    setCsvTransactions(mapped);
    setShowMappingModal(false);
    setShowCSVImport(true);
  };

  const handleImportTransactions = async () => {
    const updatedTransactions = [...csvTransactions, ...displayTransactions];
    await updateBudgetData(displayCategories, updatedTransactions);
    setCsvTransactions([]);
    setShowCSVImport(false);
    showNotification('CSV transactions imported!', 'success');
  };

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadAvailableUplines();
      await loadUserUplines();
      await loadUserPartner();
      await loadPartnerRequests();
      await loadUserDownlines();
      await loadBudgetData();
      setSavedMappings(await getAllBankMappings());
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadAvailableUplines, loadUserUplines, loadUserPartner, loadPartnerRequests, loadUserDownlines, loadBudgetData, getAllBankMappings]);

  useEffect(() => {
    const updatedCategories = displayCategories.map(category => {
      const spent = currentMonthTransactions
        .filter(t => t.type === 'expense' && t.category === category.name)
        .reduce((sum, t) => sum + t.amount, 0);
      return { ...category, spent };
    });
    setBudgetCategories(updatedCategories);
    // eslint-disable-next-line
  }, [displayTransactions, displayCategories.length]);

  useEffect(() => {
    loadBudgetData();
    setEditMode(false);
  }, [loadBudgetData]);

  useEffect(() => {
    if (user?.uid && !isEditing) {
      loadBudgetData();
    }
  }, [selectedPartner?.id, user?.uid, isEditing, loadBudgetData]);

  useEffect(() => {
    if (user?.uid) {
      loadInitialData();
    }
  }, [user?.uid, loadInitialData]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 animate-spin text-blue-600" />
          <span className="text-lg text-gray-700 font-medium">Loading your budget tracker...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PoundSterling className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Please Sign In</h2>
          <p className="text-gray-600">You need to be logged in to access your budget tracker.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-in ${
          notification.type === 'success' ? 'bg-green-500 text-white' :
          notification.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <PoundSterling className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Budget Tracker</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Manage your finances</p>
              </div>
            </div>
            
            {/* Mobile menu button */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={() => setShowAddTransaction(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
              >
                <PlusCircle className="w-4 h-4" />
                Add Transaction
              </button>
              <button
                onClick={() => document.getElementById('csv-input').click()}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
              >
                Import CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Actions</h3>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowAddTransaction(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 bg-green-500 text-white px-4 py-3 rounded-xl hover:bg-green-600 transition-colors"
              >
                <PlusCircle className="w-5 h-5" />
                Add Transaction
              </button>
              <button
                onClick={() => {
                  document.getElementById('csv-input').click();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 bg-blue-500 text-white px-4 py-3 rounded-xl hover:bg-blue-600 transition-colors"
              >
                Import CSV
              </button>
              <button
                onClick={() => {
                  setShowAddCategory(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 bg-purple-500 text-white px-4 py-3 rounded-xl hover:bg-purple-600 transition-colors"
              >
                <PlusCircle className="w-5 h-5" />
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVFile} />
      <input id="pdf-input" type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePDFFile} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Partner Banner */}
        {selectedPartner && (
          <div className="mb-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg mb-1">Shared Budget Active</h3>
                <p className="text-purple-100 text-sm">
                  Managing finances together with {selectedPartner.displayName || selectedPartner.name}
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

        {/* Month Navigator */}
        <div className="mb-6 bg-white rounded-2xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
            
            <div className="flex items-center gap-4">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 font-medium"
              >
                {months.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>
              
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 font-medium"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Total Budget</p>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <PoundSterling className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{formatCurrency(totalBudget)}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </div>

          <div className={`bg-white rounded-2xl shadow-lg p-6 border-l-4 ${remainingBudget >= 0 ? 'border-emerald-500' : 'border-orange-500'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Remaining</p>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${remainingBudget >= 0 ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                <PoundSterling className={`w-5 h-5 ${remainingBudget >= 0 ? 'text-emerald-600' : 'text-orange-600'}`} />
              </div>
            </div>
            <p className={`text-2xl sm:text-3xl font-bold ${remainingBudget >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
              {formatCurrency(remainingBudget)}
            </p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Budget Categories */}
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Budget Categories</h2>
              <button
                onClick={() => setShowAddCategory(true)}
                className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {displayCategories.filter(cat => cat.type === 'expense').map(category => (
                <div key={category.id} className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow">
                  {editingCategory && editingCategory.id === category.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        value={editingCategory.budget}
                        onChange={(e) => setEditingCategory({...editingCategory, budget: parseFloat(e.target.value) || 0})}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="color"
                        value={editingCategory.color}
                        onChange={(e) => setEditingCategory({...editingCategory, color: e.target.value})}
                        className="w-full p-1 border border-gray-200 rounded-lg h-10"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveCategory}
                          className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="flex items-center gap-1 bg-gray-500 text-white px-3 py-1.5 rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                          <h3 className="font-semibold text-gray-900">{category.name}</h3>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditCategory(category)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span className="font-medium">{formatCurrency(category.spent || 0)} of {formatCurrency(category.budget)}</span>
                        <span className="font-semibold">{Math.round(((category.spent || 0) / category.budget) * 100)}%</span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${getProgressColor(category.spent || 0, category.budget)}`}
                          style={{ width: `${Math.min(((category.spent || 0) / category.budget) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {displayCategories.filter(cat => cat.type === 'expense').length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Tag className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No categories yet</p>
                  <p className="text-gray-400 text-sm mt-1">Add your first budget category!</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
              <span className="text-sm text-gray-500 font-medium">{currentMonthTransactions.length} total</span>
            </div>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {currentMonthTransactions.slice(0, 10).map(transaction => (
                <div key={transaction.id} className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${transaction.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{transaction.description}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {transaction.date}
                          </span>
                          {transaction.category && (
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {transaction.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-bold text-sm ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingTransaction(transaction)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {currentMonthTransactions.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PoundSterling className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No transactions yet</p>
                  <p className="text-gray-400 text-sm mt-1">Add your first transaction!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals - Transaction Edit, Add Transaction, Add Category, CSV Import, Mapping, Remove Partner */}
      {/* These remain largely the same but with improved styling */}
      
      {editingTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900">Edit Transaction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  value={editingTransaction.description}
                  onChange={e => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                <input
                  type="number"
                  value={editingTransaction.amount}
                  onChange={e => setEditingTransaction({ ...editingTransaction, amount: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                <select
                  value={editingTransaction.type}
                  onChange={e => setEditingTransaction({ ...editingTransaction, type: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <select
                  value={editingTransaction.category}
                  onChange={e => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  {displayCategories
                    .filter(cat => cat.type === editingTransaction.type)
                    .map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={editingTransaction.date}
                  onChange={e => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveTransaction}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all font-semibold"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingTransaction(null)}
                className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-xl hover:bg-gray-600 transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900">Add New Transaction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                <select
                  value={newTransaction.type}
                  onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Grocery shopping"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <select
                  value={newTransaction.category}
                  onChange={e => setNewTransaction({...newTransaction, category: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  {displayCategories
                    .filter(cat => cat.type === newTransaction.type)
                    .map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddTransaction}
                disabled={!newTransaction.amount || !newTransaction.description}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Transaction
              </button>
              <button
                onClick={() => setShowAddTransaction(false)}
                className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-xl hover:bg-gray-600 transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900">Add Budget Category</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category Name</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Groceries"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Monthly Budget</label>
                <input
                  type="number"
                  step="0.01"
                  value={newCategory.budget}
                  onChange={(e) => setNewCategory({...newCategory, budget: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                <select
                  value={newCategory.type || 'expense'}
                  onChange={e => setNewCategory({ ...newCategory, type: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
                <input
                  type="color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                  className="w-full p-2 border border-gray-200 rounded-xl h-12"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddCategory}
                disabled={!newCategory.name || !newCategory.budget}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Category
              </button>
              <button
                onClick={() => setShowAddCategory(false)}
                className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-xl hover:bg-gray-600 transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVImport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-gray-900">Import Transactions</h3>
            <div className="max-h-96 overflow-y-auto mb-6 space-y-2">
              {csvTransactions.map((t, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-gray-900">{t.description}</span>
                    <span className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(t.amount)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {t.date} • {t.category} • {t.type}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleImportTransactions}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all font-semibold"
              >
                Import All ({csvTransactions.length})
              </button>
              <button
                onClick={() => setShowCSVImport(false)}
                className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-xl hover:bg-gray-600 transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 text-gray-900">Map CSV Columns</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bank</label>
                <select
                  value={selectedBank}
                  onChange={e => setSelectedBank(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Bank</option>
                  {bankList.sort().map(bank => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>
              
              <button
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                onClick={async () => {
                  setShowEditMappings(!showEditMappings);
                  if (!showEditMappings) setSavedMappings(await getAllBankMappings());
                }}
                type="button"
              >
                {showEditMappings ? "Hide Saved Mappings" : "View Saved Mappings"}
              </button>
              
              {showEditMappings && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="font-semibold text-gray-900 mb-3">Saved Mappings</div>
                  {savedMappings.length === 0 && (
                    <div className="text-gray-500 text-sm">No saved mappings.</div>
                  )}
                  {savedMappings.map((m) => (
                    <div key={m.id} className="flex items-center justify-between mb-2 bg-white p-2 rounded-lg">
                      <span className="text-sm text-gray-700">{m.bank}</span>
                      <div className="flex gap-2">
                        <button
                          className="text-green-600 hover:text-green-700 font-medium text-sm"
                          onClick={() => {
                            setSelectedBank(m.bank);
                            setFieldMapping(m.mapping);
                            setShowEditMappings(false);
                          }}
                          type="button"
                        >
                          Load
                        </button>
                        <button
                          className="text-red-600 hover:text-red-700 font-medium text-sm"
                          onClick={() => deleteBankMapping(m.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {['amount', 'date', 'description', 'type', 'category'].map(field => (
                <div key={field}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 capitalize">{field}</label>
                  <select
                    value={fieldMapping[field]}
                    onChange={e => setFieldMapping({ ...fieldMapping, [field]: e.target.value })}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select column</option>
                    {csvHeaders.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (selectedBank && fieldMapping.amount) {
                    await saveBankMapping(selectedBank, csvHeaders, fieldMapping);
                  }
                  handleMapAndImport(rawCsvRows, fieldMapping);
                }}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all font-semibold"
              >
                Import & Save
              </button>
              <button
                onClick={() => setShowMappingModal(false)}
                className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-xl hover:bg-gray-600 transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Partner Modal */}
      {showRemovePartnerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <X size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Remove Partner</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to remove <strong>{selectedPartner?.displayName || selectedPartner?.name}</strong> as your partner? 
              This will end your shared budget planning and both of you will return to individual budgets.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRemovePartnerModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={removePartner}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold"
              >
                Remove Partner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetExpensesTracker;