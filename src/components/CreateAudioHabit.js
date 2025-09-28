// src/components/CreateAudioHabit.js
import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { X, Headphones, Link, Target, Clock, Info } from 'lucide-react';
import '../sstyles/CreateAudioHabit.css';

const CreateAudioHabit = ({ userId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    audioUrl: '',
    requiredListeningPercentage: 80,
    category: 'meditation',
    reminderEnabled: false,
    reminderTime: '09:00'
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const categories = [
    { value: 'meditation', label: 'Meditation', icon: '🧘' },
    { value: 'affirmation', label: 'Affirmations', icon: '💪' },
    { value: 'podcast', label: 'Podcast', icon: '🎙️' },
    { value: 'music', label: 'Music', icon: '🎵' },
    { value: 'audiobook', label: 'Audiobook', icon: '📚' },
    { value: 'language', label: 'Language Learning', icon: '🗣️' },
    { value: 'other', label: 'Other', icon: '🎧' }
  ];

  const validateSoundCloudUrl = (url) => {
    // Basic SoundCloud URL validation
    const soundcloudPattern = /^https?:\/\/(www\.)?(soundcloud\.com|snd\.sc)\/.+/;
    return soundcloudPattern.test(url);
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setFormData({ ...formData, audioUrl: url });
    
    if (url && !validateSoundCloudUrl(url)) {
      setUrlError('Please enter a valid SoundCloud URL');
    } else {
      setUrlError('');
    }
  };

  const extractTrackInfo = async (url) => {
    // You can implement SoundCloud oEmbed API call here to get track info
    // For now, we'll use the URL as is
    setIsValidating(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // In production, you'd make an actual API call to SoundCloud's oEmbed endpoint
      // const response = await fetch(`https://soundcloud.com/oembed?format=json&url=${url}`);
      // const data = await response.json();
      
      setIsValidating(false);
      return true;
    } catch (error) {
      console.error('Error validating URL:', error);
      setIsValidating(false);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.audioUrl) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (!validateSoundCloudUrl(formData.audioUrl)) {
      setUrlError('Please enter a valid SoundCloud URL');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const habitData = {
        userId,
        type: 'audio',
        title: formData.title,
        description: formData.description,
        category: formData.category,
        audioUrl: formData.audioUrl,
        requiredListeningPercentage: parseInt(formData.requiredListeningPercentage),
        
        // Audio-specific fields
        isAudioHabit: true,
        audioSource: 'soundcloud',
        
        // Statistics
        completions: [],
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        
        // Settings
        reminderEnabled: formData.reminderEnabled,
        reminderTime: formData.reminderTime,
        
        // Metadata
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        
        // Additional stats for audio
        stats: {
          totalListeningTime: 0,
          audioSessions: 0,
          averageSessionDuration: 0
        }
      };
      
      const docRef = await addDoc(collection(db, 'habits'), habitData);
      
      console.log('Audio habit created with ID:', docRef.id);
      
      if (onSuccess) {
        onSuccess({
          id: docRef.id,
          ...habitData
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Error creating audio habit:', error);
      alert('Failed to create habit. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Headphones className="modal-icon" />
            Create Audio Habit
          </h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="audio-habit-form">
          <div className="form-group">
            <label htmlFor="title">
              Habit Title <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Morning Meditation"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What's this habit about?"
              rows="3"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <div className="category-grid">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  className={`category-button ${formData.category === cat.value ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, category: cat.value })}
                >
                  <span className="category-icon">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="audioUrl">
              <Link size={16} className="inline-icon" />
              SoundCloud URL <span className="required">*</span>
            </label>
            <input
              type="url"
              id="audioUrl"
              value={formData.audioUrl}
              onChange={handleUrlChange}
              placeholder="https://soundcloud.com/..."
              required
              className={urlError ? 'error' : ''}
            />
            {urlError && <span className="error-message">{urlError}</span>}
            {isValidating && <span className="validating-message">Validating URL...</span>}
            <div className="help-text">
              <Info size={14} />
              Paste any public SoundCloud track URL
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="percentage">
              <Target size={16} className="inline-icon" />
              Completion Goal: {formData.requiredListeningPercentage}%
            </label>
            <input
              type="range"
              id="percentage"
              min="50"
              max="100"
              step="5"
              value={formData.requiredListeningPercentage}
              onChange={(e) => setFormData({ ...formData, requiredListeningPercentage: e.target.value })}
            />
            <div className="range-labels">
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
          
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.reminderEnabled}
                onChange={(e) => setFormData({ ...formData, reminderEnabled: e.target.checked })}
              />
              <span>Enable daily reminder</span>
            </label>
            
            {formData.reminderEnabled && (
              <div className="reminder-time">
                <Clock size={16} />
                <input
                  type="time"
                  value={formData.reminderTime}
                  onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
                />
              </div>
            )}
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={isLoading || !!urlError} className="submit-button">
              {isLoading ? 'Creating...' : 'Create Audio Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAudioHabit;