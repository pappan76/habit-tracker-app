import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  BarChart3, 
  Users, 
  Calendar,
  AlertCircle,
  Megaphone,
  Gift,
  HelpCircle,
  Target,
  X,
  Save
} from 'lucide-react';
import {
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus,
  getAnnouncementResponses,
  getAnnouncementStats
} from '../services/announcementService';

const AnnouncementAdmin = ({ user }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showResponsesModal, setShowResponsesModal] = useState(false);
  const [responses, setResponses] = useState([]);
  const [stats, setStats] = useState(null);

  // Form state for creating/editing announcements
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'info', // info, promo, event, poll, questionnaire
    priority: 'medium', // low, medium, high, urgent
    expiresAt: '',
    targetAudience: 'all', // all, specific_roles
    actionRequired: false,
    actionText: '',
    actionUrl: '',
    pollOptions: [],
    questions: []
  });

  const announcementTypes = [
    { value: 'info', label: 'Information', icon: <AlertCircle className="w-4 h-4" />, color: 'blue' },
    { value: 'promo', label: 'Promotion', icon: <Gift className="w-4 h-4" />, color: 'green' },
    { value: 'event', label: 'Event', icon: <Calendar className="w-4 h-4" />, color: 'purple' },
    { value: 'poll', label: 'Poll', icon: <BarChart3 className="w-4 h-4" />, color: 'orange' },
    { value: 'questionnaire', label: 'Questionnaire', icon: <HelpCircle className="w-4 h-4" />, color: 'indigo' },
    { value: 'goal', label: 'Goal/Challenge', icon: <Target className="w-4 h-4" />, color: 'red' }
  ];

  const priorityLevels = [
    { value: 'low', label: 'Low', color: 'gray' },
    { value: 'medium', label: 'Medium', color: 'blue' },
    { value: 'high', label: 'High', color: 'orange' },
    { value: 'urgent', label: 'Urgent', color: 'red' }
  ];

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await getAllAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      console.error('Error loading announcements:', error);
      alert('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const announcementData = {
        ...formData,
        createdBy: user.uid,
        createdByName: user.displayName || user.name,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : null
      };

      await createAnnouncement(announcementData);
      setShowCreateModal(false);
      resetForm();
      loadAnnouncements();
      alert('Announcement created successfully!');
    } catch (error) {
      console.error('Error creating announcement:', error);
      alert('Failed to create announcement');
    }
  };

  const handleUpdateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await updateAnnouncement(editingAnnouncement.id, formData);
      setEditingAnnouncement(null);
      resetForm();
      loadAnnouncements();
      alert('Announcement updated successfully!');
    } catch (error) {
      console.error('Error updating announcement:', error);
      alert('Failed to update announcement');
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteAnnouncement(announcementId);
        loadAnnouncements();
        alert('Announcement deleted successfully!');
      } catch (error) {
        console.error('Error deleting announcement:', error);
        alert('Failed to delete announcement');
      }
    }
  };

  const handleToggleStatus = async (announcementId, currentStatus) => {
    try {
      await toggleAnnouncementStatus(announcementId, !currentStatus);
      loadAnnouncements();
    } catch (error) {
      console.error('Error toggling announcement status:', error);
      alert('Failed to update announcement status');
    }
  };

  const handleViewResponses = async (announcement) => {
    try {
      setSelectedAnnouncement(announcement);
      const [responsesData, statsData] = await Promise.all([
        getAnnouncementResponses(announcement.id),
        getAnnouncementStats(announcement.id)
      ]);
      setResponses(responsesData);
      setStats(statsData);
      setShowResponsesModal(true);
    } catch (error) {
      console.error('Error loading responses:', error);
      alert('Failed to load responses');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      type: 'info',
      priority: 'medium',
      expiresAt: '',
      targetAudience: 'all',
      actionRequired: false,
      actionText: '',
      actionUrl: '',
      pollOptions: [],
      questions: []
    });
  };

  const startEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      expiresAt: announcement.expiresAt ? new Date(announcement.expiresAt.seconds * 1000).toISOString().split('T')[0] : '',
      targetAudience: announcement.targetAudience || 'all',
      actionRequired: announcement.actionRequired || false,
      actionText: announcement.actionText || '',
      actionUrl: announcement.actionUrl || '',
      pollOptions: announcement.pollOptions || [],
      questions: announcement.questions || []
    });
  };

  const addPollOption = () => {
    setFormData(prev => ({
      ...prev,
      pollOptions: [...prev.pollOptions, { text: '', votes: 0 }]
    }));
  };

  const updatePollOption = (index, text) => {
    setFormData(prev => ({
      ...prev,
      pollOptions: prev.pollOptions.map((option, i) => 
        i === index ? { ...option, text } : option
      )
    }));
  };

  const removePollOption = (index) => {
    setFormData(prev => ({
      ...prev,
      pollOptions: prev.pollOptions.filter((_, i) => i !== index)
    }));
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, { question: '', type: 'text', required: false }]
    }));
  };

  const updateQuestion = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }));
  };

  const removeQuestion = (index) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const getTypeIcon = (type) => {
    const typeConfig = announcementTypes.find(t => t.value === type);
    return typeConfig ? typeConfig.icon : <Megaphone className="w-4 h-4" />;
  };

  const getTypeColor = (type) => {
    const typeConfig = announcementTypes.find(t => t.value === type);
    return typeConfig ? typeConfig.color : 'gray';
  };

  const getPriorityColor = (priority) => {
    const priorityConfig = priorityLevels.find(p => p.value === priority);
    return priorityConfig ? priorityConfig.color : 'gray';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcement Management</h1>
          <p className="text-gray-600">Create and manage announcements for users</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Announcement
        </button>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.map((announcement) => (
          <div key={announcement.id} className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`text-${getTypeColor(announcement.type)}-600`}>
                    {getTypeIcon(announcement.type)}
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900">{announcement.title}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${getPriorityColor(announcement.priority)}-100 text-${getPriorityColor(announcement.priority)}-800`}>
                    {announcement.priority}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    announcement.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {announcement.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-gray-600 mb-3">{announcement.content}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {announcement.viewCount || 0} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {announcement.responseCount || 0} responses
                  </span>
                 <span>
                    Created: {announcement.createdAt?.seconds 
                        ? new Date(announcement.createdAt.seconds * 1000).toLocaleDateString()
                        : 'Unknown'
                    }
                </span>
                  {announcement.expiresAt?.seconds && (
                    <span>
                        Expires: {new Date(announcement.expiresAt.seconds * 1000).toLocaleDateString()}
                    </span>
                    )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleViewResponses(announcement)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View Responses"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => startEdit(announcement)}
                  className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleStatus(announcement.id, announcement.isActive)}
                  className={`p-2 rounded-lg transition-colors ${
                    announcement.isActive 
                      ? 'text-gray-600 hover:bg-gray-50' 
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                  title={announcement.isActive ? 'Deactivate' : 'Activate'}
                >
                  {announcement.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleDeleteAnnouncement(announcement.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingAnnouncement) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingAnnouncement(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={editingAnnouncement ? handleUpdateAnnouncement : handleCreateAnnouncement} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {announcementTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {priorityLevels.map(priority => (
                        <option key={priority.value} value={priority.value}>{priority.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                    <select
                      value={formData.targetAudience}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Users</option>
                      <option value="admins">Admins Only</option>
                      <option value="users">Regular Users</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expires At</label>
                    <input
                      type="date"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Action Button */}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="actionRequired"
                      checked={formData.actionRequired}
                      onChange={(e) => setFormData(prev => ({ ...prev, actionRequired: e.target.checked }))}
                      className="mr-2"
                    />
                    <label htmlFor="actionRequired" className="text-sm font-medium text-gray-700">
                      Include Action Button
                    </label>
                  </div>
                  
                  {formData.actionRequired && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Button Text</label>
                        <input
                          type="text"
                          value={formData.actionText}
                          onChange={(e) => setFormData(prev => ({ ...prev, actionText: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Learn More, Join Now"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Action URL</label>
                        <input
                          type="url"
                          value={formData.actionUrl}
                          onChange={(e) => setFormData(prev => ({ ...prev, actionUrl: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Poll Options */}
                {formData.type === 'poll' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">Poll Options</label>
                      <button
                        type="button"
                        onClick={addPollOption}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Add Option
                      </button>
                    </div>
                    {formData.pollOptions.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={option.text}
                          onChange={(e) => updatePollOption(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={`Option ${index + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => removePollOption(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Questionnaire Questions */}
                {formData.type === 'questionnaire' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">Questions</label>
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Add Question
                      </button>
                    </div>
                    {formData.questions.map((question, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={question.question}
                            onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Question ${index + 1}`}
                          />
                          <select
                            value={question.type}
                            onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="email">Email</option>
                            <option value="textarea">Long Text</option>
                          </select>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={question.required}
                              onChange={(e) => updateQuestion(index, 'required', e.target.checked)}
                              className="mr-1"
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            onClick={() => removeQuestion(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingAnnouncement(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {editingAnnouncement ? 'Update' : 'Create'} Announcement
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Responses Modal */}
      {showResponsesModal && selectedAnnouncement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Responses: {selectedAnnouncement.title}</h2>
                  {stats && (
                    <p className="text-gray-600">
                      {stats.viewCount} views • {stats.responseCount} responses
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowResponsesModal(false);
                    setSelectedAnnouncement(null);
                    setResponses([]);
                    setStats(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Response Statistics */}
              {selectedAnnouncement.type === 'poll' && selectedAnnouncement.pollOptions && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Poll Results</h3>
                  <div className="space-y-2">
                    {selectedAnnouncement.pollOptions.map((option, index) => {
                      const votes = option.votes || 0;
                      const percentage = stats?.responseCount > 0 ? (votes / stats.responseCount * 100).toFixed(1) : 0;
                      return (
                        <div key={index} className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">{option.text}</span>
                              <span className="text-sm text-gray-500">{votes} votes ({percentage}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Individual Responses */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Individual Responses</h3>
                <div className="space-y-4">
                  {responses.map((response) => (
                    <div key={response.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">User: {response.userId}</span>
                       <span className="text-sm text-gray-500">
                        {response.createdAt?.seconds 
                            ? new Date(response.createdAt.seconds * 1000).toLocaleString()
                            : 'Unknown'
                        }
                        </span>
                      </div>
                      <div className="text-gray-700">
                        {typeof response.response === 'object' ? (
                          <pre className="whitespace-pre-wrap">{JSON.stringify(response.response, null, 2)}</pre>
                        ) : (
                          <p>{response.response}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {responses.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No responses yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementAdmin;