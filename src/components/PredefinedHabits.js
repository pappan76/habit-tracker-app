import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';

const PredefinedHabits = ({ onHabitAdded }) => {
  const [user] = useAuthState(auth);
  const [selectedHabits, setSelectedHabits] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const predefinedHabits = [
    {
      id: 'book',
      name: 'Book',
      description: 'Read books daily to expand knowledge and improve focus',
      category: 'Learning',
      icon: '📚',
      color: '#4F46E5',
      type: 'boolean'
    },
    {
      id: 'podcast',
      name: 'Podcast',
      description: 'Listen to educational or motivational podcasts',
      category: 'Learning',
      icon: '🎧',
      color: '#7C3AED',
      type: 'boolean'
    },
    {
      id: 'association',
      name: 'Association',
      description: 'Engage with professional associations and networks',
      category: 'Professional',
      icon: '🤝',
      color: '#059669',
      type: 'boolean'
    },
    {
      id: 'product-use',
      name: '100% Product Use',
      description: 'Fully utilize products and services to maximize value',
      category: 'Professional',
      icon: '💯',
      color: '#DC2626',
      type: 'boolean'
    },
    {
      id: 'org-chart',
      name: 'Org Chart',
      description: 'Work on organizational structure and team development',
      category: 'Business',
      icon: '📊',
      color: '#EA580C',
      type: 'boolean'
    },
    {
      id: 'appointments',
      name: 'Process Appointments',
      description: 'Efficiently manage and process scheduled appointments',
      category: 'Business',
      icon: '📅',
      color: '#0891B2',
      type: 'number',
      unit: 'appointments',
      defaultTarget: 3
    },
    {
      id: 'contacts',
      name: 'New Contacts',
      description: 'Build network by connecting with new contacts daily',
      category: 'Networking',
      icon: '👥',
      color: '#7C2D12',
      type: 'number',
      unit: 'contacts',
      defaultTarget: 2
    },
    {
      id: 'retail',
      name: 'Retail',
      description: 'Focus on retail activities and customer engagement',
      category: 'Business',
      icon: '🏪',
      color: '#BE185D',
      type: 'number',
      unit: 'activities',
      defaultTarget: 5
    }
  ];

  const toggleHabitSelection = (habitId) => {
    setSelectedHabits(prev => 
      prev.includes(habitId) 
        ? prev.filter(id => id !== habitId)
        : [...prev, habitId]
    );
  };

  const addSelectedHabits = async () => {
    if (!user || selectedHabits.length === 0) return;

    setIsLoading(true);
    
    try {
      const habitsToAdd = predefinedHabits.filter(habit => 
        selectedHabits.includes(habit.id)
      );

      const promises = habitsToAdd.map(habit => 
        addDoc(collection(db, 'habits'), {
          userId: user.uid,
          name: habit.name,
          description: habit.description,
          category: habit.category,
          icon: habit.icon,
          color: habit.color,
          frequency: 'daily',
          target: habit.defaultTarget || 1,
          type: habit.type || 'boolean',
          unit: habit.unit || '',
          streak: 0,
          completedDates: [],
          completedValues: {},
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      );

      await Promise.all(promises);
      
      alert(`Successfully added ${selectedHabits.length} habits!`);
      setSelectedHabits([]);
      onHabitAdded && onHabitAdded();
    } catch (error) {
      console.error('Error adding habits:', error);
      alert('Error adding habits. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center p-6">
        <p className="text-gray-600">Please sign in to add habits.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Add Predefined Habits
            </h2>
            <p className="text-gray-600">
              Select from our curated list of professional and personal development habits
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {predefinedHabits.map((habit) => (
          <div
            key={habit.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
              selectedHabits.includes(habit.id)
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
            onClick={() => toggleHabitSelection(habit.id)}
          >
            <div className="flex items-start mb-3">
              <input
                type="checkbox"
                checked={selectedHabits.includes(habit.id)}
                onChange={() => toggleHabitSelection(habit.id)}
                className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-2xl mr-3">{habit.icon}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 mb-1">{habit.name}</h3>
                <span 
                  className="text-xs px-2 py-1 rounded-full text-white inline-block mb-2"
                  style={{ backgroundColor: habit.color }}
                >
                  {habit.category}
                </span>
                <p className="text-sm text-gray-600 mb-2">{habit.description}</p>
                
                {habit.type === 'number' && (
                  <div className="text-xs text-gray-500">
                    Daily target: {habit.defaultTarget} {habit.unit}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedHabits.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-800 mb-2">
            Selected Habits ({selectedHabits.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedHabits.map(habitId => {
              const habit = predefinedHabits.find(h => h.id === habitId);
              return (
                <span 
                  key={habitId}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                >
                  {habit.icon} {habit.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={addSelectedHabits}
          disabled={selectedHabits.length === 0 || isLoading}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            selectedHabits.length === 0 || isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Adding Habits...' : `Add ${selectedHabits.length} Selected Habits`}
        </button>
        
        {selectedHabits.length > 0 && (
          <button
            onClick={() => setSelectedHabits([])}
            className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear Selection
          </button>
        )}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">💡 Pro Tips:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Start with 2-3 habits to avoid overwhelming yourself</li>
          <li>• You can customize frequency and targets after adding</li>
          <li>• These habits are designed for professional and personal growth</li>
          <li>• Track your progress daily for best results</li>
        </ul>
      </div>
    </div>
  );
};

export default PredefinedHabits;