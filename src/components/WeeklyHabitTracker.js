import React, { useState, useEffect, useCallback } from 'react';
import { 
  getCustomWeekDates, 
  getWeekRangeString, 
  getPreviousWeek, 
  getNextWeek, 
  isCurrentWeek, 
  isToday, 
  formatDateString,
  CUSTOM_WEEK_DAYS 
} from '../utils/weekUtils';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import CustomHabitsModal from './CustomHabitsModal';
import { ChevronLeft, ChevronRight, Plus, Trash2, Target, Star, LayoutGrid, Table } from 'lucide-react';

const getHabitColorByPerformance = (percentage) => {
  if (percentage >= 80) {
    return 'from-green-400 to-emerald-500';
  } else if (percentage >= 50) {
    return 'from-amber-400 to-orange-500';
  } else {
    return 'from-red-400 to-rose-500';
  }
};

const getContrastingTextColor = (percentage) => {
  if (percentage >= 80) {
    return 'text-gray-900';
  } else if (percentage >= 50) {
    return 'text-gray-900';
  } else {
    return 'text-white';
  }
};

const getLeadershipGoalProgress = (habit, habitValues) => {
  if (habit.name !== 'Process Appointments') return null;
  
  const goalStart = habit.goalConfig?.startDate 
    ? new Date(habit.goalConfig.startDate)
    : new Date('2024-09-01');
  const goalEnd = habit.goalConfig?.endDate 
    ? new Date(habit.goalConfig.endDate)
    : new Date('2024-12-01');
  const goalTarget = habit.goalConfig?.target || 75;
  
  let totalAppointments = 0;
  const currentDate = new Date();
  const endDate = currentDate < goalEnd ? currentDate : goalEnd;
  
  for (let date = new Date(goalStart); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateString = formatDateString(date);
    const key = `${habit.id}-${dateString}`;
    totalAppointments += habitValues[key] || 0;
  }
  
  const remaining = Math.max(0, goalTarget - totalAppointments);
  const daysRemaining = Math.max(0, Math.ceil((goalEnd - currentDate) / (1000 * 60 * 60 * 24)));
  const progress = (totalAppointments / goalTarget) * 100;
  
  return {
    total: totalAppointments,
    target: goalTarget,
    remaining,
    daysRemaining,
    progress: Math.min(100, progress),
    isActive: currentDate >= goalStart && currentDate <= goalEnd
  };
};

const WeeklyHabitTracker = ({ habits = [], onRefreshHabits }) => {
  const [user] = useAuthState(auth);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [completedHabits, setCompletedHabits] = useState({});
  const [habitValues, setHabitValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [isCustomHabitsModalOpen, setIsCustomHabitsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('capsules'); // 'capsules' or 'table'

  const weekDates = getCustomWeekDates(currentWeek);
  const weekRange = getWeekRangeString(currentWeek);

  const validHabits = habits.filter(habit => habit && habit.id && habit.name);
  const scoringHabits = validHabits.filter(habit => !habit.isCustom);
  const customHabits = validHabits.filter(habit => habit.isCustom);

  const loadWeeklyProgress = useCallback(async () => {
    if (!user || habits.length === 0) return;
    
    setLoading(true);
    try {
      const habitProgress = {};
      const habitNumberValues = {};
      
      for (const habit of habits) {
        const habitDoc = await getDocs(query(collection(db, 'habits'), where('__name__', '==', habit.id)));
        
        if (!habitDoc.empty) {
          const habitData = habitDoc.docs[0].data();
          const completedDates = habitData.completedDates || [];
          const completedValues = habitData.completedValues || {};
          
          weekDates.forEach(date => {
            const dateString = formatDateString(date);
            const key = `${habit.id}-${dateString}`;
            
            if (habit.type === 'number') {
              const value = completedValues[dateString] || 0;
              habitNumberValues[key] = value;
              habitProgress[key] = value >= (habit.target || 1);
            } else {
              habitProgress[key] = completedDates.includes(dateString);
            }
          });
          
          if (habit.name === 'Process Appointments') {
            const goalStart = new Date('2024-09-01');
            const goalEnd = new Date('2024-12-01');
            const currentDate = new Date();
            const endDate = currentDate < goalEnd ? currentDate : goalEnd;
            
            for (let date = new Date(goalStart); date <= endDate; date.setDate(date.getDate() + 1)) {
              const dateString = formatDateString(date);
              const key = `${habit.id}-${dateString}`;
              
              if (!(key in habitNumberValues)) {
                const value = completedValues[dateString] || 0;
                habitNumberValues[key] = value;
              }
            }
          }
        }
      }
      
      setCompletedHabits(habitProgress);
      setHabitValues(habitNumberValues);
    } catch (error) {
      console.error('Error loading weekly progress:', error);
    } finally {
      setLoading(false);
    }
  }, [user, habits, currentWeek]);

  useEffect(() => {
    if (!user || habits.length === 0) return;
    loadWeeklyProgress();
  }, [user, habits, currentWeek, loadWeeklyProgress]);

  const updateHabitValue = async (habit, date, value) => {
    if (!user) return;
    
    const dateString = formatDateString(date);
    const key = `${habit.id}-${dateString}`;
    const numValue = parseInt(value) || 0;
    
    setHabitValues(prev => ({ ...prev, [key]: numValue }));
    setCompletedHabits(prev => ({ ...prev, [key]: numValue >= (habit.target || 1) }));

    try {
      const habitDoc = await getDocs(query(collection(db, 'habits'), where('__name__', '==', habit.id)));
      
      if (!habitDoc.empty) {
        const habitData = habitDoc.docs[0].data();
        let completedDates = habitData.completedDates || [];
        let completedValues = habitData.completedValues || {};
        
        completedValues[dateString] = numValue;
        
        const isCompleted = numValue >= (habit.target || 1);
        if (isCompleted && !completedDates.includes(dateString)) {
          completedDates.push(dateString);
        } else if (!isCompleted && completedDates.includes(dateString)) {
          completedDates = completedDates.filter(d => d !== dateString);
        }
        
        const habitRef = doc(db, 'habits', habit.id);
        await updateDoc(habitRef, {
          completedDates: completedDates,
          completedValues: completedValues,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating habit:', error);
    }
  };

  const deleteCustomHabit = async (habit) => {
    if (!user || !habit || !habit.isCustom) return;

    if (!window.confirm(`Are you sure you want to delete the habit "${habit.name}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'habits', habit.id));
      onRefreshHabits && onRefreshHabits();
      alert(`Habit "${habit.name}" has been deleted.`);
    } catch (error) {
      console.error('Error deleting habit:', error);
      alert('Failed to delete habit. Please try again.');
    }
  };

  const toggleHabitCompletion = async (habit, date) => {
    if (!user || habit.type === 'number') return;
    
    const dateString = formatDateString(date);
    const key = `${habit.id}-${dateString}`;
    const isCurrentlyCompleted = completedHabits[key];
    
    setCompletedHabits(prev => ({ ...prev, [key]: !isCurrentlyCompleted }));

    try {
      const habitDoc = await getDocs(query(collection(db, 'habits'), where('__name__', '==', habit.id)));
      
      if (!habitDoc.empty) {
        const habitData = habitDoc.docs[0].data();
        let completedDates = habitData.completedDates || [];
        
        if (isCurrentlyCompleted) {
          completedDates = completedDates.filter(d => d !== dateString);
        } else {
          if (!completedDates.includes(dateString)) {
            completedDates.push(dateString);
          }
        }
        
        const habitRef = doc(db, 'habits', habit.id);
        await updateDoc(habitRef, {
          completedDates: completedDates,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating habit:', error);
      setCompletedHabits(prev => ({ ...prev, [key]: isCurrentlyCompleted }));
    }
  };

  const getDailyScore = (date) => {
    const dateString = formatDateString(date);
    let score = 0;
    
    scoringHabits.forEach(habit => {
      const key = `${habit.id}-${dateString}`;
      
      if (habit.type === 'number') {
        const value = habitValues[key] || 0;
        score += value;
      } else {
        if (completedHabits[key]) {
          score += 1;
        }
      }
    });
    
    return score;
  };

  const getWeeklyScore = () => {
    let totalScore = 0;
    weekDates.forEach(date => {
      totalScore += getDailyScore(date);
    });
    return totalScore;
  };

  const getHabitWeekProgress = (habit) => {
    return weekDates.filter(date => {
      const key = `${habit.id}-${formatDateString(date)}`;
      if (habit.type === 'number') {
        return (habitValues[key] || 0) > 0;
      }
      return completedHabits[key];
    }).length;
  };
// Add function to get daily score for a specific habit (after getHabitCompletionPercentage function)
const getHabitDailyScore = (habit, date) => {
  const dateString = formatDateString(date);
  const key = `${habit.id}-${dateString}`;
  
  if (habit.type === 'number') {
    return habitValues[key] || 0;
  } else {
    return completedHabits[key] ? 1 : 0;
  }
};
  const getHabitCompletionPercentage = (habit) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysElapsed = weekDates.filter(date => {
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate <= today;
    }).length;
    
    if (daysElapsed === 0) return 0;
    
    const completedDays = weekDates.filter(date => {
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      if (checkDate > today) return false;
      
      const key = `${habit.id}-${formatDateString(date)}`;
      if (habit.type === 'number') {
        return (habitValues[key] || 0) > 0;
      }
      return completedHabits[key];
    }).length;
    
    return Math.round((completedDays / daysElapsed) * 100);
  };

  const HabitCard = ({ habit, isCustom }) => {
    const progress = getHabitWeekProgress(habit);
    const completionPercentage = getHabitCompletionPercentage(habit);
    const cardColor = getHabitColorByPerformance(completionPercentage);
    const textColor = getContrastingTextColor(completionPercentage);
    const goalProgress = getLeadershipGoalProgress(habit, habitValues);

    return (
      <div className={`flex-shrink-0 w-80 rounded-3xl p-6 shadow-xl bg-gradient-to-br ${cardColor}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-3 shadow-lg">
              <span className="text-4xl">{habit.icon}</span>
            </div>
            <div>
              <h3 className={`font-bold text-lg drop-shadow-md ${textColor}`}>
                {habit.name}
              </h3>
              {habit.type === 'number' && (
                <p className={`text-xs font-medium ${textColor === 'text-white' ? 'text-white/80' : 'text-gray-700'}`}>
                  Target: {habit.target} {habit.unit}
                </p>
              )}
            </div>
          </div>
          {isCustom && (
            <button 
              onClick={() => deleteCustomHabit(habit)}
              className={`${textColor === 'text-white' ? 'text-white/70 hover:text-white' : 'text-gray-700 hover:text-gray-900'} transition p-2 bg-white/20 rounded-xl`}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        <div className="mb-5 bg-white/20 backdrop-blur-sm rounded-2xl p-3">
          <div className="flex justify-between text-sm mb-2">
            <span className={`${textColor} font-semibold`}>
              {progress}/7 days
            </span>
            <span className={`${textColor} font-bold`}>
              {completionPercentage}%
            </span>
          </div>
          <div className="w-full bg-white/30 rounded-full h-3 overflow-hidden">
            <div 
              className="h-3 bg-white rounded-full shadow-inner transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className={`text-xs mt-1 text-center font-medium ${textColor === 'text-white' ? 'text-white/90' : 'text-gray-700'}`}>
            Based on days elapsed this week
          </div>
        </div>

        {goalProgress && goalProgress.isActive && (
          <div className="mb-4 bg-white/20 backdrop-blur-sm rounded-2xl p-3">
            <div className={`text-xs font-bold mb-2 ${textColor}`}>🎯 Leadership Goal</div>
            <div className={`flex justify-between text-sm mb-1 ${textColor}`}>
              <span>{goalProgress.total}/{goalProgress.target}</span>
              <span className="font-bold">{Math.round(goalProgress.progress)}%</span>
            </div>
            <div className="w-full bg-white/30 rounded-full h-2">
              <div 
                className="h-2 bg-yellow-300 rounded-full transition-all"
                style={{ width: `${goalProgress.progress}%` }}
              />
            </div>
            <div className={`text-xs mt-1 font-medium ${textColor === 'text-white' ? 'text-white/90' : 'text-gray-700'}`}>
              {goalProgress.remaining} needed • {goalProgress.daysRemaining} days left
            </div>
          </div>
        )}

        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, index) => {
            const key = `${habit.id}-${formatDateString(date)}`;
            const isCompleted = habit.type === 'number' 
              ? (habitValues[key] || 0) >= (habit.target || 1)
              : completedHabits[key];
            const isTodayDate = isToday(date);
            const value = habitValues[key] || 0;
            const dailyScore = getHabitDailyScore(habit, date);

            return (
              <div key={index} className="flex flex-col items-center gap-1.5">
                <div className={`text-xs font-bold ${
                  isTodayDate ? 'text-blue-600' : textColor === 'text-white' ? 'text-white/80' : 'text-gray-700'
                }`}>
                  {CUSTOM_WEEK_DAYS[index].short}
                </div>
                <div className={`text-lg font-bold ${
                  isTodayDate ? 'text-blue-600 scale-110' : textColor
                }`}>
                  {date.getDate()}
                </div>
                
                {habit.type === 'number' ? (
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={value}
                      onChange={(e) => updateHabitValue(habit, date, e.target.value)}
                      className="w-11 h-11 text-center text-base font-bold border-2 rounded-xl focus:outline-none focus:ring-2 transition shadow-md border-slate-400 bg-white text-slate-700 focus:ring-slate-400"
                    />
                    {isCompleted && (
                      <span className={`text-xs font-bold drop-shadow-lg ${textColor}`}>✓</span>
                    )}
                    {/* Add daily score under the input */}
                    {!habit.isCustom && dailyScore > 0 && (
                      <div className={`text-xs font-bold ${textColor === 'text-white' ? 'text-white/90' : 'text-gray-700'}`}>
                        {dailyScore} pts
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => toggleHabitCompletion(habit, date)}
                      className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all active:scale-90 shadow-md ${
                        isCompleted
                          ? 'bg-slate-600 border-slate-600 text-white'
                          : isTodayDate
                          ? 'border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-500'
                          : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-400'
                      }`}
                    >
                      {isCompleted && '✓'}
                    </button>
                    {/* Add daily score under the button */}
                    {!habit.isCustom && dailyScore > 0 && (
                      <div className={`text-xs font-bold ${textColor === 'text-white' ? 'text-white/90' : 'text-gray-700'}`}>
                        {dailyScore} pts
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-pink-100 to-orange-100">
      <div className="sticky top-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 shadow-2xl z-40">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentWeek(getPreviousWeek(currentWeek))}
              className="p-2.5 bg-white/20 hover:bg-black/30 rounded-2xl transition active:scale-95 backdrop-blur-sm"
            >
              <ChevronLeft size={24} className="text-black" />
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-black drop-shadow-lg">{weekRange}</h1>
              <p className="text-xs text-white/80 font-medium">Saturday - Friday</p>
            </div>
            <button
              onClick={() => setCurrentWeek(getNextWeek(currentWeek))}
              className="p-2.5 bg-white/20 hover:bg-black/30 rounded-2xl transition active:scale-95 backdrop-blur-sm"
            >
              <ChevronRight size={24} className="text-black" />
            </button>
          </div>

        <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Weekly Score</p>
              <p className="text-6xl font-black text-gray-800">{getWeeklyScore()}</p>
              <p className="text-sm text-gray-500 mt-1">points earned</p>
            </div>
            <button 
              onClick={() => setIsCustomHabitsModalOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 flex items-center gap-2 shadow-md"
            >
              <Plus size={18} />
              Add
            </button>
          </div>
        </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading habits...</p>
        </div>
      ) : (
        <div className="p-5">
          {!isCurrentWeek(currentWeek) && (
            <div className="mb-4">
              <button
                onClick={() => setCurrentWeek(new Date())}
                className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 transition active:scale-95 shadow-lg"
              >
                Go to Current Week
              </button>
            </div>
          )}
          
          <div className="mb-6 flex gap-3">
            <button
              onClick={() => setIsCustomHabitsModalOpen(true)}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold hover:shadow-2xl transition active:scale-95 flex items-center justify-center gap-3 text-lg shadow-lg"
            >
              <Plus size={24} />
              Add Custom Habit
            </button>
            
            <button
              onClick={() => setViewMode(viewMode === 'capsules' ? 'table' : 'capsules')}
              className="bg-white text-gray-700 px-6 py-4 rounded-2xl font-bold hover:shadow-lg transition active:scale-95 flex items-center gap-2 border-2 border-gray-200"
            >
              {viewMode === 'capsules' ? <Table size={24} /> : <LayoutGrid size={24} />}
              <span className="hidden sm:inline">{viewMode === 'capsules' ? 'Table' : 'Cards'}</span>
            </button>
          </div>

          {viewMode === 'capsules' ? (
            <>
              {scoringHabits.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4 px-1">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2.5 rounded-xl shadow-lg">
                      <Target size={22} className="text-white" />
                    </div>
                    <h2 className="font-black text-gray-800 text-xl">Scoring Habits</h2>
                    <span className="text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1.5 rounded-full font-bold shadow-md">
                      Earns Points
                    </span>
                  </div>
                  <div className="flex gap-5 overflow-x-auto pb-5 snap-x snap-mandatory scrollbar-hide">
                    {scoringHabits.map(habit => (
                      <HabitCard key={habit.id} habit={habit} isCustom={false} />
                    ))}
                  </div>
                </div>
              )}

              {customHabits.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4 px-1">
                    <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-2.5 rounded-xl shadow-lg">
                      <Star size={22} className="text-white" />
                    </div>
                    <h2 className="font-black text-gray-800 text-xl">Custom Habits</h2>
                    <span className="text-xs bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1.5 rounded-full font-bold shadow-md">
                      Personal
                    </span>
                  </div>
                  <div className="flex gap-5 overflow-x-auto pb-5 snap-x snap-mandatory scrollbar-hide">
                    {customHabits.map(habit => (
                      <HabitCard key={habit.id} habit={habit} isCustom={true} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="p-4 text-left font-semibold text-gray-700 min-w-[200px]">Habit</th>
                      {weekDates.map((date, index) => (
                        <th key={index} className="p-4 text-center min-w-[80px]">
                          <div className="text-sm font-semibold text-gray-700">{CUSTOM_WEEK_DAYS[index].short}</div>
                          <div className={`text-xs mt-1 ${isToday(date) ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                            {date.getDate()}
                          </div>
                        </th>
                      ))}
                      <th className="p-4 text-center bg-blue-50 min-w-[100px]">
                        <div className="text-sm font-semibold text-blue-700">Weekly</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {validHabits.map((habit) => {
                      const progress = getHabitWeekProgress(habit);
                      const weeklyTotal = habit.type === 'number' 
                        ? weekDates.reduce((sum, date) => sum + (habitValues[`${habit.id}-${formatDateString(date)}`] || 0), 0)
                        : progress;

                      return (
                        <tr key={habit.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{habit.icon}</span>
                              <div>
                                <div className="font-medium text-gray-800">{habit.name}</div>
                                {habit.type === 'number' && (
                                  <div className="text-xs text-gray-500">Target: {habit.target} {habit.unit}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          {weekDates.map((date, index) => {
                            const key = `${habit.id}-${formatDateString(date)}`;
                            const isCompleted = completedHabits[key];
                            const value = habitValues[key] || 0;
                            const isTodayDate = isToday(date);

                            return (
                              <td key={index} className="p-4 text-center">
                                {habit.type === 'number' ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    value={value}
                                    onChange={(e) => updateHabitValue(habit, date, e.target.value)}
                                    className={`w-16 text-center text-sm font-bold border-2 rounded-lg focus:outline-none focus:ring-2 transition ${
                                      isTodayDate ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                                    } focus:ring-blue-400`}
                                  />
                                ) : (
                                  <button
                                    onClick={() => toggleHabitCompletion(habit, date)}
                                    className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                                      isCompleted
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : isTodayDate
                                        ? 'border-blue-400 hover:bg-blue-50'
                                        : 'border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    {isCompleted && '✓'}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-4 text-center bg-blue-50 font-semibold text-gray-800">
                            {weeklyTotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {validHabits.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎯</div>
              <p className="text-gray-600 font-semibold mb-6 text-lg">No habits yet</p>
              <button 
                onClick={() => setIsCustomHabitsModalOpen(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-2xl font-bold hover:shadow-2xl transition active:scale-95 text-lg"
              >
                Create Your First Habit
              </button>
            </div>
          )}

          {validHabits.length > 0 && (
            <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-3xl p-6 shadow-lg">
              <h3 className="font-black text-blue-800 mb-4 text-xl flex items-center gap-2">
                📊 Week Summary & Scoring
              </h3>
              
              {scoringHabits.length > 0 && (
                <>
                  <h4 className="font-bold text-blue-700 mb-3 text-lg flex items-center gap-2">
                    🎯 Scoring Habits:
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                    {scoringHabits.map(habit => {
                      const progress = getHabitWeekProgress(habit);
                      const completionPercentage = getHabitCompletionPercentage(habit);
                      const weeklyTotal = habit.type === 'number' ? 
                        weekDates.reduce((sum, date) => {
                          const key = `${habit.id}-${formatDateString(date)}`;
                          return sum + (habitValues[key] || 0);
                        }, 0) :
                        progress;
                      
                      return (
                        <div key={habit.id} className="bg-white rounded-2xl p-4 text-center shadow-md border-2 border-blue-100 hover:border-blue-300 transition">
                          <div className="text-3xl mb-2">{habit.icon}</div>
                          <div className="text-sm font-semibold text-gray-700 mb-1">{habit.name}</div>
                          <div className={`text-2xl font-black mb-1 ${
                            completionPercentage >= 80 ? 'text-green-600' : 
                            completionPercentage >= 50 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {weeklyTotal} {habit.type === 'number' ? 'pts' : 'days'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {completionPercentage}% on track
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {(() => {
                const appointmentsHabit = scoringHabits.find(h => h.name === 'Process Appointments');
                const goalProgress = appointmentsHabit ? getLeadershipGoalProgress(appointmentsHabit, habitValues) : null;
                
                if (goalProgress && goalProgress.isActive) {
                  return (
                    <div className="mb-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl p-5 shadow-xl">
                      <h4 className="font-black text-white mb-3 text-lg flex items-center gap-2">
                        🎯 Leadership Promotion Goal
                      </h4>
                      <div className="grid grid-cols-2 gap-6 mb-4">
                        <div className="text-center">
                          <div className="text-4xl font-black">{goalProgress.total}</div>
                          <div className="text-sm opacity-90 font-semibold">Completed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-4xl font-black text-yellow-300">{goalProgress.remaining}</div>
                          <div className="text-sm opacity-90 font-semibold">Remaining</div>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-2 font-semibold">
                          <span>Progress</span>
                          <span>{Math.round(goalProgress.progress)}%</span>
                        </div>
                        <div className="w-full bg-white/30 rounded-full h-3">
                          <div 
                            className="bg-yellow-300 h-3 rounded-full transition-all shadow-lg"
                            style={{ width: `${goalProgress.progress}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-sm opacity-90 text-center font-medium">
                        {goalProgress.daysRemaining} days remaining until December 1st
                      </div>
                      {goalProgress.remaining > 0 && goalProgress.daysRemaining > 0 && (
                        <div className="text-sm text-center mt-3 bg-white/20 rounded-xl px-4 py-2 font-semibold">
                          Need ~{Math.ceil(goalProgress.remaining / goalProgress.daysRemaining)} per day to reach goal
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {customHabits.length > 0 && (
                <>
                  <h4 className="font-bold text-gray-600 mb-3 text-lg flex items-center gap-2">
                    ⭐ Custom Habits:
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                    {customHabits.map(habit => {
                      const progress = getHabitWeekProgress(habit);
                      const completionPercentage = getHabitCompletionPercentage(habit);
                      const weeklyTotal = habit.type === 'number' ? 
                        weekDates.reduce((sum, date) => {
                          const key = `${habit.id}-${formatDateString(date)}`;
                          return sum + (habitValues[key] || 0);
                        }, 0) :
                        progress;
                      
                      return (
                        <div key={habit.id} className="bg-gray-100 rounded-2xl p-4 text-center shadow-md border-2 border-gray-200">
                          <div className="text-3xl mb-2 opacity-70">{habit.icon}</div>
                          <div className="text-sm font-semibold text-gray-600 mb-1">{habit.name}</div>
                          <div className="text-2xl font-black text-gray-600 mb-1">
                            {weeklyTotal} {habit.type === 'number' ? habit.unit : 'days'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {completionPercentage}% on track
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              
              <div className="bg-white rounded-2xl p-5 border-l-4 border-blue-500 shadow-md">
                <h4 className="font-black text-blue-800 mb-3 text-lg">🎯 How Scoring Works:</h4>
                <div className="text-sm text-blue-700 space-y-2 font-medium">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span><strong>Scoring Habits:</strong> Count toward your daily/weekly points</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span><strong>Custom Habits:</strong> Personal tracking only (no points)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    <span><strong>Checkmarks:</strong> 1 point per completion</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-500">•</span>
                    <span><strong>Numbers:</strong> Actual number entered (appointments, contacts, etc.)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <CustomHabitsModal
        isOpen={isCustomHabitsModalOpen}
        onClose={() => setIsCustomHabitsModalOpen(false)}
        onHabitAdded={() => {
          onRefreshHabits && onRefreshHabits();
          loadWeeklyProgress();
        }}
      />

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .snap-x {
          scroll-snap-type: x mandatory;
        }
        .snap-mandatory > * {
          scroll-snap-align: start;
        }
        
        @media (min-width: 1024px) {
          .scrollbar-hide::-webkit-scrollbar {
            display: block;
            height: 10px;
          }
          .scrollbar-hide::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 10px;
          }
          .scrollbar-hide::-webkit-scrollbar-thumb {
            background: rgba(139, 92, 246, 0.6);
            border-radius: 10px;
          }
          .scrollbar-hide::-webkit-scrollbar-thumb:hover {
            background: rgba(139, 92, 246, 0.8);
          }
          .scrollbar-hide {
            -ms-overflow-style: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(139, 92, 246, 0.6) rgba(255, 255, 255, 0.3);
          }
        }
      `}</style>
    </div>
  );
};

export default WeeklyHabitTracker;