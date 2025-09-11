import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Users, ArrowLeft, Search } from 'lucide-react';
import { collection, query, getDocs, doc, addDoc, updateDoc, where, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const ContactManagementPage = ({ user, onBack }) => {
  // State variables
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    location: 'UK',
    notes: ''
  });

  // Pipeline steps configuration
  const pipelineSteps = [
    { id: 'dtm', name: 'DTM', description: 'Drop the Message' },
    { id: 'mg1', name: 'MG1', description: 'Meet & Greet 1' },
    { id: 'mg2', name: 'MG2', description: 'Meet & Greet 2' },
    { id: 'board_plan', name: 'Board Plan', description: 'Board Plan Presentation' },
    { id: 'follow_up', name: 'Follow Up', description: 'Follow Up 1' },
    { id: 'board_plan_2', name: 'Board Plan 2', description: 'Board Plan 2' },
    { id: 'follow_up_2', name: 'Follow Up 2', description: 'Follow Up 2' },
    { id: 'launch', name: 'Launch', description: 'Launch' }
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
          default:
            return true;
        }
      });
    }

    setFilteredContacts(filtered);
  }, [contacts, searchTerm, filterLocation, filterStatus, pipelineSteps]);

  // Create/update contact function
  const saveContact = useCallback(async (contactData) => {
    try {
      const contactToSave = {
        ...contactData,
        assignedTo: user.uid,
        assignedBy: user.uid,
        assignedByName: user.displayName || user.name,
        updatedAt: new Date(),
        pipeline: contactData.pipeline || pipelineSteps.reduce((acc, step) => ({
          ...acc,
          [step.id]: { completed: false, completedDate: null }
        }), {})
      };

      if (editingContact) {
        // Update existing contact
        const contactRef = doc(db, 'contacts', editingContact.id);
        await updateDoc(contactRef, contactToSave);
      } else {
        // Create new contact
        contactToSave.createdAt = new Date();
        await addDoc(collection(db, 'contacts'), contactToSave);
      }

      // Reload contacts
      await loadContacts();

      // Reset form
      setNewContact({ name: '', phone: '', location: 'UK', notes: '' });
      setEditingContact(null);
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

    return { total, userContacts, partnerContacts, launched, inProgress, notStarted };
  };

  const stats = getContactStats();

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
    <div className="bg-gray-50">
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
                  Track prospects through your sales pipeline
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingContact(null);
                setNewContact({ name: '', phone: '', location: 'UK', notes: '' });
                setShowContactModal(true);
              }}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <Plus size={14} className="sm:w-4 sm:h-4" />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add Contact</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs sm:text-sm text-gray-600">Total</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{stats.userContacts}</div>
            <div className="text-xs sm:text-sm text-gray-600">My Contacts</div>
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
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="launched">Launched</option>
                  <option value="partner_contacts">Partner Contacts</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Contacts Table/Cards */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {/* Desktop/Tablet Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="hidden lg:table-cell px-4 py-3 sm:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  {pipelineSteps.slice(0, 4).map(step => (
                    <th key={step.id} className="px-1 sm:px-3 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[60px] sm:min-w-[80px]">
                      <div className="flex flex-col">
                        <span>{step.name}</span>
                        <span className="hidden lg:block text-xs text-gray-400 normal-case font-normal">{step.description}</span>
                      </div>
                    </th>
                  ))}
                  {/* Show remaining steps only on larger screens */}
                  {pipelineSteps.slice(4).map(step => (
                    <th key={step.id} className="hidden xl:table-cell px-1 sm:px-3 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                      <div className="flex flex-col">
                        <span>{step.name}</span>
                        <span className="text-xs text-gray-400 normal-case font-normal">{step.description}</span>
                      </div>
                    </th>
                  ))}
                  <th className="hidden lg:table-cell px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContacts.map(contact => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
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
                          {/* Show phone on mobile under name */}
                          <div className="text-xs text-gray-500 lg:hidden">{contact.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-600">
                      {contact.phone}
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {countries.find(c => c.value === contact.location)?.value || contact.location}
                      </span>
                    </td>
                    
                    {/* First 4 pipeline steps - always visible */}
                    {pipelineSteps.slice(0, 4).map(step => {
                      const stepData = contact.pipeline?.[step.id] || { completed: false, completedDate: null };
                      return (
                        <td key={step.id} className="px-1 sm:px-3 py-3 sm:py-4 text-center">
                          <div className="flex flex-col items-center">
                            <input
                              type="checkbox"
                              checked={stepData.completed}
                              onChange={(e) => updatePipelineStep(contact.id, step.id, e.target.checked)}
                              className="mb-1 w-3 h-3 sm:w-4 sm:h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                            />
                            {stepData.completed ? (
                              <input
                                type="date"
                                value={stepData.completedDate ? 
                                  new Date(stepData.completedDate.toDate?.() || stepData.completedDate).toISOString().split('T')[0] : 
                                  new Date().toISOString().split('T')[0]
                                }
                                onChange={(e) => updatePipelineStepDate(contact.id, step.id, e.target.value)}
                                className="text-xs text-green-600 font-medium border-none bg-transparent p-0 w-12 sm:w-16 text-center"
                                style={{ fontSize: '9px' }}
                              />
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    
                    {/* Remaining pipeline steps - only on xl screens */}
                    {pipelineSteps.slice(4).map(step => {
                      const stepData = contact.pipeline?.[step.id] || { completed: false, completedDate: null };
                      return (
                        <td key={step.id} className="hidden xl:table-cell px-3 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <input
                              type="checkbox"
                              checked={stepData.completed}
                              onChange={(e) => updatePipelineStep(contact.id, step.id, e.target.checked)}
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
                      <textarea
                        value={contact.notes || ''}
                        onChange={(e) => updateContactNotes(contact.id, e.target.value)}
                        className="w-full max-w-xs border border-gray-300 rounded px-2 py-1 text-sm resize-none"
                        rows={2}
                        placeholder="Add notes..."
                      />
                    </td>
                    
                    <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingContact(contact);
                            setNewContact({
                              name: contact.name,
                              phone: contact.phone || '',
                              location: contact.location || 'UK',
                              notes: contact.notes || ''
                            });
                            setShowContactModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm"
                        >
                          Edit
                        </button>
                        {!contact.isPartnerContact && (
                          <button
                            type="button"
                            onClick={() => deleteContact(contact.id)}
                            className="text-red-600 hover:text-red-700 text-xs sm:text-sm"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Enhanced */}
          <div className="md:hidden p-3 sm:p-4 space-y-3 sm:space-y-4">
            {filteredContacts.map(contact => {
              const completedSteps = pipelineSteps.filter(step => 
                contact.pipeline?.[step.id]?.completed
              ).length;
              const totalSteps = pipelineSteps.length;
              const progressPercent = (completedSteps / totalSteps) * 100;

              return (
                <div key={contact.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{contact.name}</h3>
                        {contact.isPartnerContact && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 717 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                            </svg>
                            Partner
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{contact.phone}</p>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                        {countries.find(c => c.value === contact.location)?.label || contact.location}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingContact(contact);
                          setNewContact({
                            name: contact.name,
                            phone: contact.phone || '',
                            location: contact.location || 'UK',
                            notes: contact.notes || ''
                          });
                          setShowContactModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 px-2 py-1 border border-blue-200 rounded"
                      >
                        Edit
                      </button>
                      {!contact.isPartnerContact && (
                        <button
                          type="button"
                          onClick={() => deleteContact(contact.id)}
                          className="text-red-600 hover:text-red-700 px-2 py-1 border border-red-200 rounded"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Pipeline Progress</span>
                      <span>{completedSteps}/{totalSteps} Steps</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Pipeline Steps - Show all 8 in a responsive grid */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {pipelineSteps.map(step => {
                      const stepData = contact.pipeline?.[step.id] || { completed: false, completedDate: null };
                      return (
                        <div key={step.id} className="text-center">
                          <div className="text-xs font-medium text-gray-700 mb-1 truncate" title={step.description}>
                            {step.name}
                          </div>
                          <input 
                            type="checkbox" 
                            checked={stepData.completed}
                            onChange={(e) => updatePipelineStep(contact.id, step.id, e.target.checked)}
                            className="mb-1 w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                          />
                          <div className="text-xs">
                            {stepData.completed ? (
                              <input
                                type="date"
                                value={stepData.completedDate ? 
                                  new Date(stepData.completedDate.toDate?.() || stepData.completedDate).toISOString().split('T')[0] : 
                                  new Date().toISOString().split('T')[0]
                                }
                                onChange={(e) => updatePipelineStepDate(contact.id, step.id, e.target.value)}
                                className="text-green-600 border-none bg-transparent p-0 w-full text-center text-xs"
                              />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Notes */}
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-1">Notes</div>
                    <textarea
                      value={contact.notes || ''}
                      onChange={(e) => updateContactNotes(contact.id, e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-none"
                      rows={2}
                      placeholder="Add notes about this contact..."
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredContacts.length === 0 && (
            <div className="text-center py-8 sm:py-12 text-gray-500">
              <Users size={36} className="sm:w-12 sm:h-12 mx-auto mb-4 text-gray-300" />
              {searchTerm || filterLocation !== 'all' || filterStatus !== 'all' ? (
                <div>
                  <p className="text-base sm:text-lg font-medium">No contacts found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div>
                  <p className="text-base sm:text-lg font-medium">No contacts yet</p>
                  <p className="text-sm">Add your first contact to get started</p>
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
                    setNewContact({ name: '', phone: '', location: 'UK', notes: '' });
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
                    setNewContact({ name: '', phone: '', location: 'UK', notes: '' });
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