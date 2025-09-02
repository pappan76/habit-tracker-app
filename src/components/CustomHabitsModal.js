import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';

const CustomHabitsModal = ({ isOpen, onClose, onHabitAdded }) => {
  const [user] = useAuthState(auth);
  const [habitName, setHabitName] = useState('');
  const [habitDescription, setHabitDescription] = useState('');
  const [habitType, setHabitType] = useState('boolean');
  const [habitIcon, setHabitIcon] = useState('⭐');
  const [habitTarget, setHabitTarget] = useState(1);
  const [habitUnit, setHabitUnit] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const availableIcons = [
    '⭐', '🌟', '✨', '💫', '🎯', '🎨', '🎵', '🎮', '📖', '✏️',
    '💪', '🧘', '🏃', '🚶', '🧠', '💡', '🔥', '⚡', '🌱', '🌿',
    '💎', '🏆', '🎪', '🎭', '🎨', '🎬', '📱', '💻', '📊', '📈'
  ];

  const resetForm = () => {
    setHabitName('');
    setHabitDescription('');
    setHabitType('boolean');
    setHabitIcon('⭐');
    setHabitTarget(1);
    setHabitUnit('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !habitName.trim()) return;

    setIsLoading(true);
    
    try {
      const newHabit = {
        userId: user.uid,
        name: habitName.trim(),
        description: habitDescription.trim(),
        category: 'Custom',
        icon: habitIcon,
        color: '#6B7280', // Gray color for custom habits
        frequency: 'daily',
        target: habitType === 'number' ? habitTarget : 1,
        type: habitType,
        unit: habitType === 'number' ? habitUnit.trim() : '',
        streak: 0,
        completedDates: [],
        completedValues: {},
        isCustom: true, // Flag to identify custom habits
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'habits'), newHabit);
      
      resetForm();
      onHabitAdded && onHabitAdded();
      onClose();
      
      alert('Custom habit added successfully!');
    } catch (error) {
      console.error('Error adding custom habit:', error);
      alert('Error adding habit. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-90vh overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Add Custom Habit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center mb-2">
            <span className="text-yellow-600 mr-2">ℹ️</span>
            <span className="text-sm font-medium text-yellow-800">Custom Habit Note</span>
          </div>
          <p className="text-xs text-yellow-700">
            Custom habits won't be included in your daily/weekly score calculations. 
            They'll appear with a gray theme to distinguish them from scoring habits.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Habit Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Habit Name *
            </label>
            <input
              type="text"
              value={habitName}
              onChange={(e) => setHabitName(e.target.value)}
              placeholder="e.g., Drink Water, Meditate, Call Family"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              maxLength={50}
            />
          </div>

          {/* Habit Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={habitDescription}
              onChange={(e) => setHabitDescription(e.target.value)}
              placeholder="Brief description of your habit..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20"
              maxLength={150}
            />
          </div>

          {/* Icon Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choose Icon
            </label>
            <div className="grid grid-cols-10 gap-2 p-3 border border-gray-300 rounded-lg max-h-32 overflow-y-auto">
              {availableIcons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setHabitIcon(icon)}
                  className={`text-lg p-2 rounded hover:bg-gray-100 ${
                    habitIcon === icon ? 'bg-blue-100 border-2 border-blue-500' : ''
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Habit Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Habit Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="boolean"
                  checked={habitType === 'boolean'}
                  onChange={(e) => setHabitType(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">Simple (Done/Not Done)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="number"
                  checked={habitType === 'number'}
                  onChange={(e) => setHabitType(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">Count/Quantity Based</span>
              </label>
            </div>
          </div>

          {/* Number Habit Settings */}
          {habitType === 'number' && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Target
                  </label>
                  <input
                    type="number"
                    value={habitTarget}
                    onChange={(e) => setHabitTarget(parseInt(e.target.value) || 1)}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={habitUnit}
                    onChange={(e) => setHabitUnit(e.target.value)}
                    placeholder="e.g., glasses, minutes"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={20}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="mb-6 p-3 border border-gray-300 rounded-lg bg-gray-50">
            <div className="text-sm font-medium text-gray-700 mb-2">Preview:</div>
            <div className="flex items-center">
              <span className="text-xl mr-3">{habitIcon}</span>
              <div>
                <div className="font-medium text-gray-800">{habitName || 'Habit Name'}</div>
                <span className="text-xs px-2 py-1 rounded-full text-white bg-gray-500">
                  Custom
                </span>
                {habitType === 'number' && (
                  <div className="text-xs text-gray-500 mt-1">
                    Target: {habitTarget} {habitUnit}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!habitName.trim() || isLoading}
              className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                !habitName.trim() || isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Adding...' : 'Add Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomHabitsModal;