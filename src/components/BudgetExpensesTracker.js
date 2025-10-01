import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  PlusCircle, TrendingUp, TrendingDown, Calendar, Tag, Trash2, 
  Edit3, Save, X, Loader, AlertCircle, Menu, ChevronLeft, 
  ChevronRight, ChevronDown, ChevronUp, Eye, EyeOff 
} from 'lucide-react';
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
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import CryptoJS from 'crypto-js';


pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const bankList = [
  "American Express", "Bank of America", "Barclays", "Barclays Credit Card", "Capital One",
  "Chase", "Citi", "Halifax", "HSBC", "HSBC Credit Card", "Lloyds", "Metro Bank",
  "Monzo", "Nationwide", "NatWest", "Revolut", "Santander", "Starling",
  "Sainsbury's Bank", "Tesco Bank", "TSB", "Wells Fargo"
];

const BudgetExpensesTracker = ({ user, onRefreshData, onCancel }) => {
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
  const [newCategory, setNewCategory] = useState({ 
    name: '', 
    budget: '', 
    color: '#3b82f6', 
    type: 'expense' 
  });

  // Enhanced subcategory states
  const [newSubcategory, setNewSubcategory] = useState({ 
    name: '', 
    budget: '', 
    color: '#3b82f6', 
    parentId: null 
  });
  const [showAddSubcategory, setShowAddSubcategory] = useState(false);
  const [addingSubcategoryTo, setAddingSubcategoryTo] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});

  // Transaction visibility controls
  const [showTransactions, setShowTransactions] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  
  const [showMappingConfirmDialog, setShowMappingConfirmDialog] = useState(false);
  const [pendingMapping, setPendingMapping] = useState(null);
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
  category: '',
  dateFormat: 'DD/MM/YYYY' // New field for date format
});
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [savedMappings, setSavedMappings] = useState([]);

    // New state variables for category mapping dialog
  const [editingTransaction, setEditingTransaction] = useState(null);

// Date selection
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
   const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

// Add new state for preview data
const [csvPreviewData, setCsvPreviewData] = useState([]);
const [showPreviewModal, setShowPreviewModal] = useState(false);

const [isUnlocked, setIsUnlocked] = useState(false);
const [showPassphraseModal, setShowPassphraseModal] = useState(false);
const [passphrase, setPassphrase] = useState('');
const [passphraseInput, setPassphraseInput] = useState('');
const [passphraseError, setPassphraseError] = useState('');
const [isSettingPassphrase, setIsSettingPassphrase] = useState(false);

  // ============================================================================
  // 2. CONSTANTS AND COMPUTED VALUES (useMemo, static data)
  // ============================================================================
  
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  // Enhanced default categories with subcategories
  const defaultCategories = useMemo(() => [
    { 
      name: 'Food & Dining', 
      budget: 500, 
      color: '#ef4444', 
      type: 'expense',
      subcategories: [
        { id: 'sub-1', name: 'Groceries', budget: 300, color: '#f87171', spent: 0 },
        { id: 'sub-2', name: 'Restaurants', budget: 150, color: '#fca5a5', spent: 0 },
        { id: 'sub-3', name: 'Fast Food', budget: 50, color: '#fee2e2', spent: 0 }
      ]
    },
    { 
      name: 'Transportation', 
      budget: 200, 
      color: '#3b82f6', 
      type: 'expense',
      subcategories: [
        { id: 'sub-4', name: 'Gas', budget: 100, color: '#60a5fa', spent: 0 },
        { id: 'sub-5', name: 'Public Transit', budget: 50, color: '#93c5fd', spent: 0 },
        { id: 'sub-6', name: 'Car Maintenance', budget: 50, color: '#dbeafe', spent: 0 }
      ]
    },
    { 
      name: 'Shopping', 
      budget: 300, 
      color: '#8b5cf6', 
      type: 'expense',
      subcategories: [
        { id: 'sub-7', name: 'Clothing', budget: 150, color: '#a78bfa', spent: 0 },
        { id: 'sub-8', name: 'Electronics', budget: 100, color: '#c4b5fd', spent: 0 },
        { id: 'sub-9', name: 'Household Items', budget: 50, color: '#ede9fe', spent: 0 }
      ]
    },
    { 
      name: 'Entertainment', 
      budget: 150, 
      color: '#06d6a0', 
      type: 'expense',
      subcategories: [
        { id: 'sub-10', name: 'Movies', budget: 50, color: '#4ade80', spent: 0 },
        { id: 'sub-11', name: 'Games', budget: 50, color: '#86efac', spent: 0 },
        { id: 'sub-12', name: 'Subscriptions', budget: 50, color: '#dcfce7', spent: 0 }
      ]
    },
    { 
      name: 'Bills & Utilities', 
      budget: 400, 
      color: '#f59e0b', 
      type: 'expense',
      subcategories: [
        { id: 'sub-13', name: 'Electricity', budget: 100, color: '#fbbf24', spent: 0 },
        { id: 'sub-14', name: 'Water', budget: 50, color: '#fcd34d', spent: 0 },
        { id: 'sub-15', name: 'Internet', budget: 100, color: '#fde68a', spent: 0 },
        { id: 'sub-16', name: 'Phone', budget: 100, color: '#fef3c7', spent: 0 }
      ]
    },
    { 
      name: 'Healthcare', 
      budget: 100, 
      color: '#ec4899', 
      type: 'expense',
      subcategories: [
        { id: 'sub-17', name: 'Doctor Visits', budget: 50, color: '#f472b6', spent: 0 },
        { id: 'sub-18', name: 'Medications', budget: 50, color: '#fbcfe8', spent: 0 }
      ]
    },
    { 
      name: 'Salary', 
      budget: 2000, 
      color: '#22c55e', 
      type: 'income',
      subcategories: []
    }
  ], []);

   // Utility functions
  // ============================================================================
  // 3. PURE UTILITY FUNCTIONS (no dependencies, no side effects)
  // ============================================================================
  
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

// Update the parseDate function to accept a format parameter
const parseDate = (dateStr, format = 'DD/MM/YYYY') => {
  console.log('Parsing date:', dateStr, 'with format:', format); // Debug log
  
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  const dateString = dateStr.toString().trim();
  
  // Define format-specific parsing
  const formatPatterns = {
    'DD/MM/YYYY': {
      regex: /^(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{4})$/,
      parser: (match) => {
        const [, day, month, year] = match;
        return new Date(year, month - 1, day);
      }
    },
    'MM/DD/YYYY': {
      regex: /^(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{4})$/,
      parser: (match) => {
        const [, month, day, year] = match;
        return new Date(year, month - 1, day);
      }
    },
    'YYYY/MM/DD': {
      regex: /^(\d{4})[\/\-\s](\d{1,2})[\/\-\s](\d{1,2})$/,
      parser: (match) => {
        const [, year, month, day] = match;
        return new Date(year, month - 1, day);
      }
    },
    'DD/MM/YY': {
      regex: /^(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2})$/,
      parser: (match) => {
        const [, day, month, year] = match;
        const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
        return new Date(fullYear, month - 1, day);
      }
    },
    'MM/DD/YY': {
      regex: /^(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2})$/,
      parser: (match) => {
        const [, month, day, year] = match;
        const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
        return new Date(fullYear, month - 1, day);
      }
    }
  };
  
  // Try the specified format first
  if (formatPatterns[format]) {
    const pattern = formatPatterns[format];
    const match = dateString.match(pattern.regex);
    if (match) {
      try {
        const date = pattern.parser(match);
        if (!isNaN(date.getTime())) {
          const isoDate = date.toISOString().split('T')[0];
          console.log('Parsed date successfully:', isoDate);
          return isoDate;
        }
      } catch (e) {
        console.error('Error parsing date with format:', format, e);
      }
    }
  }
  
  // Fallback: try all formats if the specified one fails
  for (const [formatName, pattern] of Object.entries(formatPatterns)) {
    if (formatName === format) continue; // Skip already tried format
    
    const match = dateString.match(pattern.regex);
    if (match) {
      try {
        const date = pattern.parser(match);
        if (!isNaN(date.getTime())) {
          const isoDate = date.toISOString().split('T')[0];
          console.log('Parsed date with fallback format:', formatName, isoDate);
          return isoDate;
        }
      } catch (e) {
        console.error('Error parsing date with fallback format:', formatName, e);
      }
    }
  }
  
  // Try JavaScript Date parsing as final fallback
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const isoDate = date.toISOString().split('T')[0];
      console.log('Parsed date with JS Date fallback:', isoDate);
      return isoDate;
    }
  } catch (e) {
    console.error('Date parsing failed:', e);
  }
  
  // Return today's date as ultimate fallback
  const fallback = new Date().toISOString().split('T')[0];
  console.log('Using fallback date:', fallback);
  return fallback;
};

