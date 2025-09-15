import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Users, ArrowLeft, Search, Edit3, Trash2, Phone, MapPin, CheckCircle2, Circle } from 'lucide-react';
import { collection, query, getDocs, doc, addDoc, updateDoc, where, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const ContactManagementPage = ({ user, onBack }) => {
  // State variables
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [editingContactInline, setEditingContactInline] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    location: 'UK',
    notes: '',
    status: 'active'
  });

  // Pipeline steps configuration
  const pipelineSteps = [
    { id: 'dtm', name: 'DTM', description: 'Drop the Message' },
    { id: 'mg1', name: 'MG1', description: 'Meet & Greet 1' },
    { id: 'mg2', name: 'MG2', description: 'Meet & Greet 2' },
    { id: 'board_plan', name: 'BP1', description: 'Board Plan Presentation' },
    { id: 'follow_up', name: 'FU1', description: 'Follow Up 1' },
    { id: 'board_plan_2', name: 'BP2', description: 'Board Plan 2' },
    { id: 'follow_up_2', name: 'FU2', description: 'Follow Up 2' },
    { id: 'launch', name: 'Launch', description: 'Launch' }
  ];

  // Status options
  const statusOptions = [
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800', icon: '🟢' },
    { value: 'not_interested', label: 'Not Interested', color: 'bg-red-100 text-red-800', icon: '🔴' },
    { value: 'disappeared', label: 'Disappeared', color: 'bg-gray-100 text-gray-800', icon: '⚫' }
  ];

  // Countries dropdown options
  const countries = [
    { value: 'UK', label: 'United Kingdom' },
    { value: 'India', label: 'India' },
    { value: 'USA', label: 'United States' },
    { value: 'Europe', label: 'Europe' },
    { value: 'Australia', label: 'Australia' }
  ];

  // Load contacts function - now includes partner contacts
  const loadContacts = useCallback(async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    try {
      // Load user's own contacts
      const userContactsQuery = query(
        collection(db, 'contacts'),
        where('assignedTo', '==', user.uid)
      );
      const userContactsSnapshot = await getDocs(userContactsQuery);
      
      const userContacts = userContactsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isPartnerContact: false
      }));

      let allContacts = [...userContacts];

      // Check if user has a partner
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.partnerId) {
          // Get partner info
          const partnerDoc = await getDoc(doc(db, 'users', userData.partnerId));
          const partnerName = partnerDoc.exists() ? 
            (partnerDoc.data().displayName || partnerDoc.data().name || 'Partner') : 'Partner';

          // Load partner's contacts
          const partnerContactsQuery = query(
            collection(db, 'contacts'),
            where('assignedTo', '==', userData.partnerId)
          );
          const partnerContactsSnapshot = await getDocs(partnerContactsQuery);
          
          const partnerContacts = partnerContactsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isPartnerContact: true,
            partnerName: partnerName
          }));

          allContacts = [...userContacts, ...partnerContacts];
        }
      }
      
      setContacts(allContacts);
      setFilteredContacts(allContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user.uid]);

  // Filter contacts based on search and filters
  useEffect(() => {
    let filtered = contacts;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone.includes(searchTerm) ||
        contact.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Location filter
    if (filterLocation !== 'all') {
      filtered = filtered.filter(contact => contact.location === filterLocation);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(contact => {
        const completedSteps = pipelineSteps.filter(step => 
          contact.pipeline?.[step.id]?.completed
        ).length;
        
        switch (filterStatus) {
          case 'not_started':
            return completedSteps === 0;
          case 'in_progress':
            return completedSteps > 0 && completedSteps < pipelineSteps.length;
          case 'launched':
            return contact.pipeline?.launch?.completed;
          case 'partner_contacts':
            return contact.isPartnerContact;
          case 'active':
            return contact.status === 'active' || !contact.status; // Default to active for legacy contacts
          case 'not_interested':
            return contact.status === 'not_interested';
          case 'disappeared':
            return contact.status === 'disappeared';
          default:
            return true;
        }
      });
    }

    setFilteredContacts(filtered);
  }, [contacts, searchTerm, filterLocation, filterStatus, pipelineSteps]);

  // Create/update contact function - FIXED
  const saveContact = useCallback(async (contactData, contactId = null) => {
    try {
      const existingContactId = contactId || editingContact?.id;
      
      if (existingContactId) {
        // For updates, only update basic contact fields, never touch pipeline
        const contactRef = doc(db, 'contacts', existingContactId);
        await updateDoc(contactRef, {
          name: contactData.name,
          phone: contactData.phone,
          location: contactData.location,
          notes: contactData.notes,
          status: contactData.status,
          updatedAt: new Date()
          // Deliberately NOT including pipeline to preserve it
        });
      } else {
        // For new contacts, create complete object with new pipeline
        const contactToSave = {
          name: contactData.name,
          phone: contactData.phone,
          location: contactData.location,
          notes: contactData.notes,
          status: contactData.status,
          assignedTo: user.uid,
          assignedBy: user.uid,
          assignedByName: user.displayName || user.name,
          createdAt: new Date(),
          updatedAt: new Date(),
          pipeline: pipelineSteps.reduce((acc, step) => ({
            ...acc,
            [step.id]: { completed: false, completedDate: null }
          }), {})
        };
        
        await addDoc(collection(db, 'contacts'), contactToSave);
      }

      // Reload contacts
      await loadContacts();

      // Reset form
      setNewContact({ name: '', phone: '', location: 'UK', notes: '', status: 'active' });
      setEditingContact(null);
      setEditingContactInline(null);
      setShowContactModal(false);
    } catch (error) {
      console.error('Error saving contact:', error);
    }
  }, [user.uid, user.displayName, user.name, loadContacts, editingContact, pipelineSteps]);

  // Update pipeline step
  const updatePipelineStep = useCallback(async (contactId, stepId, completed) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      const updatedPipeline = {
        ...contact.pipeline,
        [stepId]: {
          completed: completed,
          completedDate: completed ? new Date() : null
        }
      };

      const contactRef = doc(db, 'contacts', contactId);
      await updateDoc(contactRef, {
        pipeline: updatedPipeline,
        updatedAt: new Date()
      });

      // Update local state
      setContacts(prev => prev.map(c => 
        c.id === contactId 
          ? { ...c, pipeline: updatedPipeline }
          : c
      ));
    } catch (error) {
      console.error('Error updating pipeline step:', error);
    }
  }, [contacts]);

  // Update pipeline step date
  const updatePipelineStepDate = useCallback(async (contactId, stepId, newDate) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      const updatedPipeline = {
        ...contact.pipeline,
        [stepId]: {
          ...contact.pipeline[stepId],
          completedDate: newDate ? new Date(newDate) : null
        }
      };

      const contactRef = doc(db, 'contacts', contactId);
      await updateDoc(contactRef, {
        pipeline: updatedPipeline,
        updatedAt: new Date()
      });

      // Update local state
      setContacts(prev => prev.map(c => 
        c.id === contactId 
          ? { ...c, pipeline: updatedPipeline }
          : c
      ));
    } catch (error) {
      console.error('Error updating pipeline step date:', error);
    }
  }, [contacts]);

  // Update contact notes
  const updateContactNotes = useCallback(async (contactId, notes) => {
    try {
      const contactRef = doc(db, 'contacts', contactId);
      await updateDoc(contactRef, {
        notes: notes,
        updatedAt: new Date()
      });

      setContacts(prev => prev.map(c => 
        c.id === contactId ? { ...c, notes } : c
      ));
    } catch (error) {
      console.error('Error updating contact notes:', error);
    }
  }, []);

  // Update contact status
  const updateContactStatus = useCallback(async (contactId, status) => {
    try {
      const contactRef = doc(db, 'contacts', contactId);
      await updateDoc(contactRef, {
        status: status,
        updatedAt: new Date()
      });

      setContacts(prev => prev.map(c => 
        c.id === contactId ? { ...c, status } : c
      ));
    } catch (error) {
      console.error('Error updating contact status:', error);
    }
  }, []);

  // Delete contact (only for user's own contacts)
  const deleteContact = useCallback(async (contactId) => {
    if (!window.confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'contacts', contactId));
      await loadContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  }, [loadContacts]);

  // Load contacts when component mounts
  useEffect(() => {
    if (user?.uid) {
      loadContacts();
    }
  }, [user?.uid, loadContacts]);

  // Get contact statistics
  const getContactStats = () => {
    const total = contacts.length;
    const userContacts = contacts.filter(c => !c.isPartnerContact).length;
    const partnerContacts = contacts.filter(c => c.isPartnerContact).length;
    const launched = contacts.filter(c => 
      c.pipeline?.launch?.completed
    ).length;
    const inProgress = contacts.filter(c => {
      const completedSteps = pipelineSteps.filter(step => 
        c.pipeline?.[step.id]?.completed
      ).length;
      return completedSteps > 0 && completedSteps < pipelineSteps.length;
    }).length;
    const notStarted = contacts.filter(c => {
      const completedSteps = pipelineSteps.filter(step => 
        c.pipeline?.[step.id]?.completed
      ).length;
      return completedSteps === 0;
    }).length;
    const active = contacts.filter(c => c.status === 'active' || !c.status).length;
    const notInterested = contacts.filter(c => c.status === 'not_interested').length;
    const disappeared = contacts.filter(c => c.status === 'disappeared').length;

    return { total, userContacts, partnerContacts, launched, inProgress, notStarted, active, notInterested, disappeared };
  };

  const stats = getContactStats();

  // Inline editing component for contact cards
  const InlineEditCard = ({ contact, onSave, onCancel }) => {
    const [editData, setEditData] = useState({
      name: contact.name,
      phone: contact.phone || '',
      location: contact.location || 'UK',
      notes: contact.notes || '',
      status: contact.status || 'active'
    });

    const handleSave = () => {
      onSave(editData, contact.id);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        handleSave();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };

    return (
      <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50 shadow-lg">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={editData.name}
              onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={editData.phone}
              onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              value={editData.location}
              onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              {countries.map(country => (
                <option key={country.value} value={country.value}>
                  {country.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={editData.status}
              onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={editData.notes}
              onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={!editData.name.trim()}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:bg-gray-300"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
        
        <div className="text-xs text-gray-500 mt-2 text-center">
          Press Ctrl+Enter to save, Esc to cancel
        </div>
      </div>
    );
  };

  // Contact Card Component - FIXED GRADIENTS
const ContactCard = ({ contact }) => {
  const completedSteps = pipelineSteps.filter(step => 
    contact.pipeline?.[step.id]?.completed
  ).length;
  const totalSteps = pipelineSteps.length;
  const progressPercent = (completedSteps / totalSteps) * 100;
  
  // Get contact status properly
  const contactStatus = statusOptions.find(s => s.value === (contact.status || 'active')) || statusOptions[0];

  // Define gradient backgrounds based on status - FIXED
  const getCardGradient = () => {
    switch (contact.status || 'active') {
      case 'active':
        return {
          background: 'linear-gradient(to bottom right, #ecfdf5, #f0fdf4, #f0fdfa)',
          borderColor: '#bbf7d0'
        };
      case 'not_interested':
        return {
          background: 'linear-gradient(to bottom right, #fef2f2, #fff1f2, #fdf2f8)',
          borderColor: '#fecaca'
        };
      case 'disappeared':
        return {
          background: 'linear-gradient(to bottom right, #f9fafb, #f8fafc, #fafafa)',
          borderColor: '#e5e7eb'
        };
      default:
        return {
          background: 'linear-gradient(to bottom right, #eff6ff, #eef2ff, #faf5ff)',
          borderColor: '#dbeafe'
        };
    }
  };

  // Get progress-based accent color - FIXED
    const getProgressAccent = () => {
    if (progressPercent === 100) return 'linear-gradient(to right, #34d399, #10b981)';
    if (progressPercent > 50) return 'linear-gradient(to right, #60a5fa, #6366f1)';
    return 'linear-gradient(to right, #fbbf24, #f59e0b)';
  };

  // Get status-based glow effect
  const getStatusGlow = () => {
    switch (contact.status || 'active') {
      case 'active':
        return 'shadow-green-100/50';
      case 'not_interested':
        return 'shadow-red-100/50';
      case 'disappeared':
        return 'shadow-gray-200/50';
      default:
        return 'shadow-blue-100/50';
    }
  };

  const handleDoubleClick = () => {
    if (!contact.isPartnerContact) {
      setEditingContactInline(contact.id);
    }
  };

  if (editingContactInline === contact.id) {
    return (
      <InlineEditCard
        contact={contact}
        onSave={saveContact}
        onCancel={() => setEditingContactInline(null)}
      />
    );
  }

  return (
     <div 
      className={`rounded-xl shadow-lg ${getStatusGlow()} p-6 hover:shadow-xl transition-all duration-500 cursor-pointer group relative overflow-hidden border`}
      style={getCardGradient()}
      onDoubleClick={handleDoubleClick}
      title={contact.isPartnerContact ? "Partner contact - view only" : "Double-click to edit"}
    >
      {/* Animated background overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 transform -skew-x-12 group-hover:translate-x-full" style={{animation: 'shimmer 2s infinite'}}></div>
      
      {/* Header Section */}
      <div className="relative bg-white/70 backdrop-blur-sm rounded-lg p-4 mb-4 border border-white/50 shadow-sm">
        <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-gray-800 text-lg truncate">{contact.name}</h3>
              {contact.isPartnerContact && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100/90 text-purple-800 border border-purple-200/60 shadow-sm">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 717 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                  </svg>
                  Partner
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-700 mb-3">
              {contact.phone && (
                <div className="flex items-center gap-1">
                  <Phone size={14} className="text-gray-600" />
                  <span>{contact.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <MapPin size={14} className="text-gray-600" />
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100/90 text-blue-800 border border-blue-200/60 shadow-sm">
                  {countries.find(c => c.value === contact.location)?.label || contact.location}
                </span>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {!contact.isPartnerContact && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingContact(contact);
                    setNewContact({
                      name: contact.name,
                      phone: contact.phone || '',
                      location: contact.location || 'UK',
                      notes: contact.notes || '',
                      status: contact.status || 'active'
                    });
                    setShowContactModal(true);
                  }}
                  className="p-2 text-gray-500 hover:text-blue-600 transition-colors bg-white/70 rounded-lg backdrop-blur-sm border border-white/50 hover:bg-white/90 shadow-sm"
                  title="Edit contact"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteContact(contact.id);
                  }}
                  className="p-2 text-gray-500 hover:text-red-600 transition-colors bg-white/70 rounded-lg backdrop-blur-sm border border-white/50 hover:bg-white/90 shadow-sm"
                  title="Delete contact"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Status Section */}
      <div className="mb-5">
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Contact Status</span>
            <span className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-semibold ${contactStatus.color} border border-white/50 shadow-sm backdrop-blur-sm`}>
              <span className="mr-2 text-base">{contactStatus.icon}</span>
              {contactStatus.label}
            </span>
          </div>
          {!contact.isPartnerContact && (
            <select
              value={contact.status || 'active'}
              onChange={(e) => {
                e.stopPropagation();
                updateContactStatus(contact.id, e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full border border-white/50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm bg-white/80 backdrop-blur-sm shadow-sm"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      
      {/* Progress Bar with Enhanced Gradient */}
      <div className="mb-5">
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
          <div className="flex justify-between text-sm text-gray-700 mb-3 font-medium">
            <span>Pipeline Progress</span>
            <span className="font-bold">{completedSteps}/{totalSteps} Steps ({Math.round(progressPercent)}%)</span>
          </div>
          <div className="relative w-full bg-gray-200/60 rounded-full h-4 overflow-hidden shadow-inner">
            {/* Background pattern */}
            <div className="absolute inset-0 bg-gradient-to-r from-gray-100/50 to-gray-200/50"></div>
            {/* Progress bar with enhanced gradient */}
            <div 
                className="relative h-4 rounded-full transition-all duration-700 ease-out shadow-lg"
                style={{ 
                  width: `${progressPercent}%`,
                  background: getProgressAccent(),
                  boxShadow: `0 0 20px rgba(59, 130, 246, 0.3)` 
                }}
              >
              {/* Animated shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Steps */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {pipelineSteps.map(step => {
          const stepData = contact.pipeline?.[step.id] || { completed: false, completedDate: null };
          return (
            <div key={step.id} className="text-center">
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-white/50 hover:bg-white/70 transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="text-xs font-semibold text-gray-700 mb-2 truncate" title={step.description}>
                  {step.name}
                </div>
                <div className="flex flex-col items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updatePipelineStep(contact.id, step.id, !stepData.completed);
                    }}
                    className="mb-2 text-gray-400 hover:text-green-600 transition-all duration-300 transform hover:scale-110"
                    disabled={contact.isPartnerContact}
                  >
                    {stepData.completed ? (
                      <CheckCircle2 size={22} className="text-green-600 drop-shadow-sm" />
                    ) : (
                      <Circle size={22} className="hover:text-green-500" />
                    )}
                  </button>
                  <div className="text-xs">
                    {stepData.completed ? (
                      <input
                        type="date"
                        value={stepData.completedDate ? 
                          new Date(stepData.completedDate.toDate?.() || stepData.completedDate).toISOString().split('T')[0] : 
                          new Date().toISOString().split('T')[0]
                        }
                        onChange={(e) => {
                          e.stopPropagation();
                          updatePipelineStepDate(contact.id, step.id, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-green-700 border-none bg-white/70 rounded px-1 py-0.5 w-full text-center text-xs cursor-pointer hover:bg-white/90 transition-colors font-medium shadow-sm"
                        disabled={contact.isPartnerContact}
                        title="Click to change date"
                      />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes Section */}
      {(contact.notes || !contact.isPartnerContact) && (
        <div className="border-t border-white/30 pt-4">
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white/50 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-2">Notes</div>
            {contact.isPartnerContact ? (
              <div className="text-sm text-gray-700 bg-white/50 rounded-lg p-3 min-h-[3rem] border border-white/40">
                {contact.notes || 'No notes'}
              </div>
            ) : (
              <textarea
                value={contact.notes || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  updateContactNotes(contact.id, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full border border-white/50 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-white/80 backdrop-blur-sm placeholder-gray-500 shadow-sm"
                rows={3}
                placeholder="Add notes about this contact..."
              />
            )}
          </div>
        </div>
      )}
      
      {/* Double-click hint */}
      {!contact.isPartnerContact && (
        <div className="text-xs text-gray-600 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center bg-white/50 rounded-full py-2 px-3 border border-white/40 shadow-sm backdrop-blur-sm">
          Double-click to edit
        </div>
      )}
        <style jsx>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%) skewX(-12deg); }
            100% { transform: translateX(200%) skewX(-12deg); }
          }
        `}</style>
      </div>      
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center text-gray-600 hover:text-gray-800 p-1"
                >
                  <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
                </button>
              )}
              <div className="min-w-0 flex-1 sm:flex-none">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Users className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="truncate">Contact Management</span>
                </h1>
                <p className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1">
                  Track prospects through your sales pipeline • Double-click cards to edit
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    viewMode === 'cards' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Cards
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    viewMode === 'table' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Table
                </button>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setEditingContact(null);
                  setNewContact({ name: '', phone: '', location: 'UK', notes: '', status: 'active' });
                  setShowContactModal(true);
                }}
                className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm sm:text-base"
              >
                <Plus size={14} className="sm:w-4 sm:h-4" />
                <span className="sm:hidden">Add</span>
                <span className="hidden sm:inline">Add Contact</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs sm:text-sm text-gray-600">Total</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-xs sm:text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">{stats.notInterested}</div>
            <div className="text-xs sm:text-sm text-gray-600">Not Interested</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-600">{stats.disappeared}</div>
            <div className="text-xs sm:text-sm text-gray-600">Disappeared</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600">{stats.partnerContacts}</div>
            <div className="text-xs sm:text-sm text-gray-600">Partner</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600">{stats.launched}</div>
            <div className="text-xs sm:text-sm text-gray-600">Launched</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="space-y-3 sm:space-y-0 sm:flex sm:gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex gap-2 sm:gap-4">
              {/* Location Filter */}
              <div className="flex-1 sm:w-40">
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Locations</option>
                  {countries.map(country => (
                    <option key={country.value} value={country.value}>
                      {country.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex-1 sm:w-40">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">🟢 Active</option>
                  <option value="not_interested">🔴 Not Interested</option>
                  <option value="disappeared">⚫ Disappeared</option>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="launched">Launched</option>
                  <option value="partner_contacts">Partner Contacts</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Contacts Display */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {viewMode === 'cards' ? (
            /* Cards View */
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts.map(contact => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
              
              {/* Empty State for Cards */}
              {filteredContacts.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Users size={48} className="mx-auto mb-4 text-gray-300" />
                  {searchTerm || filterLocation !== 'all' || filterStatus !== 'all' ? (
                    <div>
                      <p className="text-lg font-medium">No contacts found</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-medium">No contacts yet</p>
                      <p className="text-sm">Add your first contact to get started</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Table View - Original table implementation */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="hidden lg:table-cell px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    {pipelineSteps.slice(0, 4).map(step => (
                      <th key={step.id} className="px-3 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                        <div className="flex flex-col">
                          <span>{step.name}</span>
                          <span className="hidden lg:block text-xs text-gray-400 normal-case font-normal">{step.description}</span>
                        </div>
                      </th>
                    ))}
                    {pipelineSteps.slice(4).map(step => (
                      <th key={step.id} className="hidden xl:table-cell px-3 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                        <div className="flex flex-col">
                          <span>{step.name}</span>
                          <span className="text-xs text-gray-400 normal-case font-normal">{step.description}</span>
                        </div>
                      </th>
                    ))}
                    <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredContacts.map(contact => {
                    const contactStatus = statusOptions.find(s => s.value === (contact.status || 'active')) || statusOptions[0];
                    
                    return (
                      <tr key={contact.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium text-gray-900 text-sm flex items-center gap-2">
                                {contact.name}
                                {contact.isPartnerContact && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 717 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                                    </svg>
                                    Partner
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 lg:hidden">{contact.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                          {contact.phone}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {countries.find(c => c.value === contact.location)?.value || contact.location}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {contact.isPartnerContact ? (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${contactStatus.color}`}>
                              <span className="mr-1">{contactStatus.icon}</span>
                              {contactStatus.label}
                            </span>
                          ) : (
                            <select
                              value={contact.status || 'active'}
                              onChange={(e) => updateContactStatus(contact.id, e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {statusOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.icon} {option.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        
                        {/* Pipeline steps */}
                        {pipelineSteps.slice(0, 4).map(step => {
                          const stepData = contact.pipeline?.[step.id] || { completed: false, completedDate: null };
                          return (
                            <td key={step.id} className="px-3 py-4 text-center">
                              <div className="flex flex-col items-center">
                                <input
                                  type="checkbox"
                                  checked={stepData.completed}
                                  onChange={(e) => updatePipelineStep(contact.id, step.id, e.target.checked)}
                                  disabled={contact.isPartnerContact}
                                  className="mb-1 w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                />
                                {stepData.completed ? (
                                  <input
                                    type="date"
                                    value={stepData.completedDate ? 
                                      new Date(stepData.completedDate.toDate?.() || stepData.completedDate).toISOString().split('T')[0] : 
                                      new Date().toISOString().split('T')[0]
                                    }
                                    onChange={(e) => updatePipelineStepDate(contact.id, step.id, e.target.value)}
                                    disabled={contact.isPartnerContact}
                                    className="text-xs text-green-600 font-medium border-none bg-transparent p-0 w-16 text-center"
                                    style={{ fontSize: '10px' }}
                                  />
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        
                        {pipelineSteps.slice(4).map(step => {
                          const stepData = contact.pipeline?.[step.id] || { completed: false, completedDate: null };
                          return (
                            <td key={step.id} className="hidden xl:table-cell px-3 py-4 text-center">
                              <div className="flex flex-col items-center">
                                <input
                                  type="checkbox"
                                  checked={stepData.completed}
                                  onChange={(e) => updatePipelineStep(contact.id, step.id, e.target.checked)}
                                  disabled={contact.isPartnerContact}
                                  className="mb-1 w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                />
                                {stepData.completed ? (
                                  <input
                                    type="date"
                                    value={stepData.completedDate ? 
                                      new Date(stepData.completedDate.toDate?.() || stepData.completedDate).toISOString().split('T')[0] : 
                                      new Date().toISOString().split('T')[0]
                                    }
                                    onChange={(e) => updatePipelineStepDate(contact.id, step.id, e.target.value)}
                                    disabled={contact.isPartnerContact}
                                    className="text-xs text-green-600 font-medium border-none bg-transparent p-0 w-16 text-center"
                                    style={{ fontSize: '10px' }}
                                  />
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        
                        <td className="hidden lg:table-cell px-6 py-4">
                          {contact.isPartnerContact ? (
                            <div className="text-sm text-gray-600 bg-gray-50 rounded px-2 py-1 max-w-xs">
                              {contact.notes || 'No notes'}
                            </div>
                          ) : (
                            <textarea
                              value={contact.notes || ''}
                              onChange={(e) => updateContactNotes(contact.id, e.target.value)}
                              className="w-full max-w-xs border border-gray-300 rounded px-2 py-1 text-sm resize-none"
                              rows={2}
                              placeholder="Add notes..."
                            />
                          )}
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContact(contact);
                                setNewContact({
                                  name: contact.name,
                                  phone: contact.phone || '',
                                  location: contact.location || 'UK',
                                  notes: contact.notes || '',
                                  status: contact.status || 'active'
                                });
                                setShowContactModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-700 text-xs"
                            >
                              Edit
                            </button>
                            {!contact.isPartnerContact && (
                              <button
                                type="button"
                                onClick={() => deleteContact(contact.id)}
                                className="text-red-600 hover:text-red-700 text-xs"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {/* Empty State for Table */}
              {filteredContacts.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Users size={48} className="mx-auto mb-4 text-gray-300" />
                  {searchTerm || filterLocation !== 'all' || filterStatus !== 'all' ? (
                    <div>
                      <p className="text-lg font-medium">No contacts found</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-medium">No contacts yet</p>
                      <p className="text-sm">Add your first contact to get started</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contact Creation/Edit Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {editingContact ? 'Edit Contact' : 'Add New Contact'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowContactModal(false);
                    setEditingContact(null);
                    setNewContact({ name: '', phone: '', location: 'UK', notes: '', status: 'active' });
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newContact.name}
                    onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter contact name"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <select
                    value={newContact.location}
                    onChange={(e) => setNewContact(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    {countries.map(country => (
                      <option key={country.value} value={country.value}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={newContact.status}
                    onChange={(e) => setNewContact(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.icon} {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Notes</label>
                  <textarea
                    value={newContact.notes}
                    onChange={(e) => setNewContact(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                    placeholder="Enter any initial notes"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowContactModal(false);
                    setEditingContact(null);
                    setNewContact({ name: '', phone: '', location: 'UK', notes: '', status: 'active' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveContact(newContact)}
                  disabled={!newContact.name.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {editingContact ? 'Update' : 'Add'} Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactManagementPage;