import React, { useState, useEffect } from 'react';
import { Plus, Check, X, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { 
  getUserHabits, 
  createHabit, 
  deleteHabit, 
  logHabit, 
  getHabitLogs 
} from '../services/habitsService';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

const HabitList = () => {
  const { user, logout } = useAuth();
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [newHabitName, setNewHabitName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });

  useEffect(() => {
    if (user) {
      loadHabits();
      loadHabitLogs();
    }
  }, [user]);

  const loadHabits = async () => {
    try {
      const userHabits = await getUserHabits(user.uid);
      setHabits(userHabits);
    } catch (error) {
      console.error('Failed to load habits:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHabitLogs = async () => {
    try {
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(currentWeekEnd, 'yyyy-MM-dd');
      const logs = await getHabitLogs(user.uid, startDate, endDate);
      
      const logsMap = {};
      logs.forEach(log => {
        const key = `${log.habitId}_${log.date}`;
        logsMap[key] = log.completed;
      });
      setHabitLogs(logsMap);
    } catch (error) {
      console.error('Failed to load habit logs:', error);
    }
  };

  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    try {
      await createHabit(user.uid, {
        name: newHabitName.trim(),
        color: '#3B82F6'
      });
      setNewHabitName('');
      setShowAddForm(false);
      loadHabits();
    } catch (error) {
      console.error('Failed to create habit:', error);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    if (window.confirm('Are you sure you want to delete this habit?')) {
      try {
        await deleteHabit(habitId);
        loadHabits();
      } catch (error) {
        console.error('Failed to delete habit:', error);
      }
    }
  };

  const handleToggleHabit = async (habitId, date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const logKey = `${habitId}_${dateStr}`;
      const currentStatus = habitLogs[logKey] || false;
      
      await logHabit(user.uid, habitId, dateStr, !currentStatus);
      
      setHabitLogs(prev => ({
        ...prev,
        [logKey]: !currentStatus
      }));
    } catch (error) {
      console.error('Failed to toggle habit:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Habit Tracker</h1>
              <p className="text-gray-600">Welcome back, {user?.displayName}</p>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Week Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Week of {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d, yyyy')}
          </h2>
          
          {/* Days Header */}
          <div className="grid grid-cols-8 gap-2 mb-4">
            <div className="font-medium text-gray-700">Habit</div>
            {weekDays.map(day => (
              <div key={day.toISOString()} className="text-center">
                <div className="font-medium text-gray-700 text-sm">
                  {format(day, 'EEE')}
                </div>
                <div className="text-gray-500 text-xs">
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Habits */}
          {habits.map(habit => (
            <div key={habit.id} className="grid grid-cols-8 gap-2 py-3 border-t">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{habit.name}</span>
                <button
                  onClick={() => handleDeleteHabit(habit.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              {weekDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const logKey = `${habit.id}_${dateStr}`;
                const isCompleted = habitLogs[logKey] || false;
                
                return (
                  <div key={day.toISOString()} className="flex justify-center">
                    <button
                      onClick={() => handleToggleHabit(habit.id, day)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {isCompleted && <Check size={16} />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Add New Habit */}
          {showAddForm ? (
            <form onSubmit={handleAddHabit} className="mt-4 border-t pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder="Enter habit name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewHabitName('');
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={20} />
              <span>Add New Habit</span>
            </button>
          )}

          {habits.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No habits yet. Add your first habit to get started!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HabitList;