const parseCurrency = (amountStr) => {
  if (!amountStr) return 0;
  
  // Convert to string and trim
  const cleanStr = amountStr.toString().trim();
  
  // Remove common currency symbols and encoding issues
  const cleaned = cleanStr
    .replace(/[£$€¥₹₽¢₦₱₩₪₴₵₡₲₸₼₫﷼]/g, '') // Standard currency symbols
    .replace(/[�]/g, '') // Corrupted currency symbols
    .replace(/[,\s]/g, '') // Remove commas and spaces
    .replace(/[()]/g, '') // Remove parentheses
    .trim();
  
  // Handle negative amounts (debits)
  const isNegative = cleaned.startsWith('-') || amountStr.includes('(') || amountStr.toLowerCase().includes('debit');
  
  // Extract numeric value
  const numericValue = parseFloat(cleaned.replace(/[^0-9.-]/g, ''));
  
  if (isNaN(numericValue)) {
    console.warn('Failed to parse amount:', amountStr, '-> cleaned:', cleaned);
    return 0;
  }
  
  return isNegative ? Math.abs(numericValue) : numericValue;
};
  const getDisplayData = () => ({
    categories: budgetCategories,
    transactions: transactions
  });

  const getProgressColor = (spent, budget) => {
    const percentage = (spent / budget) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };


  // ============================================================================
  // 4. COMPUTED VALUES THAT DEPEND ON STATE
  // ============================================================================
  
  const { categories: displayCategories, transactions: displayTransactions } = getDisplayData();
  const currentMonthTransactions = displayTransactions.filter(t => isInSelectedMonth(t.date));
  const totalBudget = displayCategories.filter(cat => cat.type === 'expense').reduce((sum, cat) => sum + cat.budget, 0);
  const totalExpenses = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = displayCategories.filter(cat => cat.type === 'income').reduce((sum, cat) => sum + cat.budget, 0);
  const remainingBudget = totalBudget - totalExpenses;

  const findCategoryAndSubcategory = (categoryName) => {
  for (const category of displayCategories) {
    // Check if it's a main category
    if (category.name === categoryName) {
      return {
        parentCategory: category,
        subcategory: null,
        isSubcategory: false
      };
    }
    
    // Check if it's a subcategory
    if (category.subcategories) {
      const subcategory = category.subcategories.find(sub => sub.name === categoryName);
      if (subcategory) {
        return {
          parentCategory: category,
          subcategory: subcategory,
          isSubcategory: true
        };
      }
    }
  }
  
  return {
    parentCategory: null,
    subcategory: null,
    isSubcategory: false
  };
};
const encryptData = (data, passphrase) => {
  try {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), passphrase).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};
const decryptData = (encryptedData, passphrase) => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, passphrase);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) {
      throw new Error('Invalid passphrase');
    }
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Invalid passphrase or corrupted data');
  }
};

// Function to check if budget is encrypted
const isBudgetEncrypted = (budgetData) => {
  return budgetData && typeof budgetData.encryptedData === 'string' && budgetData.isEncrypted === true;
};

  // Enhanced Firebase functions for category mapping with subcategory support
const saveCategoryMapping = useCallback(async (description, categoryName) => {
  if (!user?.uid || !description || !categoryName) return;
  
  const categoryInfo = findCategoryAndSubcategory(categoryName);
  const pattern = description.toLowerCase().trim();
  
  try {
    const mappingData = {
      userId: user.uid,
      pattern: pattern,
      category: categoryName,
      isSubcategory: categoryInfo.isSubcategory,
      parentCategory: categoryInfo.isSubcategory ? categoryInfo.parentCategory.name : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const q = query(
      collection(db, 'categoryMappings'), 
      where('userId', '==', user.uid),
      where('pattern', '==', pattern)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docRef = doc(db, 'categoryMappings', snapshot.docs[0].id);
      await updateDoc(docRef, { 
        category: categoryName,
        isSubcategory: categoryInfo.isSubcategory,
        parentCategory: categoryInfo.isSubcategory ? categoryInfo.parentCategory.name : null,
        updatedAt: serverTimestamp() 
      });
    } else {
      await addDoc(collection(db, 'categoryMappings'), mappingData);
    }
    
    // Apply mapping inline with current state
    const updatedTransactions = [];
    let transactionsUpdated = 0;
    
    for (const transaction of displayTransactions) {
      // Only process transactions belonging to current user
      if (transaction.userId !== user.uid) {
        updatedTransactions.push(transaction);
        continue;
      }
      
      // Check if this transaction's description matches the mapping pattern
      const description = transaction.description?.toLowerCase().trim();
      if (description && 
          (description === pattern || 
           description.includes(pattern) || 
           pattern.includes(description))) {
        
        // Update with the new category mapping
        updatedTransactions.push({
          ...transaction,
          category: categoryName,
          categoryType: categoryInfo.isSubcategory ? 'subcategory' : 'category',
          parentCategory: categoryInfo.isSubcategory ? categoryInfo.parentCategory.name : null
        });
        transactionsUpdated++;
      } else {
        updatedTransactions.push(transaction);
      }
    }
    
    // Update transactions if any were changed
    if (transactionsUpdated > 0) {
      await updateBudgetData(displayCategories, updatedTransactions);
      showNotification(
        `Mapping saved! ${transactionsUpdated} existing transaction${transactionsUpdated > 1 ? 's' : ''} updated.`, 
        'success'
      );
    }
    
  } catch (error) {
    console.error('Error saving category mapping:', error);
    showNotification('Mapping saved, but some transactions may not have updated', 'warning');
    throw error;
  }
}, [user?.uid, displayCategories, displayTransactions, showNotification]);

// New function to apply mapping only to matching transactions -- Remove if redundant
const applyMappingToTransactions = async (pattern, categoryName, categoryInfo) => {
  try {
    const updatedTransactions = [];
    let transactionsUpdated = 0;
    
    for (const transaction of displayTransactions) {
      // Only process transactions belonging to current user
      if (transaction.userId !== user.uid) {
        updatedTransactions.push(transaction);
        continue;
      }
      
      // Check if this transaction's description matches the mapping pattern
      const description = transaction.description?.toLowerCase().trim();
      if (description && 
          (description === pattern || 
           description.includes(pattern) || 
           pattern.includes(description))) {
        
        // Update with the new category mapping
        updatedTransactions.push({
          ...transaction,
          category: categoryName,
          categoryType: categoryInfo.isSubcategory ? 'subcategory' : 'category',
          parentCategory: categoryInfo.isSubcategory ? categoryInfo.parentCategory.name : null
        });
        transactionsUpdated++;
      } else {
        updatedTransactions.push(transaction);
      }
    }
    
    // Update transactions if any were changed
    if (transactionsUpdated > 0) {
      await updateBudgetData(displayCategories, updatedTransactions);
      showNotification(
        `Mapping saved! ${transactionsUpdated} existing transaction${transactionsUpdated > 1 ? 's' : ''} updated.`, 
        'success'
      );
    }
    
  } catch (error) {
    console.error('Error applying mapping to transactions:', error);
    // Don't throw - mapping was saved successfully, just notify
    showNotification('Mapping saved, but some transactions may not have updated', 'warning');
  }
};

  const getSuggestedCategory = useCallback(async (description) => {
    if (!user?.uid || !description) return { category: '', isSubcategory: false, parentCategory: null };
    
    try {
      const q = query(
        collection(db, 'categoryMappings'), 
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const desc = description.toLowerCase().trim();
      
      // First, look for exact match
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.pattern === desc) {
          return { 
            category: data.category, 
            isSubcategory: data.isSubcategory || false,
            parentCategory: data.parentCategory || null
          };
        }
      }
      
      // Then, look for partial match
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (desc.includes(data.pattern) || data.pattern.includes(desc)) {
          return { 
            category: data.category, 
            isSubcategory: data.isSubcategory || false,
            parentCategory: data.parentCategory || null
          };
        }
      }
      
      return { category: '', isSubcategory: false, parentCategory: null };
    } catch (error) {
      console.error('Error getting suggested category:', error);
      return { category: '', isSubcategory: false, parentCategory: null };
    }
  }, [user?.uid]);

  // Bank mapping functions
  const getAllBankMappings = useCallback(async () => {
    if (!user?.uid) return [];
    try {
      const q = query(collection(db, 'bankMappings'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting bank mappings:', error);
      return [];
    }
  }, [user?.uid]);

// Update the saveBankMapping function to include dateFormat
const saveBankMapping = useCallback(async (bank, headers, mapping) => {
  if (!user?.uid) return;
  try {
    const q = query(collection(db, 'bankMappings'), where('userId', '==', user.uid), where('bank', '==', bank));
    const snapshot = await getDocs(q);
    
    const mappingData = {
      userId: user.uid,
      bank,
      headers,
      mapping,
      dateFormat: mapping.dateFormat || 'DD/MM/YYYY', // Include dateFormat
      updatedAt: serverTimestamp()
    };

    if (!snapshot.empty) {
      await updateDoc(snapshot.docs[0].ref, mappingData);
    } else {
      await addDoc(collection(db, 'bankMappings'), {
        ...mappingData,
        createdAt: serverTimestamp()
      });
    }
    setSavedMappings(await getAllBankMappings());
  } catch (error) {
    console.error('Error saving bank mapping:', error);
  }
}, [user?.uid, getAllBankMappings]);

  const deleteBankMapping = useCallback(async (mappingId) => {
    if (!mappingId) return;
    try {
      await deleteDoc(doc(db, 'bankMappings', mappingId));
      setSavedMappings(await getAllBankMappings());
    } catch (error) {
      console.error('Error deleting bank mapping:', error);
    }
  }, [getAllBankMappings]);

const findMatchingMapping = useCallback(async (headers) => {
  try {
    const all = await getAllBankMappings();
    console.log('Available mappings:', all.length);
    console.log('Looking for headers match:', headers);
    
    const match = all.find(m => {
      console.log('Comparing with mapping headers:', m.headers);
      // Sort headers for comparison to handle different order
      const sortedHeaders = [...headers].sort();
      const sortedMappingHeaders = [...(m.headers || [])].sort();
      const isMatch = JSON.stringify(sortedHeaders) === JSON.stringify(sortedMappingHeaders);
      console.log('Headers match:', isMatch);
      return isMatch;
    });
    
    if (match) {
      console.log('Found matching mapping:', match);
    } else {
      console.log('No matching mapping found');
    }
    
    return match || null;
  } catch (error) {
    console.error('Error finding matching mapping:', error);
    return null;
  }
}, [getAllBankMappings]);
  
  // Budget data loading and syncing
    // Budget data loading and management

const loadBudgetData = useCallback(async (userId = null) => {
  if (!user?.uid || !auth.currentUser) {
    console.log('Authentication check failed');
    return;
  }

  // If we're not unlocked yet, show the passphrase modal
  if (!isUnlocked) {
    setShowPassphraseModal(true);
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
      const budgetData = budgetDoc.data();
      
      if (isBudgetEncrypted(budgetData)) {
        // Decrypt the data
        const decryptedData = decryptData(budgetData.encryptedData, passphrase);
        
        const categoriesWithType = (decryptedData.categories || []).map(cat => ({
          ...cat,
          type: cat.type || 'expense',
          spent: cat.spent || 0,
          subcategories: (cat.subcategories || []).map(sub => ({
            ...sub,
            spent: sub.spent || 0
          }))
        }));
        
        setBudgetCategories(categoriesWithType.length > 0 ? categoriesWithType : defaultCategories.map((cat, index) => ({
          ...cat,
          id: `default-${index}`,
          spent: 0
        })));
        setTransactions(decryptedData.transactions || []);
      } else {
        // Legacy unencrypted data - this shouldn't happen in encrypted mode
        showNotification('Budget data needs to be encrypted. Please contact support.', 'warning');
      }
    } else {
      // Create new encrypted budget
      const initialData = {
        categories: defaultCategories.map((cat, index) => ({
          ...cat,
          id: `default-${index}`,
          spent: 0,
          type: cat.type || 'expense'
        })),
        transactions: [],
        lastUpdated: new Date().toISOString()
      };
      
      await saveEncryptedBudget(initialData);
      setBudgetCategories(initialData.categories);
      setTransactions(initialData.transactions);
    }
  } catch (error) {
    console.error('Error loading budget data:', error);
    if (error.message.includes('Invalid passphrase')) {
      setIsUnlocked(false);
      setPassphrase('');
      setShowPassphraseModal(true);
      showNotification('Session expired. Please re-enter your passphrase.', 'warning');
    } else {
      showNotification('Error loading budget data', 'error');
    }
  }
}, [user?.uid, user?.displayName, user?.name, defaultCategories, isUnlocked, passphrase]);
// Add function to lock the budget
const lockBudget = () => {
  setIsUnlocked(false);
  setPassphrase('');
  setBudgetCategories([]);
  setTransactions([]);
  setShowPassphraseModal(true);
  showNotification('Budget locked successfully', 'info');
};

   // Partner and upline system functions
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

  const loadUserDownlines = useCallback(async () => {
    try {
      if (!user?.uid) return;
      const downlineQuery = query(collection(db, 'users'), where('selectedUplines', 'array-contains', user.uid));
      const downlineSnapshot = await getDocs(downlineQuery);
      const downlines = downlineSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserDownlines(downlines);
    } catch (error) {
      console.error('Error loading downlines:', error);
    }
  }, [user?.uid]);

  const loadUserUplines = useCallback(async () => {
    try {
      if (!user?.uid) return;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setSelectedUplines(userData.selectedUplines || []);
      }
    } catch (error) {
      console.error('Error loading user uplines:', error);
    }
  }, [user?.uid]);

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
      if (!user?.uid) return;
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
  }, [user?.uid]);

  const sendPartnerRequest = useCallback(async (targetUserId, event) => {
    event?.preventDefault();
    try {
      if (!user?.uid) return;
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
        createdAt: serverTimestamp(),
        message: `${user.displayName || user.name} wants to be your budget planning partner.`
      };
      await addDoc(collection(db, 'partnerRequests'), requestData);
      setShowPartnerSelector(false);
      showNotification('Partner request sent successfully!', 'success');
    } catch (error) {
      console.error('Error sending partner request:', error);
      showNotification('Error sending partner request', 'error');
    }
  }, [user?.uid, user?.displayName, user?.name]);


  const removePartner = useCallback(async () => {
    try {
      if (!user?.uid) return;
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
  }, [user?.uid, selectedPartner]);

   const loadInitialData = useCallback(async () => {
    try {
      // Load all necessary data for initialization
      await Promise.all([
        loadBudgetData(),
        loadAvailableUplines(),
        loadUserUplines(),
        loadUserPartner(),
        loadPartnerRequests(),
        loadUserDownlines(),
        getAllBankMappings().then(mappings => {
          setSavedMappings(mappings);
        })
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      showNotification('Error loading data. Please refresh the page.', 'error');
    }
  }, [loadBudgetData, loadAvailableUplines, loadUserUplines, loadUserPartner, loadPartnerRequests, loadUserDownlines, getAllBankMappings]);

  // ============================================================================
  // 6. REGULAR EVENT HANDLERS (no useCallback needed, depend on current state)
  // ============================================================================
// Function to handle passphrase submission
const handlePassphraseSubmit = async (inputPassphrase) => {
  if (!inputPassphrase.trim()) {
    setPassphraseError('Passphrase is required');
    return;
  }

  try {
    setIsLoading(true);
    setPassphraseError('');
    
    // Try to load and decrypt budget data with the provided passphrase
    const budgetRef = isSharedPlan && sharedPlanId
      ? doc(db, 'sharedBudgets', sharedPlanId)
      : doc(db, 'budgets', `${user.uid}_budget`);
    
    const budgetDoc = await getDoc(budgetRef);
    
    if (budgetDoc.exists()) {
      const data = budgetDoc.data();
      
      if (isBudgetEncrypted(data)) {
        // Try to decrypt with the provided passphrase
        try {
          const decryptedData = decryptData(data.encryptedData, inputPassphrase);
          
          // Successfully decrypted - set the passphrase and unlock
          setPassphrase(inputPassphrase);
          setIsUnlocked(true);
          setBudgetCategories(decryptedData.categories || defaultCategories);
          setTransactions(decryptedData.transactions || []);
          setShowPassphraseModal(false);
          setPassphraseInput('');
          showNotification('Budget unlocked successfully!', 'success');
          
        } catch (decryptError) {
          console.error('Decryption failed:', decryptError);
          setPassphraseError('Invalid passphrase. Please try again.');
          return;
        }
      } else {
        // Budget exists but is not encrypted - this shouldn't happen
        setPassphraseError('Budget data is corrupted. Please contact support.');
        return;
      }
    } else {
      // No budget exists - create new encrypted budget with this passphrase
      console.log('Creating new encrypted budget');
      setIsSettingPassphrase(true);
      
      // Set the passphrase first before creating the budget
      setPassphrase(inputPassphrase);
      
      const newBudgetData = {
        categories: defaultCategories,
        transactions: [],
        lastUpdated: new Date().toISOString()
      };
      
      // Now save the encrypted budget with the passphrase set
      await saveEncryptedBudgetWithPassphrase(newBudgetData, inputPassphrase);
      
      setBudgetCategories(defaultCategories);
      setTransactions([]);
      setIsUnlocked(true);
      setShowPassphraseModal(false);
      setPassphraseInput('');
      setIsSettingPassphrase(false);
      showNotification('Budget created and encrypted successfully!', 'success');
    }
  } catch (error) {
    console.error('Passphrase verification failed:', error);
    setPassphraseError('An error occurred. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

 // Helper function to save encrypted budget with a specific passphrase
const saveEncryptedBudgetWithPassphrase = async (budgetData, specificPassphrase) => {
  if (!specificPassphrase) {
    throw new Error('No passphrase provided for encryption');
  }

  try {
    const budgetRef = isSharedPlan && sharedPlanId
      ? doc(db, 'sharedBudgets', sharedPlanId)
      : doc(db, 'budgets', `${user.uid}_budget`);

    const encryptedData = encryptData(budgetData, specificPassphrase);
    
    const encryptedBudget = {
      isEncrypted: true,
      encryptedData: encryptedData,
      lastUpdated: serverTimestamp(),
      userId: user.uid
    };

    if (isSharedPlan && sharedPlanId) {
      encryptedBudget.sharedPlanId = sharedPlanId;
    }

    await setDoc(budgetRef, encryptedBudget);
  } catch (error) {
    console.error('Error saving encrypted budget with passphrase:', error);
    throw error;
  }
};
// Function to save encrypted budget data
const saveEncryptedBudget = async (budgetData) => {
  if (!passphrase) {
    console.error('saveEncryptedBudget called without passphrase. Current state:', {
      isUnlocked,
      passphraseLength: passphrase?.length || 0
    });
    throw new Error('No passphrase available for encryption. Please unlock the budget first.');
  }

  try {
    const budgetRef = isSharedPlan && sharedPlanId
      ? doc(db, 'sharedBudgets', sharedPlanId)
      : doc(db, 'budgets', `${user.uid}_budget`);

    const encryptedData = encryptData(budgetData, passphrase);
    
    const encryptedBudget = {
      isEncrypted: true,
      encryptedData: encryptedData,
      lastUpdated: serverTimestamp(),
      userId: user.uid
    };

    if (isSharedPlan && sharedPlanId) {
      encryptedBudget.sharedPlanId = sharedPlanId;
    }

    await setDoc(budgetRef, encryptedBudget);
  } catch (error) {
    console.error('Error saving encrypted budget:', error);
    throw error;
  }
};
const updateBudgetData = async (updatedCategories, updatedTransactions) => {
  if (!user?.uid) return;
  if (!isUnlocked || !passphrase) {
    showNotification('Budget must be unlocked to make changes', 'error');
    return;
  }

  setIsEditing(true);
  try {
    const budgetData = {
      categories: updatedCategories,
      transactions: updatedTransactions,
      lastUpdated: new Date().toISOString()
    };

    await saveEncryptedBudget(budgetData);
    setBudgetCategories(updatedCategories);
    setTransactions(updatedTransactions);
  } catch (error) {
    console.error('Budget update failed:', error);
    showNotification('Error updating budget data', 'error');
  } finally {
    setTimeout(() => setIsEditing(false), 1000);
  }
};
 const refreshMappings = async () => {
  try {
    setIsLoading(true);
    
    // Just refresh the list of saved mappings
    const updatedMappings = await getAllBankMappings();
    setSavedMappings(updatedMappings);
    
    showNotification('Mappings refreshed successfully!', 'success');
  } catch (error) {
    console.error('Error refreshing mappings:', error);
    showNotification('Error refreshing mappings', 'error');
  } finally {
    setIsLoading(false);
  }
};

    // Get all category and subcategory names for the dropdown
  const getAllCategoryOptions = () => {
    const options = [];
    displayCategories.forEach(cat => {
      if (cat.type === newTransaction.type) {
        options.push({ value: cat.name, label: cat.name, isSubcategory: false });
        if (cat.subcategories) {
          cat.subcategories.forEach(sub => {
            options.push({ 
              value: sub.name, 
              label: `${cat.name} → ${sub.name}`, 
              isSubcategory: true,
              parentCategory: cat.name
            });
          });
        }
      }
    });
    return options;
  };

  // Auto-suggest category when description changes
  const handleDescriptionChange = async (description) => {
    setNewTransaction(prev => ({ ...prev, description }));
    
    if (description.length > 3) {
      const suggestion = await getSuggestedCategory(description);
      if (suggestion.category) {
        setNewTransaction(prev => ({ ...prev, category: suggestion.category }));
      }
    }
  };
    // Add missing function: navigateMonth (referenced at lines 1219 and 1248)
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


   // Toggle functions
  const toggleCategoryExpansion = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Enhanced transaction loading with show/hide functionality
  const toggleTransactionVisibility = async () => {
    if (showTransactions) {
      setShowTransactions(false);
      return;
    }
    
    setLoadingTransactions(true);
    // Simulate loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
    setShowTransactions(true);
    setLoadingTransactions(false);
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

const respondToPartnerRequest = async (requestId, accept) => {
    try {
      if (!user?.uid) return;
      const requestRef = doc(db, 'partnerRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      if (!requestDoc.exists()) return;
      const requestData = requestDoc.data();
      if (accept) {
        await updateDoc(doc(db, 'users', user.uid), { partnerId: requestData.requesterId });
        await updateDoc(doc(db, 'users', requestData.requesterId), { partnerId: user.uid });
        await updateDoc(requestRef, { status: 'accepted', respondedAt: serverTimestamp() });
        await loadUserPartner();
        await loadBudgetData();
        showNotification('Partner request accepted!', 'success');
      } else {
        await updateDoc(requestRef, { status: 'declined', respondedAt: serverTimestamp() });
        showNotification('Partner request declined', 'info');
      }
      await loadPartnerRequests();
    } catch (error) {
      console.error('Error responding to partner request:', error);
      showNotification('Error responding to partner request', 'error');
    }
  };

// ============================================================================
  // 7. CATEGORY MANAGEMENT FUNCTIONS
  // ============================================================================
  // Category and subcategory management functions

  const handleAddCategory = async (event) => {
    event?.preventDefault();
    if (!newCategory.name.trim()) return;
    
    const category = {
      id: `cat-${Date.now()}`,
      name: newCategory.name.trim(),
      budget: parseFloat(newCategory.budget) || 0,
      color: newCategory.color,
      type: newCategory.type || 'expense',
      spent: 0,
      subcategories: []
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

  const handleAddSubcategory = async (event) => {
    event?.preventDefault();
    if (!newSubcategory.name.trim() || !addingSubcategoryTo) return;
    
    const subcategory = {
      id: `subcat-${Date.now()}`,
      name: newSubcategory.name.trim(),
      budget: parseFloat(newSubcategory.budget) || 0,
      color: newSubcategory.color,
      spent: 0
    };
    
    try {
      // Find the parent category
      const parentCategory = displayCategories.find(cat => cat.id === addingSubcategoryTo);
      if (!parentCategory) throw new Error('Parent category not found');
      
      // Add the subcategory to the parent category's subcategories array
      const updatedParentCategory = {
        ...parentCategory,
        subcategories: [...(parentCategory.subcategories || []), subcategory]
      };
      
      // Update the budget data with the new subcategory
      const updatedCategories = displayCategories.map(cat => 
        cat.id === addingSubcategoryTo ? updatedParentCategory : cat
      );
      await updateBudgetData(updatedCategories, displayTransactions);
      setNewSubcategory({ name: '', budget: '', color: '#3b82f6', parentId: null });
      setShowAddSubcategory(false);
      setAddingSubcategoryTo(null);
      showNotification('Subcategory added successfully!', 'success');
    } catch (error) {
      console.error('Error adding subcategory:', error);
      showNotification('Error adding subcategory', 'error');
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

  const handleEditSubcategory = (subcategory, parentCategoryId) => {
    setEditingSubcategory({ ...subcategory, parentCategoryId });
  };

  const handleSaveSubcategory = async () => {
    if (!editingSubcategory) return;
    try {
      // Find the parent category of the subcategory being edited
      const parentCategory = displayCategories.find(cat => 
        cat.id === editingSubcategory.parentCategoryId
      );
      
      if (parentCategory) {
        const updatedSubcategories = parentCategory.subcategories.map(sub => 
          sub.id === editingSubcategory.id ? editingSubcategory : sub
        );
        const updatedParentCategory = {
          ...parentCategory,
          subcategories: updatedSubcategories
        };
        
        const updatedCategories = displayCategories.map(cat => 
          cat.id === parentCategory.id ? updatedParentCategory : cat
        );
        await updateBudgetData(updatedCategories, displayTransactions);
        setEditingSubcategory(null);
        showNotification('Subcategory updated successfully!', 'success');
      }
    } catch (error) {
      console.error('Error updating subcategory:', error);
      showNotification('Error updating subcategory', 'error');
    }
  };

  const handleDeleteSubcategory = async (subcategoryId, parentCategoryId) => {
    try {
      const parentCategory = displayCategories.find(cat => cat.id === parentCategoryId);
      
      if (parentCategory) {
        const updatedSubcategories = parentCategory.subcategories.filter(sub => sub.id !== subcategoryId);
        const updatedParentCategory = {
          ...parentCategory,
          subcategories: updatedSubcategories
        };
        
        const updatedCategories = displayCategories.map(cat => 
          cat.id === parentCategory.id ? updatedParentCategory : cat
        );
        await updateBudgetData(updatedCategories, displayTransactions);
        showNotification('Subcategory deleted successfully!', 'success');
      }
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      showNotification('Error deleting subcategory', 'error');
    }
  };
  // Transaction management functions
const handleAddTransaction = async () => {
  if (!user || !newTransaction.amount || !newTransaction.description) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    const categoryInfo = findCategoryAndSubcategory(newTransaction.category);
    
    const transaction = {
      id: `trans-${Date.now()}`,
      ...newTransaction,
      amount: parseFloat(newTransaction.amount),
      userId: user.uid,
      // Store additional category metadata
      categoryType: categoryInfo.isSubcategory ? 'subcategory' : 'category',
      parentCategory: categoryInfo.isSubcategory ? categoryInfo.parentCategory.name : null,
      createdAt: serverTimestamp()
    };
    
    const updatedTransactions = [transaction, ...displayTransactions];
    await updateBudgetData(displayCategories, updatedTransactions);
    
    // Save category mapping for future suggestions
    if (newTransaction.category) {
      await saveCategoryMapping(newTransaction.description.toLowerCase(), newTransaction.category);
    }
    
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

// Add this function before the useEffect hooks
const recalculateCategorySpending = useCallback(() => {
  const updatedCategories = displayCategories.map(category => {
    const categorySpent = currentMonthTransactions
      .filter(t => t.type === 'expense' && t.category === category.name)
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Update subcategory spending
    const updatedSubcategories = (category.subcategories || []).map(sub => {
      const subSpent = currentMonthTransactions
        .filter(t => t.type === 'expense' && t.category === sub.name)
        .reduce((sum, t) => sum + t.amount, 0);
      return { ...sub, spent: subSpent };
    });
    
    return { 
      ...category, 
      spent: categorySpent,
      subcategories: updatedSubcategories
    };
  });
  
  setBudgetCategories(updatedCategories);
}, [displayCategories, currentMonthTransactions]);

// And call this function in handleSaveTransaction after updating transactions:
// Replace the existing handleSaveTransaction function around line 1564-1590
const handleSaveTransaction = async () => {
  if (!editingTransaction) return;
  
  try {
    const originalTransaction = displayTransactions.find(t => t.id === editingTransaction.id);
    const categoryChanged = originalTransaction && originalTransaction.category !== editingTransaction.category;
    
    const updatedTransactions = displayTransactions.map(t =>
      t.id === editingTransaction.id ? {
        ...editingTransaction,
        amount: Math.abs(parseFloat(editingTransaction.amount))
      } : t
    );
    
    // Update budget data with new transactions
    await updateBudgetData(displayCategories, updatedTransactions);
    
    // If category changed and we have a new category, ask about mapping
    if (categoryChanged && editingTransaction.category && editingTransaction.description) {
      // Check if there are other transactions with similar descriptions
      const similarTransactions = displayTransactions.filter(t => 
        t.id !== editingTransaction.id && 
        t.description.toLowerCase().includes(editingTransaction.description.toLowerCase().trim()) &&
        t.category !== editingTransaction.category
      );
      
      if (similarTransactions.length > 0) {
        // Store the mapping details for the confirmation dialog
        setPendingMapping({
          description: editingTransaction.description,
          newCategory: editingTransaction.category,
          affectedTransactions: similarTransactions
        });
        setShowMappingConfirmDialog(true);
      } else {
        // No similar transactions, just save the mapping
        await saveCategoryMapping(editingTransaction.description, editingTransaction.category);
      }
    }
    
    setEditingTransaction(null);
    showNotification('Transaction updated successfully!', 'success');
    
    // Force recalculation of category spending
    setTimeout(() => recalculateCategorySpending(), 100);
    
  } catch (error) {
    console.error('Error updating transaction:', error);
    showNotification('Error updating transaction', 'error');
  }
};
// Add this new function after handleSaveTransaction
const handleConfirmMapping = async (applyToExisting = false) => {
  if (!pendingMapping) return;
  
  try {
    // Save the category mapping for future transactions
    await saveCategoryMapping(pendingMapping.description, pendingMapping.newCategory);
    
    if (applyToExisting && pendingMapping.affectedTransactions.length > 0) {
      // Apply the new category to existing similar transactions
      const updatedTransactions = displayTransactions.map(transaction => {
        const shouldUpdate = pendingMapping.affectedTransactions.some(affected => affected.id === transaction.id);
        if (shouldUpdate) {
          return {
            ...transaction,
            category: pendingMapping.newCategory
          };
        }
        return transaction;
      });
      
      // Update the budget data with the modified transactions
      await updateBudgetData(displayCategories, updatedTransactions);
      
      showNotification(
        `Updated ${pendingMapping.affectedTransactions.length} similar transactions with new category`, 
        'success'
      );
    } else {
      showNotification('Category mapping saved for future transactions', 'success');
    }
    
    // Force recalculation of category spending
    setTimeout(() => recalculateCategorySpending(), 100);
    
  } catch (error) {
    console.error('Error applying category mapping:', error);
    showNotification('Error applying category mapping', 'error');
  } finally {
    setShowMappingConfirmDialog(false);
    setPendingMapping(null);
  }
};
// Update the handleCSVFile function to not auto-import
const handleCSVFile = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  console.log('Processing CSV file:', file.name); // Debug log
  
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      console.log('CSV parsed:', results.data);
      const headers = Object.keys(results.data[0] || {});
      setCsvHeaders(headers);
      setRawCsvRows(results.data);
      
      // Try to find an existing mapping for these headers
      console.log('Looking for existing mapping for headers:', headers);
      const existingMapping = await findMatchingMapping(headers);
      
      if (existingMapping) {
        console.log('Found existing mapping:', existingMapping);
        // Auto-apply the existing mapping including dateFormat
        setSelectedBank(existingMapping.bank);
        setFieldMapping({
          ...existingMapping.mapping,
          dateFormat: existingMapping.dateFormat || existingMapping.mapping.dateFormat || 'DD/MM/YYYY'
        });
        showNotification(`Auto-loaded mapping for ${existingMapping.bank}`, 'success');
      } else {
        console.log('No existing mapping found, showing mapping modal');
        // No existing mapping found, reset to defaults and show the mapping modal
        setFieldMapping({
          amount: '',
          date: '',
          description: '',
          type: '',
          category: '',
          dateFormat: 'DD/MM/YYYY' // Default to DD/MM/YYYY
        });
      }
      
      // Always show mapping modal for user confirmation
      setShowMappingModal(true);
    },
    error: (error) => {
      console.error('CSV parsing error:', error);
      showNotification('Error parsing CSV file', 'error');
    }
  });
};

  const handlePDFFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      console.log('Extracted PDF text:', fullText);
      // Process PDF text as needed
      showNotification('PDF imported successfully', 'success');
    } catch (error) {
      console.error('Error processing PDF:', error);
      showNotification('Error processing PDF file', 'error');
    }
  };
  // Add missing function: handleImportTransactions (referenced at lines 1891 and 2068)
  const handleImportTransactions = async () => {
    if (csvTransactions.length === 0) {
      showNotification('No transactions to import', 'error');
      return;
    }
    
    console.log('Importing transactions:', csvTransactions); // Debug log
    
    try {
      // Add transactions to current transactions list
      const updatedTransactions = [...displayTransactions, ...csvTransactions];
      console.log('Updated transactions:', updatedTransactions); // Debug log
      
      // Update budget data with new transactions
      await updateBudgetData(displayCategories, updatedTransactions);
      
      // Clear CSV data
      setCsvTransactions([]);
      setShowCSVImport(false);
      showNotification(`Successfully imported ${csvTransactions.length} transactions!`, 'success');
    } catch (error) {
      console.error('Error importing transactions:', error);
      showNotification('Error importing transactions', 'error');
    }
  };

// Update the handleMapAndImport function to show preview instead of importing
// Fix the handleMapAndImport function around line 1683-1751

const handleMapAndImport = async () => {
  // Check that required fields are mapped (not ignored)
  const requiredFields = ['amount', 'description', 'date'];
  const missingRequired = requiredFields.filter(field => 
    !fieldMapping[field] || fieldMapping[field] === 'IGNORE'
  );
  
  if (!selectedBank || missingRequired.length > 0) {
    showNotification(`Missing required fields: ${missingRequired.join(', ')}`, 'error');
    return;
  }
  
  console.log('Starting mapping with:', { selectedBank, fieldMapping, rawCsvRows: rawCsvRows.length });
  
  try {
    const mappedTransactions = [];
    
    for (let i = 0; i < rawCsvRows.length; i++) {
      const row = rawCsvRows[i];
      
      // Extract field values based on mapping
      const rawAmount = fieldMapping.amount !== 'IGNORE' ? row[fieldMapping.amount] : '';
      const rawDate = fieldMapping.date !== 'IGNORE' ? row[fieldMapping.date] : '';
      const rawDescription = fieldMapping.description !== 'IGNORE' ? row[fieldMapping.description] : '';
      const rawType = fieldMapping.type !== 'IGNORE' ? row[fieldMapping.type] : '';
      const rawCategory = fieldMapping.category !== 'IGNORE' ? row[fieldMapping.category] : '';
      
      // Parse amount using the new currency parser
      const amount = parseCurrency(rawAmount);
      
      // Parse date with specified format
      const date = parseDate(rawDate, fieldMapping.dateFormat || 'DD/MM/YYYY');
      
      // Clean description
      const description = rawDescription ? rawDescription.toString().trim() : '';
      
      // Determine transaction type
      let type = 'expense'; // default
      if (rawType) {
        const typeStr = rawType.toString().toLowerCase();
        if (typeStr.includes('credit') || typeStr.includes('deposit') || typeStr.includes('income')) {
          type = 'income';
        }
      }
      
      // Get suggested category - FIX: Ensure we get a string, not an object
      let suggestedCategory = '';
      if (rawCategory) {
        suggestedCategory = rawCategory.toString().trim();
      } else {
        try {
          const categoryResult = await getSuggestedCategory(description);
          // Ensure we extract just the category name string, not the whole object
          if (typeof categoryResult === 'string') {
            suggestedCategory = categoryResult;
          } else if (categoryResult && typeof categoryResult === 'object') {
            // If getSuggestedCategory returns an object, extract the category name
            suggestedCategory = categoryResult.category || categoryResult.name || '';
          }
        } catch (error) {
          console.warn('Error getting suggested category:', error);
          suggestedCategory = '';
        }
      }
      
      // Create mapped transaction
      const mappedTransaction = {
        id: `import-${Date.now()}-${i}`,
        type,
        amount,
        description,
        category: suggestedCategory, // This should now always be a string
        date,
        rawData: {
          rawAmount,
          rawDate,
          rawType,
          originalRow: row
        }
      };
      
      // Validate transaction - improved validation
      if (amount > 0 && description && date) {
        mappedTransactions.push(mappedTransaction);
        console.log(`✓ Mapped transaction ${i + 1}:`, {
          amount: mappedTransaction.amount,
          description: mappedTransaction.description,
          date: mappedTransaction.date,
          category: mappedTransaction.category, // Log the category to verify it's a string
          rawAmount
        });
      } else {
        console.log(`✗ Skipping invalid transaction ${i + 1}:`, {
          amount,
          description,
          date,
          rawAmount,
          reason: !amount ? 'Invalid amount' : !description ? 'Missing description' : 'Invalid date'
        });
      }
    }
    
    console.log(`Final mapped transactions: ${mappedTransactions.length}`);
    
    if (mappedTransactions.length === 0) {
      showNotification('No valid transactions found to import', 'warning');
      return;
    }
    
    // Set preview data and show preview modal
    setCsvPreviewData(mappedTransactions);
    setShowMappingModal(false);
    setShowPreviewModal(true);
    
  } catch (error) {
    console.error('Mapping error:', error);
    showNotification('Error processing CSV data', 'error');
  }
};
// Add new function to handle confirmed import
const handleConfirmImport = async () => {
  if (csvPreviewData.length === 0) {
    showNotification('No transactions to import', 'error');
    return;
  }
  
  console.log('Importing confirmed transactions:', csvPreviewData); // Debug log
  
  try {
    // Clean preview data (remove rawData before importing)
    const cleanTransactions = csvPreviewData.map(({ rawData, ...transaction }) => transaction);
    
    // Add transactions to current transactions list
    const updatedTransactions = [...displayTransactions, ...cleanTransactions];
    console.log('Updated transactions:', updatedTransactions); // Debug log
    
    // Update budget data with new transactions
    await updateBudgetData(displayCategories, updatedTransactions);
    
    // Clear preview data and close modals
    setCsvPreviewData([]);
    setShowPreviewModal(false);
    showNotification(`Successfully imported ${cleanTransactions.length} transactions!`, 'success');
  } catch (error) {
    console.error('Error importing transactions:', error);
    showNotification('Error importing transactions', 'error');
  }
};
const handleCancel = () => {
    setShowPassphraseModal(false);
    if (onCancel) {
      onCancel();
    }
  };
 // ============================================================================
 // 10. useEffect HOOKS (at the very end, before return)
 // ============================================================================
    // useEffect hooks for component lifecycle
  // Replace the existing useEffect around line 1822-1843
  useEffect(() => {
  // Recalculate spending for all categories and subcategories
  const updatedCategories = displayCategories.map(category => {
    const categorySpent = currentMonthTransactions
      .filter(t => t.type === 'expense' && t.category === category.name)
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Update subcategory spending
    const updatedSubcategories = (category.subcategories || []).map(sub => {
      const subSpent = currentMonthTransactions
        .filter(t => t.type === 'expense' && t.category === sub.name)
        .reduce((sum, t) => sum + t.amount, 0);
      return { ...sub, spent: subSpent };
    });
    
    return { 
      ...category, 
      spent: categorySpent,
      subcategories: updatedSubcategories
    };
  });
  
  // Only update if there are actual changes to prevent infinite loops
  const hasChanges = updatedCategories.some((cat, index) => {
    const currentCat = budgetCategories[index];
    if (!currentCat) return true;
    
    if (cat.spent !== currentCat.spent) return true;
    
    // Check subcategory changes
    if (cat.subcategories && currentCat.subcategories) {
      return cat.subcategories.some((sub, subIndex) => {
        const currentSub = currentCat.subcategories[subIndex];
        return !currentSub || sub.spent !== currentSub.spent;
      });
    }
    
    return cat.subcategories?.length !== currentCat.subcategories?.length;
  });
  
  if (hasChanges) {
    setBudgetCategories(updatedCategories);
  }
  // eslint-disable-next-line
  }, [displayTransactions, currentMonthTransactions, selectedMonth, selectedYear]);

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

// ============================================================================
// 11. EARLY RETURNS (loading states, authentication checks)
// ============================================================================
// Loading and authentication screens

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
              {isUnlocked && (
                <button
                  onClick={lockBudget}
                  className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-9a2 2 0 00-2-2H6a2 2 0 00-2 2v9a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4" />
                  </svg>
                  Lock Budget
                </button>
              )}
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
        {/* Enhanced Categories Section - Compact Grid Layout */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Budget Categories</h2>
            <button
              onClick={() => setShowAddCategory(true)}
              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600 transition-colors font-medium"
            >
              <PlusCircle className="w-4 h-4" />
              Add Category
            </button>
          </div>
          
          {/* Expense Categories */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Expense Categories</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayCategories.filter(cat => cat.type === 'expense').map(category => (
                <div key={category.id} className="bg-white rounded-xl shadow-md p-4 border border-gray-100 hover:shadow-lg transition-all">
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
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                          <h4 className="font-semibold text-gray-900 text-sm truncate">{category.name}</h4>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditCategory(category)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-600 mb-2">
                        <span className="font-medium">{formatCurrency(category.spent || 0)}</span> of <span className="font-medium">{formatCurrency(category.budget)}</span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-3">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(category.spent || 0, category.budget)}`}
                          style={{ width: `${Math.min(((category.spent || 0) / category.budget) * 100, 100)}%` }}
                        ></div>
                      </div>

                     {/* Enhanced Subcategories */}
                     
                        {category.subcategories && category.subcategories.length > 0 && (
                        <div>
                            <button
                            onClick={() => toggleCategoryExpansion(category.id)}
                            className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 mb-2"
                            >
                            {expandedCategories[category.id] ? (
                                <ChevronUp className="w-3 h-3" />
                            ) : (
                                <ChevronDown className="w-3 h-3" />
                            )}
                            {category.subcategories.length} subcategories
                            </button>
                            
                            {expandedCategories[category.id] && (
                            <div className="space-y-2">
                                {category.subcategories.map(sub => (
                                <div key={sub.id} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                                    {editingSubcategory && editingSubcategory.id === sub.id ? (
                                    <div className="space-y-2">
                                        <input
                                        type="text"
                                        value={editingSubcategory.name}
                                        onChange={(e) => setEditingSubcategory({...editingSubcategory, name: e.target.value})}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                                        />
                                        <input
                                        type="number"
                                        value={editingSubcategory.budget}
                                        onChange={(e) => setEditingSubcategory({...editingSubcategory, budget: parseFloat(e.target.value) || 0})}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                                        />
                                        <div className="flex gap-1">
                                        <button
                                            onClick={handleSaveSubcategory}
                                            className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded text-xs"
                                        >
                                            <Save className="w-3 h-3" />
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setEditingSubcategory(null)}
                                            className="flex items-center gap-1 bg-gray-500 text-white px-2 py-1 rounded text-xs"
                                        >
                                            <X className="w-3 h-3" />
                                            Cancel
                                        </button>
                                        </div>
                                    </div>
                                    ) : (
                                    <>
                                        <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }}></div>
                                            <span className="text-xs font-medium text-gray-900">{sub.name}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                            onClick={() => handleEditSubcategory(sub, category.id)}
                                            className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                            <Edit3 className="w-2.5 h-2.5" />
                                            </button>
                                            <button
                                            onClick={() => handleDeleteSubcategory(sub.id, category.id)}
                                            className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                                            >
                                            <Trash2 className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                        </div>
                                        
                                        <div className="text-xs text-gray-500 mb-1">
                                        {formatCurrency(sub.spent || 0)} / {formatCurrency(sub.budget)}
                                        </div>
                                        
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={`h-1.5 rounded-full transition-all duration-500 ${getProgressColor(sub.spent || 0, sub.budget)}`}
                                            style={{ width: `${Math.min(((sub.spent || 0) / sub.budget) * 100, 100)}%` }}
                                        ></div>
                                        </div>
                                    </>
                                    )}
                                </div>
                                ))}
                            </div>
                            )}
                        </div>
                        )}

                        {/* Add Subcategory Section - ALWAYS VISIBLE for expanded categories or categories without subcategories */}
                        {(
                        // Show if category is expanded, OR if category has no subcategories
                        (expandedCategories[category.id] && category.subcategories && category.subcategories.length > 0) ||
                        (!category.subcategories || category.subcategories.length === 0)
                        ) && (
                        <div className="mt-2">
                            {/* Add Subcategory Inline Form */}
                            {showAddSubcategory && addingSubcategoryTo === category.id ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <h5 className="text-xs font-semibold text-blue-800 mb-2">Add New Subcategory</h5>
                                <form onSubmit={handleAddSubcategory} className="space-y-2">
                                <input
                                    type="text"
                                    value={newSubcategory.name}
                                    onChange={(e) => setNewSubcategory({...newSubcategory, name: e.target.value})}
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                                    placeholder="Subcategory name"
                                    required
                                    autoFocus
                                />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newSubcategory.budget}
                                    onChange={(e) => setNewSubcategory({...newSubcategory, budget: e.target.value})}
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                                    placeholder="Budget amount"
                                    required
                                />
                                <input
                                    type="color"
                                    value={newSubcategory.color}
                                    onChange={(e) => setNewSubcategory({...newSubcategory, color: e.target.value})}
                                    className="w-full p-1 border border-gray-200 rounded-lg h-8"
                                />
                                <div className="flex gap-1">
                                    <button
                                    type="submit"
                                    className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all text-xs font-medium"
                                    >
                                    <PlusCircle className="w-3 h-3" />
                                    Add Subcategory
                                    </button>
                                    <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddSubcategory(false);
                                        setAddingSubcategoryTo(null);
                                        setNewSubcategory({ name: '', budget: '', color: '#3b82f6', parentId: null });
                                    }}
                                    className="px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-xs font-medium"
                                    >
                                    Cancel
                                    </button>
                                </div>
                                </form>
                            </div>
                            ) : (
                            // Show "Add Subcategory" button
                            <button
                                onClick={() => {
                                setAddingSubcategoryTo(category.id);
                                setShowAddSubcategory(true);
                                setNewSubcategory({ 
                                    name: '', 
                                    budget: '', 
                                    color: category.color, // Default to parent category color
                                    parentId: category.id 
                                });
                                // Auto-expand the category if it has subcategories
                                if (category.subcategories && category.subcategories.length > 0) {
                                    setExpandedCategories(prev => ({
                                    ...prev,
                                    [category.id]: true
                                    }));
                                }
                                }}
                                className="w-full flex items-center gap-1 bg-purple-500 text-white px-2 py-1.5 rounded-lg hover:bg-purple-600 transition-colors text-xs font-medium"
                            >
                                <PlusCircle className="w-3 h-3" />
                                Add Subcategory
                            </button>
                            )}
                        </div>
                        )}
                        {/* End Add Subcategory Section */}                                             
                    </>
                  )}
                </div>
              ))}
            </div>
          </div> 
            {/* Income Categories */}
            {/* Income Categories */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Income Categories</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayCategories.filter(cat => cat.type === 'income').map(category => (
                <div key={category.id} className="bg-white rounded-xl shadow-md p-4 border border-gray-100 hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                      <h4 className="font-semibold text-gray-900 text-sm truncate">{category.name}</h4>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditCategory(category)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-600 mb-2">
                    <span className="font-medium text-green-600">{formatCurrency(category.budget)}</span> expected
                  </div>
                  
                  <div className="w-full bg-green-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-green-500 w-full"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Enhanced Transactions Section with Toggle */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 font-medium">{currentMonthTransactions.length} this month</span>
              <button
                onClick={toggleTransactionVisibility}
                disabled={loadingTransactions}
                className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-xl hover:bg-indigo-600 transition-colors font-medium disabled:opacity-50"
              >
                {loadingTransactions ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : showTransactions ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {loadingTransactions ? 'Loading...' : showTransactions ? 'Hide Transactions' : 'Show Transactions'}
              </button>
              <button
                onClick={() => setShowAddTransaction(true)}
                className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-colors font-medium"
              >
                <PlusCircle className="w-4 h-4" />
                Add Transaction
              </button>
            </div>
          </div>
          
          {showTransactions && (
            currentMonthTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMonthTransactions.map(transaction => (
                      <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(transaction.date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{transaction.description}</div>
                        </td>
                        <td className="py-3 px-4">
                          {transaction.category && (
                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-medium">
                              <Tag className="w-3 h-3" />
                              {transaction.category}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                            transaction.type === 'income' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {transaction.type === 'income' ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {transaction.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-bold ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                           <button
                                onClick={() => {
                                  if (!isUnlocked) {
                                    showNotification('Please unlock your budget first', 'warning');
                                    setShowPassphraseModal(true);
                                    return;
                                  }
                                  setEditingTransaction(transaction);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(transaction.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PoundSterling className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No transactions yet</p>
                <p className="text-gray-400 text-sm mt-1">Add your first transaction to get started!</p>
              </div>
            )
          )}
          
          {!showTransactions && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="w-6 h-6 text-indigo-600" />
              </div>
              <p className="text-gray-500 font-medium">Click "Show Transactions" to view your transaction history</p>
            </div>
          )}
        </div>
      </div>
{/* All Modal Components */}

{/* Passphrase Modal */}
{showPassphraseModal && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-9a2 2 0 00-2-2H6a2 2 0 00-2 2v9a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            {isSettingPassphrase ? 'Set Budget Passphrase' : 'Enter Budget Passphrase'}
          </h3>
          <p className="text-sm text-gray-500">
            {isSettingPassphrase ? 
              'Create a passphrase to encrypt your budget' : 
              'Enter your passphrase to unlock your budget'
            }
          </p>
        </div>
      </div>
      
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Passphrase
        </label>
        <input
          type="password"
          value={passphraseInput}
          onChange={(e) => {
            setPassphraseInput(e.target.value);
            setPassphraseError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handlePassphraseSubmit(passphraseInput);
            }
          }}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your passphrase"
          autoFocus
        />
        {passphraseError && (
          <p className="mt-2 text-sm text-red-600">{passphraseError}</p>
        )}
        
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 13.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Important:</p>
              <p>Your passphrase is not stored anywhere. If you forget it, you will lose access to your budget data permanently.</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => handlePassphraseSubmit(passphraseInput)}
            disabled={!passphraseInput.trim() || isLoading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isSettingPassphrase ? 'Creating...' : 'Unlocking...'}
              </>
            ) : (
              isSettingPassphrase ? 'Create Budget' : 'Unlock Budget'
            )}
          </button>
        </div>
    </div>
  </div>
)}      

{/* Enhanced Edit Transaction Modal */}
{editingTransaction && isUnlocked && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
      <h3 className="text-xl font-bold mb-6 text-gray-900">Edit Transaction</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
          <select
            value={editingTransaction.type}
            onChange={e => setEditingTransaction({ 
              ...editingTransaction, 
              type: e.target.value,
              category: '' // Reset category when type changes
            })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
          <input
            type="number"
            step="0.01"
            value={editingTransaction.amount}
            onChange={e => setEditingTransaction({ ...editingTransaction, amount: parseFloat(e.target.value) || 0 })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
          <input
            type="text"
            value={editingTransaction.description}
            onChange={e => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Grocery shopping"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
          <select
            value={editingTransaction.category || ''}
            onChange={e => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select category</option>
            {/* Debug: Show if categories are loaded */}
            {displayCategories.length === 0 && (
              <option disabled>Loading categories...</option>
            )}
            {/* Main Categories and Subcategories */}
            {displayCategories
              .filter(cat => cat.type === editingTransaction.type)
              .map(category => [
                // Main category option
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>,
                // Subcategory options
                ...(category.subcategories || []).map(sub => (
                  <option key={sub.id} value={sub.name}>
                    └── {sub.name}
                  </option>
                ))
              ]).flat()}
          </select>
          
          {/* Debug info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-1 text-xs text-gray-500">
              Debug: {displayCategories.filter(cat => cat.type === editingTransaction.type).length} categories available
            </div>
          )}
          
          {/* Category Helper Text */}
          {editingTransaction.category && (
            <div className="mt-2">
              {(() => {
                // Find if selected category is a subcategory
                const selectedCategory = displayCategories
                  .filter(cat => cat.type === editingTransaction.type)
                  .find(cat => {
                    return cat.name === editingTransaction.category || 
                           (cat.subcategories && cat.subcategories.some(sub => sub.name === editingTransaction.category));
                  });
                
                if (selectedCategory) {
                  // Check if it's a subcategory
                  if (selectedCategory.subcategories && 
                      selectedCategory.subcategories.some(sub => sub.name === editingTransaction.category)) {
                    const subcategory = selectedCategory.subcategories.find(sub => sub.name === editingTransaction.category);
                    return (
                      <div className="text-xs bg-purple-50 text-purple-700 p-2 rounded border border-purple-200">
                        <span className="font-medium">Subcategory of:</span> {selectedCategory.name}
                        <br />
                        <span className="font-medium">Budget:</span> {formatCurrency(subcategory.budget)}
                        <br />
                        <span className="font-medium">Spent:</span> {formatCurrency(subcategory.spent || 0)}
                      </div>
                    );
                  } else {
                    // It's a main category
                    return (
                      <div className="text-xs bg-blue-50 text-blue-700 p-2 rounded border border-blue-200">
                        <span className="font-medium">Main Category</span>
                        <br />
                        <span className="font-medium">Budget:</span> {formatCurrency(selectedCategory.budget)}
                        <br />
                        <span className="font-medium">Spent:</span> {formatCurrency(selectedCategory.spent || 0)}
                      </div>
                    );
                  }
                }
                return null;
              })()}
            </div>
          )}
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
      
      {/* Action Buttons */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={handleSaveTransaction}
          disabled={!editingTransaction.amount || !editingTransaction.description}
          className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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

{/* Enhanced Add Transaction Modal - for consistency */}
{showAddTransaction && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
      <h3 className="text-xl font-bold mb-6 text-gray-900">Add New Transaction</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
          <select
            value={newTransaction.type}
            onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value, category: ''})}
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
            onChange={(e) => handleDescriptionChange(e.target.value)}
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
            {/* Main Categories with Subcategories */}
            {displayCategories
              .filter(cat => cat.type === newTransaction.type)
              .map(category => (
                <optgroup key={category.id} label={category.name}>
                  <option value={category.name}>
                    {category.name}
                  </option>
                  {/* Subcategories */}
                  {category.subcategories && category.subcategories.map(sub => (
                    <option key={sub.id} value={sub.name}>
                      └── {sub.name}
                    </option>
                  ))}
                </optgroup>
              ))
            }
          </select>

          {/* Category Helper Text */}
          {newTransaction.category && (
            <div className="mt-2">
              {(() => {
                // Find if selected category is a subcategory
                const selectedCategory = displayCategories
                  .filter(cat => cat.type === newTransaction.type)
                  .find(cat => {
                    return cat.name === newTransaction.category || 
                           (cat.subcategories && cat.subcategories.some(sub => sub.name === newTransaction.category));
                  });
                
                if (selectedCategory) {
                  const isSubcategory = selectedCategory.subcategories && 
                                       selectedCategory.subcategories.some(sub => sub.name === newTransaction.category);
                  
                  if (isSubcategory) {
                    const subcategory = selectedCategory.subcategories.find(sub => sub.name === newTransaction.category);
                    return (
                      <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subcategory.color }}></div>
                        <span>
                          <span className="font-medium">{selectedCategory.name}</span> → 
                          <span className="font-medium text-blue-600"> {subcategory.name}</span>
                        </span>
                        <span className="ml-auto text-gray-500">
                          Budget: {formatCurrency(subcategory.budget)}
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedCategory.color }}></div>
                        <span className="font-medium">{selectedCategory.name}</span>
                        <span className="ml-auto text-gray-500">
                          Budget: {formatCurrency(selectedCategory.budget)}
                        </span>
                      </div>
                    );
                  }
                }
                return null;
              })()}
            </div>
          )}
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
{/* Category Mapping Confirmation Dialog */}
{showMappingConfirmDialog && pendingMapping && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
          <Tag className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Update Similar Transactions?</h3>
          <p className="text-sm text-gray-500">Apply category change to existing transactions</p>
        </div>
      </div>
      
      <div className="mb-6">
        <p className="text-gray-700 mb-4">
          Found <strong>{pendingMapping.affectedTransactions.length}</strong> existing transaction(s) 
          with similar descriptions to "<strong>{pendingMapping.description}</strong>".
        </p>
        
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">New category:</p>
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm font-medium">
            <Tag className="w-3 h-3" />
            {pendingMapping.newCategory}
          </span>
        </div>
        
        <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
          <p className="text-sm font-medium text-gray-700 mb-2">Affected transactions:</p>
          {pendingMapping.affectedTransactions.slice(0, 5).map((transaction, index) => (
            <div key={transaction.id} className="text-xs text-gray-600 mb-1">
              • {transaction.description} - {formatCurrency(transaction.amount)}
              {transaction.category && ` (currently: ${transaction.category})`}
            </div>
          ))}
          {pendingMapping.affectedTransactions.length > 5 && (
            <div className="text-xs text-gray-500">
              ...and {pendingMapping.affectedTransactions.length - 5} more
            </div>
          )}
        </div>
      </div>
      
      <div className="flex gap-3">
        <button
          onClick={() => handleConfirmMapping(true)}
          className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all font-semibold"
        >
          Update All ({pendingMapping.affectedTransactions.length})
        </button>
        <button
          onClick={() => handleConfirmMapping(false)}
          className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-xl hover:bg-gray-600 transition-colors font-semibold"
        >
          Only This One
        </button>
        <button
          onClick={() => {
            setShowMappingConfirmDialog(false);
            setPendingMapping(null);
          }}
          className="px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
{/* CSV Import Modal - Separate from edit modal */}


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

{/* CSV Preview Modal - Add this after the existing modals */}
{showPreviewModal && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl p-6 w-full max-w-6xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Review Import Data</h3>
          <p className="text-sm text-gray-600 mt-1">
            Preview {csvPreviewData.length} transactions mapped from your CSV file
          </p>
        </div>
        <button
          onClick={() => setShowPreviewModal(false)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-6 h-6 text-gray-500" />
        </button>
      </div>

      {/* Mapping Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-blue-900 mb-2">Mapping Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Bank:</span>
            <span className="ml-2 text-blue-800">{selectedBank}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Amount:</span>
            <span className="ml-2 text-blue-800">{fieldMapping.amount}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Date:</span>
            <span className="ml-2 text-blue-800">{fieldMapping.date}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Description:</span>
            <span className="ml-2 text-blue-800">{fieldMapping.description}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Date Format:</span>
            <span className="ml-2 text-blue-800">{fieldMapping.dateFormat}</span>
          </div>
        </div>
      </div>

      {/* Preview Table - Enhanced with better scrolling */}
      <div className="flex-1 overflow-hidden mb-6 border border-gray-200 rounded-lg">
        <div className="overflow-x-auto overflow-y-auto max-h-96 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 border-b">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 border-b">Description</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 border-b">Category</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 border-b">Type</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 border-b">Amount</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 border-b">Raw Data</th>
              </tr>
            </thead>
            <tbody>
              {csvPreviewData.slice(0, 50).map((transaction, index) => (
                <tr key={transaction.id} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                  <td className="py-3 px-4 text-gray-600">
                    {new Date(transaction.date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900 truncate max-w-xs" title={transaction.description}>
                      {transaction.description}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {transaction.category && (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                        <Tag className="w-3 h-3" />
                        {/* SAFE CATEGORY RENDERING - Ensure it's always a string */}
                        {typeof transaction.category === 'string' 
                          ? transaction.category 
                          : transaction.category?.name || transaction.category?.category || 'Unknown'
                        }
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      transaction.type === 'income' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {transaction.type === 'income' ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {transaction.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-bold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    <div className="space-y-1">
                      <div>Amount: {transaction.rawData?.rawAmount}</div>
                      <div>Date: {transaction.rawData?.rawDate}</div>
                      {transaction.rawData?.rawType && <div>Type: {transaction.rawData?.rawType}</div>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {csvPreviewData.length > 50 && (
          <div className="text-center py-4 text-gray-500 text-sm bg-gray-50 border-t">
            Showing first 50 of {csvPreviewData.length} transactions
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Ready to import {csvPreviewData.length} transactions
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPreviewModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setShowPreviewModal(false);
              setShowMappingModal(true);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
          >
            Edit Mapping
          </button>
          <button
            onClick={handleConfirmImport}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-lg transition-all font-medium"
          >
            Confirm Import ({csvPreviewData.length})
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Add Category Modal */}
{showAddCategory && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
          <PlusCircle className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Add New Category</h3>
          <p className="text-sm text-gray-500">Create a new budget category</p>
        </div>
      </div>
      
      <form onSubmit={handleAddCategory} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Category Name</label>
          <input
            type="text"
            value={newCategory.name}
            onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Food & Dining"
            required
            autoFocus
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Budget Amount</label>
          <input
            type="number"
            step="0.01"
            value={newCategory.budget}
            onChange={(e) => setNewCategory({...newCategory, budget: e.target.value})}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Category Type</label>
          <select
            value={newCategory.type}
            onChange={(e) => setNewCategory({...newCategory, type: e.target.value})}
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
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-12"
          />
        </div>
        
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-4 rounded-xl hover:shadow-lg transition-all font-semibold"
          >
            Add Category
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddCategory(false);
              setNewCategory({ name: '', budget: '', color: '#3b82f6', type: 'expense' });
            }}
            className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-xl hover:bg-gray-600 transition-colors font-semibold"
          >
            Cancel
          </button>
        </div>
      </form>
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
              const mappings = await getAllBankMappings();
              setSavedMappings(mappings);
              setShowEditMappings(!showEditMappings);
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
                        setFieldMapping(m.mapping);
                        setSelectedBank(m.bank);
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
                <option value="IGNORE" className="text-gray-500 italic">Ignore this field</option>
                {csvHeaders.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>
          ))}

          {/* Date Format Selection - KEEP THIS SECTION */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date Format</label>
            <select
              value={fieldMapping.dateFormat || 'DD/MM/YYYY'}
              onChange={e => setFieldMapping({ ...fieldMapping, dateFormat: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g., 25/12/2023)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g., 12/25/2023)</option>
              <option value="YYYY/MM/DD">YYYY/MM/DD (e.g., 2023/12/25)</option>
              <option value="DD/MM/YY">DD/MM/YY (e.g., 25/12/23)</option>
              <option value="MM/DD/YY">MM/DD/YY (e.g., 12/25/23)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select the date format used in your CSV file
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={async () => {
              if (selectedBank && (fieldMapping.amount || fieldMapping.date || fieldMapping.description)) {
                await saveBankMapping(selectedBank, csvHeaders, fieldMapping);
                const mappings = await getAllBankMappings();
                setSavedMappings(mappings);
                showNotification('Mapping saved successfully!', 'success');
              }
              handleMapAndImport();
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


      {/* Partner Requests Display */}
      {pendingPartnerRequests.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-4 border border-gray-200 max-w-sm">
          <h4 className="font-bold text-gray-900 mb-3">Partner Requests</h4>
          {pendingPartnerRequests.map(request => (
            <div key={request.id} className="bg-gray-50 rounded-xl p-3 mb-3 last:mb-0">
              <p className="text-sm text-gray-700 mb-2">{request.message}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => respondToPartnerRequest(request.id, true)}
                  className="flex-1 bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={() => respondToPartnerRequest(request.id, false)}
                  className="flex-1 bg-red-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upline/Downline Display */}
      {userDownlines.length > 0 && (
        <div className="fixed bottom-4 left-4 z-50 bg-white rounded-2xl shadow-2xl p-4 border border-gray-200 max-w-sm">
          <h4 className="font-bold text-gray-900 mb-3">Your Team ({userDownlines.length})</h4>
          <div className="space-y-2">
            {userDownlines.slice(0, 3).map(downline => (
              <div key={downline.id} className="flex items-center gap-2 text-sm">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-xs">
                    {(downline.displayName || downline.name || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-gray-700">{downline.displayName || downline.name}</span>
                <button
                  onClick={() => loadBudgetData(downline.id)}
                  className="ml-auto text-blue-600 hover:text-blue-700 text-xs"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            ))}
            {userDownlines.length > 3 && (
              <p className="text-xs text-gray-500">+{userDownlines.length - 3} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetExpensesTracker;

