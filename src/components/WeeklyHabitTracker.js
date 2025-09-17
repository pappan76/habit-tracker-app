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
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import CustomHabitsModal from './CustomHabitsModal';


const getLeadershipGoalProgress = (habit, habitValues) => {
  if (habit.name !== 'Process Appointments') return null;
  
  const goalStart = new Date('2024-09-01');
  const goalEnd = new Date('2024-12-01');
  const goalTarget = 75;
  
  // Calculate total appointments from Sept 1 to Dec 1
  let totalAppointments = 0;
  const currentDate = new Date();
  const endDate = currentDate < goalEnd ? currentDate : goalEnd;
  
  // Loop through all dates from Sept 1 to current date (or goal end)
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
  const [weekHistory, setWeekHistory] = useState([]);
  const [showWeekPicker, setShowWeekPicker] = useState(false);

  const weekDates = getCustomWeekDates(currentWeek);
  const weekRange = getWeekRangeString(currentWeek);

  // Separate scoring and custom habits
  const scoringHabits = habits.filter(habit => !habit.isCustom);
  const customHabits = habits.filter(habit => habit.isCustom);

  // Load weekly progress - memoized to prevent infinite re-renders
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
          
          // Load current week data
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
          
          // For Process Appointments habit, also load ALL data from Sept 1 to Dec 1
          if (habit.name === 'Process Appointments') {
            const goalStart = new Date('2024-09-01');
            const goalEnd = new Date('2024-12-01');
            const currentDate = new Date();
            const endDate = currentDate < goalEnd ? currentDate : goalEnd;
            
            // Load all dates from Sept 1 to current date for leadership goal calculation
            for (let date = new Date(goalStart); date <= endDate; date.setDate(date.getDate() + 1)) {
              const dateString = formatDateString(date);
              const key = `${habit.id}-${dateString}`;
              
              // Only add if not already loaded (to avoid overwriting current week data)
              if (!(key in habitNumberValues)) {
                const value = completedValues[dateString] || 0;
                habitNumberValues[key] = value;
              }
            }
            
            console.log('🎯 Loaded Process Appointments data from Sept 1 to current date');       
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
  }, [user, habits, currentWeek]); // Remove weekDates dependency to prevent infinite loop

  // Generate week history (last 12 weeks)
  useEffect(() => {
    const generateWeekHistory = () => {
      const weeks = [];
      let currentDate = new Date();
      
      for (let i = 0; i < 12; i++) {
        weeks.push({
          date: new Date(currentDate),
          range: getWeekRangeString(currentDate),
          isCurrentWeek: isCurrentWeek(currentDate)
        });
        currentDate = getPreviousWeek(currentDate);
      }
      
      setWeekHistory(weeks);
    };
    
    generateWeekHistory();
  }, []);

  // Load completed habits for the current week - now includes loadWeeklyProgress
  useEffect(() => {
    if (!user || habits.length === 0) return;
    
    loadWeeklyProgress();
  }, [user, habits, currentWeek, loadWeeklyProgress]);

  const updateHabitValue = async (habit, date, value) => {
    if (!user) return;
    
    const dateString = formatDateString(date);
    const key = `${habit.id}-${dateString}`;
    const numValue = parseInt(value) || 0;
    
    // Update local state
    setHabitValues(prev => ({
      ...prev,
      [key]: numValue
    }));
    
    setCompletedHabits(prev => ({
      ...prev,
      [key]: numValue >= (habit.target || 1)
    }));

    try {
      const habitDoc = await getDocs(query(collection(db, 'habits'), where('__name__', '==', habit.id)));
      
      if (!habitDoc.empty) {
        const habitData = habitDoc.docs[0].data();
        let completedDates = habitData.completedDates || [];
        let completedValues = habitData.completedValues || {};
        
        // Update the value for this date
        completedValues[dateString] = numValue;
        
        // Update completed dates based on target
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

  const toggleHabitCompletion = async (habit, date) => {
    if (!user || habit.type === 'number') return; // Don't use toggle for number habits
    
    const dateString = formatDateString(date);
    const key = `${habit.id}-${dateString}`;
    const isCurrentlyCompleted = completedHabits[key];
    
    // Optimistic update
    setCompletedHabits(prev => ({
      ...prev,
      [key]: !isCurrentlyCompleted
    }));

    try {
      const habitDoc = await getDocs(query(collection(db, 'habits'), where('__name__', '==', habit.id)));
      
      if (!habitDoc.empty) {
        const habitData = habitDoc.docs[0].data();
        let completedDates = habitData.completedDates || [];
        
        if (isCurrentlyCompleted) {
          // Remove date
          completedDates = completedDates.filter(d => d !== dateString);
        } else {
          // Add date
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
      // Revert optimistic update
      setCompletedHabits(prev => ({
        ...prev,
        [key]: isCurrentlyCompleted
      }));
    }
  };

  const getCompletionPercentage = (habit) => {
    let completed = 0;
    weekDates.forEach(date => {
      const dateString = formatDateString(date);
      const key = `${habit.id}-${dateString}`;
      if (completedHabits[key]) completed++;
    });
    return Math.round((completed / 7) * 100);
  };

  const getDailyScore = (date) => {
    const dateString = formatDateString(date);
    let score = 0;
    
    // Only include scoring habits (not custom habits)
    scoringHabits.forEach(habit => {
      const key = `${habit.id}-${dateString}`;
      
      if (habit.type === 'number') {
        // For number habits, add the actual value
        const value = habitValues[key] || 0;
        score += value;
      } else {
        // For boolean habits, add 1 point if completed
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

  const getMaxPossibleDailyScore = () => {
    let maxScore = 0;
    // Only calculate for scoring habits
    scoringHabits.forEach(habit => {
      if (habit.type === 'number') {
        maxScore += Math.max(habit.target * 2, 10);
      } else {
        maxScore += 1;
      }
    });
    return maxScore;
  };

  const getMaxPossibleWeeklyScore = () => {
    return getMaxPossibleDailyScore() * 7;
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6">
      {/* Week Navigation with History - Mobile Optimized */}
      <div className="week-navigation">
        <button
          onClick={() => setCurrentWeek(getPreviousWeek(currentWeek))}
          className="flex items-center px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
        >
          <span className="mr-1 sm:mr-2">←</span>
          <span className="hidden sm:inline">Previous Week</span>
          <span className="sm:hidden">Prev</span>
        </button>
        
        <div className="text-center relative">
          <button
            onClick={() => setShowWeekPicker(!showWeekPicker)}
            className="week-title font-bold text-gray-800 hover:text-blue-600 cursor-pointer px-2"
          >
            <span className="hidden sm:inline text-2xl">Week of {weekRange}</span>
            <span className="sm:hidden text-lg">{weekRange}</span>
            <span className="ml-2 text-sm">📅</span>
          </button>
          {isCurrentWeek(currentWeek) && (
            <span className="text-xs sm:text-sm text-blue-600 font-medium block">Current Week</span>
          )}
          
          {/* Week Picker Dropdown - Mobile Optimized */}
          {showWeekPicker && (
            <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-56 sm:w-64">
              <div className="p-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base">Select Week</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {weekHistory.map((week, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentWeek(week.date);
                      setShowWeekPicker(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 text-sm ${
                      week.isCurrentWeek ? 'bg-blue-50 text-blue-600 font-medium' : ''
                    } ${
                      getWeekRangeString(week.date) === weekRange ? 'bg-gray-100' : ''
                    }`}
                  >
                    <div>{week.range}</div>
                    {week.isCurrentWeek && (
                      <div className="text-xs text-blue-500">Current Week</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <button
          onClick={() => setCurrentWeek(getNextWeek(currentWeek))}
          className="flex items-center px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
        >
          <span className="hidden sm:inline">Next Week</span>
          <span className="sm:hidden">Next</span>
          <span className="ml-1 sm:ml-2">→</span>
        </button>
      </div>

      {/* Action Buttons - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 mb-4">
        {!isCurrentWeek(currentWeek) && (
          <button
            onClick={() => setCurrentWeek(new Date())}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Go to Current Week
          </button>
        )}
        <button
          onClick={() => setIsCustomHabitsModalOpen(true)}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center text-sm"
        >
          <span className="mr-2">⭐</span>
          Add Custom Habit {formatDateString(new Date())} 
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 text-sm sm:text-base">Loading habits...</p>
        </div>
      ) : (
        <>
          {/* Overall Score Card - Mobile Optimized */}
          <div className="score-card mb-4 sm:mb-6">
            <div className="score-card-content flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="score-card-main mb-4 sm:mb-0 text-center sm:text-left">
                <h3 className="text-xl sm:text-2xl font-bold mb-2">🏆 Weekly Score</h3>
                <div className="text-2xl sm:text-4xl font-bold">{getWeeklyScore()} Points</div>
                <div className="text-blue-100 mt-1 text-sm">
                  Week of {weekRange}
                </div>
                {scoringHabits.length !== habits.length && (
                  <div className="text-blue-200 text-xs sm:text-sm mt-1">
                    *Score includes {scoringHabits.length} scoring habits only
                  </div>
                )}
              </div>
              <div className="score-card-stats text-center sm:text-right">
                <div className="text-lg sm:text-xl font-semibold">
                  {Math.round((getWeeklyScore() / Math.max(getMaxPossibleWeeklyScore(), 1)) * 100)}%
                </div>
                <div className="text-blue-100 text-sm">
                  of max possible
                </div>
                <div className="text-blue-100 text-xs mt-2">
                  Max: {getMaxPossibleWeeklyScore()} pts
                </div>
              </div>
            </div>
            
            {/* Daily breakdown - Mobile Optimized */}
            <div className="daily-breakdown">
              {weekDates.map((date, index) => {
                const dailyScore = getDailyScore(date);
                const maxDaily = getMaxPossibleDailyScore();
                const percentage = Math.round((dailyScore / Math.max(maxDaily, 1)) * 100);
                
                return (
                  <div key={date.toISOString()} className="daily-breakdown-item bg-white bg-opacity-20 rounded-lg p-1 sm:p-2">
                    <div className="text-xs font-medium">
                      {CUSTOM_WEEK_DAYS[index].short}
                    </div>
                    <div className="daily-breakdown-score text-sm sm:text-lg font-bold">
                      {dailyScore}
                    </div>
                    <div className="text-xs opacity-80">
                      {percentage}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Habits Section Headers */}
          {scoringHabits.length > 0 && (
            <div className="mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex flex-wrap items-center">
                <span className="mr-2">🎯</span>
                Scoring Habits
                <span className="ml-2 text-xs sm:text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  Counts toward score
                </span>
              </h3>
            </div>
          )}

          {/* Scoring Habits Grid - Mobile Optimized */}
          {scoringHabits.length > 0 && (
            <div className="habits-grid mb-6">
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="habits-table overflow-x-auto">
                  <table className="w-full min-w-[800px] sm:min-w-full">
                    {/* Header Row */}
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="p-2 sm:p-4 font-semibold text-gray-700 text-left text-xs sm:text-sm">Habits</th>
                        {weekDates.map((date, index) => (
                          <th key={date.toISOString()} className="p-2 sm:p-4 text-center min-w-[60px]">
                            <div className="font-semibold text-gray-700 text-xs sm:text-sm">
                              {CUSTOM_WEEK_DAYS[index].short}
                            </div>
                            <div className={`text-xs mt-1 ${
                              isToday(date) 
                                ? 'text-white bg-blue-600 font-bold px-2 py-1 rounded-full border-2 border-blue-600' 
                                : 'text-gray-500'
                            }`}                                                                                                      
                            >
                            {date.getDate()}
                            </div>
                            {isToday(date) && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full mx-auto mt-1 animate-pulse"></div>
                            )}
                            <div className="text-xs text-green-600 font-semibold mt-1">
                              {getDailyScore(date)} pts
                            </div>
                          </th>
                        ))}
                        <th className="p-2 sm:p-4 text-center bg-blue-50 border-l min-w-[80px]">
                          <div className="font-semibold text-blue-700 text-xs sm:text-sm">Weekly</div>
                          <div className="text-xs text-blue-600 mt-1">Total</div>
                          <div className="text-sm sm:text-lg font-bold text-blue-700 mt-1">
                            {getWeeklyScore()}
                          </div>
                          <div className="text-xs text-blue-500">
                            points
                          </div>
                        </th>
                      </tr>
                    </thead>

                    {/* Habit Rows */}
                    <tbody>
                      {scoringHabits.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="p-6 sm:p-8 text-center text-gray-500">
                            <p>No scoring habits added yet.</p>
                            <p className="text-xs sm:text-sm mt-1">Add some predefined habits to start scoring!</p>
                          </td>
                        </tr>
                      ) : (
                        scoringHabits.map((habit) => (
                          <tr key={habit.id} className="border-b last:border-b-0 hover:bg-gray-50">
                            <td className="p-2 sm:p-4 min-w-[200px]">
                              <div className="flex items-center">
                                <span className="text-lg sm:text-xl mr-2 sm:mr-3">{habit.icon}</span>
                                <div>
                                  <div className="font-medium text-gray-800 text-xs sm:text-sm">
                                    {habit.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {getCompletionPercentage(habit)}% this week
                                  </div>
                                  {habit.type === 'number' && (
                                    <div className="text-xs text-blue-600 mt-1">
                                      Target: {habit.target} {habit.unit}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            
                            {weekDates.map((date) => {
                              const dateString = formatDateString(date);
                              const key = `${habit.id}-${dateString}`;
                              const isCompleted = completedHabits[key];
                              const isDateToday = isToday(date);
                              const currentValue = habitValues[key] || 0;
                              
                              return (
                                <td key={dateString} className="p-2 sm:p-4 text-center min-w-[60px]">
                                  {habit.type === 'number' ? (
                                    <div className="flex flex-col items-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max="99"
                                        value={currentValue}
                                        onChange={(e) => updateHabitValue(habit, date, e.target.value)}
                                        className={`w-10 sm:w-12 h-6 sm:h-8 text-center text-xs sm:text-sm border rounded ${
                                          isCompleted
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : isDateToday
                                            ? 'border-blue-400 bg-blue-50'
                                            : 'border-gray-300'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                                        title={`${habit.name} - ${date.toLocaleDateString()} (Target: ${habit.target})`}
                                      />
                                      {isCompleted && (
                                        <div className="text-green-500 text-xs mt-1">✓</div>
                                      )}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => toggleHabitCompletion(habit, date)}
                                      className={`w-6 sm:w-8 h-6 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isCompleted
                                          ? 'bg-green-500 border-green-500 text-white hover:bg-green-600'
                                          : isDateToday
                                          ? 'border-blue-400 hover:border-blue-500 hover:bg-blue-50'
                                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                                      }`}
                                      title={`${habit.name} - ${date.toLocaleDateString()}`}
                                    >
                                      {isCompleted && <span className="text-xs">✓</span>}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                            
                            {/* Weekly total for this habit */}
                            <td className="p-2 sm:p-4 text-center bg-gray-50 border-l min-w-[80px]">
                              <div className="text-xs sm:text-sm font-medium text-gray-700">
                                {habit.type === 'number' ? (
                                  weekDates.reduce((sum, date) => {
                                    const key = `${habit.id}-${formatDateString(date)}`;
                                    return sum + (habitValues[key] || 0);
                                  }, 0)
                                ) : (
                                  weekDates.reduce((sum, date) => {
                                    const key = `${habit.id}-${formatDateString(date)}`;
                                    return sum + (completedHabits[key] ? 1 : 0);
                                  }, 0)
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {habit.type === 'number' ? habit.unit : 'days'}
                              </div>
                              {/* Leadership Goal Progress for Process Appointments */}
                                {(() => {
                                  const goalProgress = getLeadershipGoalProgress(habit, habitValues);
                                  if (goalProgress && goalProgress.isActive) {
                                    return (
                                      <div className="mt-2 pt-2 border-t border-gray-300">
                                        <div className="text-xs font-semibold text-purple-700">
                                          Leadership Goal
                                        </div>
                                        <div className="text-xs text-purple-600">
                                          {goalProgress.total}/{goalProgress.target}
                                        </div>
                                        <div className="text-xs text-red-600 font-medium">
                                          {goalProgress.remaining} needed
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {goalProgress.daysRemaining} days left
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                          <div 
                                            className="bg-purple-600 h-1.5 rounded-full transition-all"
                                            style={{ width: `${goalProgress.progress}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </td>
                            
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Custom Habits Section - Mobile Optimized */}
          {customHabits.length > 0 && (
            <>
              <div className="mb-4 mt-6 sm:mt-8">
                <h3 className="text-base sm:text-lg font-semibold text-gray-600 flex flex-wrap items-center">
                  <span className="mr-2">⭐</span>
                  Custom Habits
                  <span className="ml-2 text-xs sm:text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    Personal tracking only
                  </span>
                </h3>
              </div>

              <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] sm:min-w-full">
                    {/* Custom Habits Header */}
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-300">
                        <th className="p-2 sm:p-4 font-medium text-gray-600 text-left text-xs sm:text-sm">Custom Habits</th>
                        {weekDates.map((date, index) => (
                          <th key={date.toISOString()} className="p-2 sm:p-4 text-center min-w-[60px]">
                            <div className="font-medium text-gray-600 text-xs">
                              {CUSTOM_WEEK_DAYS[index].short}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {date.getDate()}
                            </div>
                          </th>
                        ))}
                        <th className="p-2 sm:p-4 text-center bg-gray-200 border-l border-gray-300 min-w-[80px]">
                          <div className="font-medium text-gray-600 text-xs">Weekly</div>
                          <div className="text-xs text-gray-500 mt-1">Total</div>
                        </th>
                      </tr>
                    </thead>

                    {/* Custom Habits Rows */}
                    <tbody>
                      {customHabits.map((habit) => (
                        <tr key={habit.id} className="border-b last:border-b-0 border-gray-300 hover:bg-gray-100">
                          <td className="p-2 sm:p-4 min-w-[200px]">
                            <div className="flex items-center">
                              <span className="text-lg sm:text-xl mr-2 sm:mr-3 opacity-70">{habit.icon}</span>
                              <div>
                                <div className="font-medium text-gray-700 text-xs sm:text-sm">
                                  {habit.name}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {getCompletionPercentage(habit)}% this week
                                </div>
                                {habit.type === 'number' && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Target: {habit.target} {habit.unit}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          
                          {weekDates.map((date) => {
                            const dateString = formatDateString(date);
                            const key = `${habit.id}-${dateString}`;
                            const isCompleted = completedHabits[key];
                            const isDateToday = isToday(date);
                            const currentValue = habitValues[key] || 0;
                            console.log('Custom Habit Value:', isDateToday, date, isToday(date));

                            return (
                              <td key={dateString} className="p-2 sm:p-4 text-center min-w-[60px]">
                                {habit.type === 'number' ? (
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max="99"
                                      value={currentValue}
                                      onChange={(e) => updateHabitValue(habit, date, e.target.value)}
                                      className={`w-10 sm:w-12 h-6 sm:h-8 text-center text-xs sm:text-sm border rounded ${
                                        isCompleted
                                          ? 'border-gray-400 bg-gray-100 text-gray-600'
                                          : isDateToday
                                          ? 'border-gray-400 bg-gray-50'
                                          : 'border-gray-300 bg-white'
                                      } focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400`}
                                      title={`${habit.name} - ${date.toLocaleDateString()} (Target: ${habit.target})`}
                                    />
                                    {isCompleted && (
                                      <div className="text-gray-500 text-xs mt-1">✓</div>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => toggleHabitCompletion(habit, date)}
                                    className={`w-6 sm:w-8 h-6 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                                      isCompleted
                                        ? 'bg-gray-400 border-gray-400 text-white hover:bg-gray-500'
                                        : isDateToday
                                        ? 'border-gray-400 hover:border-gray-500 hover:bg-gray-100'
                                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                    title={`${habit.name} - ${date.toLocaleDateString()}`}
                                  >
                                    {isCompleted && <span className="text-xs">✓</span>}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          
                          {/* Weekly total for custom habit */}
                          <td className="p-2 sm:p-4 text-center bg-gray-200 border-l border-gray-300 min-w-[80px]">
                            <div className="text-xs sm:text-sm font-medium text-gray-600">
                              {habit.type === 'number' ? (
                                weekDates.reduce((sum, date) => {
                                  const key = `${habit.id}-${formatDateString(date)}`;
                                  return sum + (habitValues[key] || 0);
                                }, 0)
                              ) : (
                                weekDates.reduce((sum, date) => {
                                  const key = `${habit.id}-${formatDateString(date)}`;
                                  return sum + (completedHabits[key] ? 1 : 0);
                                }, 0)
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {habit.type === 'number' ? habit.unit : 'days'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Overall Summary */}
          {habits.length === 0 && (
            <div className="p-6 sm:p-8 text-center text-gray-500 bg-white rounded-lg border">
              <p className="text-sm sm:text-base">No habits added yet.</p>
              <div className="mt-4 space-y-2">
                <p className="text-xs sm:text-sm">Get started by:</p>
                <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <span className="text-blue-600">Adding predefined scoring habits</span>
                  <span className="text-gray-400 hidden sm:inline">or</span>
                  <span className="text-gray-600">Creating custom personal habits</span>
                </div>
              </div>
            </div>
          )}

          {/* Week Summary - Mobile Optimized */}
          {habits.length > 0 && (
            <div className="summary-section mt-4 sm:mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <h3 className="font-semibold text-blue-800 mb-3 text-sm sm:text-base">📊 Week Summary & Scoring</h3>
              
              {scoringHabits.length > 0 && (
                <>
                  <h4 className="font-medium text-blue-700 mb-2 text-sm">🎯 Scoring Habits:</h4>
                  <div className="summary-grid grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4">
                    {scoringHabits.map(habit => {
                      const percentage = getCompletionPercentage(habit);
                      const weeklyTotal = habit.type === 'number' ? 
                        weekDates.reduce((sum, date) => {
                          const key = `${habit.id}-${formatDateString(date)}`;
                          return sum + (habitValues[key] || 0);
                        }, 0) :
                        weekDates.reduce((sum, date) => {
                          const key = `${habit.id}-${formatDateString(date)}`;
                          return sum + (completedHabits[key] ? 1 : 0);
                        }, 0);
                      
                      return (
                        <div key={habit.id} className="summary-card text-center bg-white rounded-lg p-2 sm:p-3">
                          <div className="summary-card-icon text-lg sm:text-2xl mb-1">{habit.icon}</div>
                          <div className="summary-card-name text-xs sm:text-sm font-medium text-gray-700">{habit.name}</div>
                          <div className={`summary-card-value text-sm sm:text-lg font-bold ${
                            percentage >= 80 ? 'text-green-600' : 
                            percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {weeklyTotal} {habit.type === 'number' ? 'pts' : 'days'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {percentage}% completed
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
                          <div className="mb-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg p-4">
                          <h4 className="font-bold text-white mb-2 text-sm flex items-center">
                            🎯 Leadership Promotion Goal
                          </h4>
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className="text-center">
                              <div className="text-2xl font-bold">{goalProgress.total}</div>
                              <div className="text-xs opacity-90">Completed</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-yellow-300">{goalProgress.remaining}</div>
                              <div className="text-xs opacity-90">Remaining</div>
                            </div>
                          </div>
                          <div className="mb-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Progress</span>
                              <span>{Math.round(goalProgress.progress)}%</span>
                            </div>
                            <div className="w-full bg-white bg-opacity-30 rounded-full h-2">
                              <div 
                                className="bg-yellow-300 h-2 rounded-full transition-all"
                                style={{ width: `${goalProgress.progress}%` }}
                              ></div>
                            </div>
                          </div>
                          <div className="text-xs opacity-90 text-center">
                            {goalProgress.daysRemaining} days remaining until December 1st
                          </div>
                          {goalProgress.remaining > 0 && goalProgress.daysRemaining > 0 && (
                            <div className="text-xs text-center mt-2 bg-white bg-opacity-20 rounded px-2 py-1">
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
                  <h4 className="font-medium text-gray-600 mb-2 text-sm">⭐ Custom Habits:</h4>
                  <div className="summary-grid grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4">
                    {customHabits.map(habit => {
                      const percentage = getCompletionPercentage(habit);
                      const weeklyTotal = habit.type === 'number' ? 
                        weekDates.reduce((sum, date) => {
                          const key = `${habit.id}-${formatDateString(date)}`;
                          return sum + (habitValues[key] || 0);
                        }, 0) :
                        weekDates.reduce((sum, date) => {
                          const key = `${habit.id}-${formatDateString(date)}`;
                          return sum + (completedHabits[key] ? 1 : 0);
                        }, 0);
                      
                      return (
                        <div key={habit.id} className="summary-card text-center bg-gray-100 rounded-lg p-2 sm:p-3">
                          <div className="summary-card-icon text-lg sm:text-2xl mb-1 opacity-70">{habit.icon}</div>
                          <div className="summary-card-name text-xs sm:text-sm font-medium text-gray-600">{habit.name}</div>
                          <div className="summary-card-value text-sm sm:text-lg font-bold text-gray-600">
                            {weeklyTotal} {habit.type === 'number' ? habit.unit : 'days'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {percentage}% completed
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              
              {/* Scoring Legend */}
              <div className="bg-white rounded-lg p-3 border-l-4 border-blue-500">
                <h4 className="font-semibold text-blue-800 mb-2 text-sm">🎯 How Scoring Works:</h4>
                <div className="text-xs sm:text-sm text-blue-700 space-y-1">
                  <div><strong>Scoring Habits:</strong> Count toward your daily/weekly points</div>
                  <div><strong>Custom Habits:</strong> Personal tracking only (no points)</div>
                  <div><strong>Checkmarks:</strong> 1 point per completion</div>
                  <div><strong>Numbers:</strong> Actual number entered (appointments, contacts, etc.)</div>
                </div>
              </div>            
            </div>
          )}

          {/* Week Structure Info */}
          <div className="mt-4 text-center text-xs sm:text-sm text-gray-500">
            <p>📅 Your week runs from <strong>Saturday to Friday</strong></p>
            <p className="mt-1">
              {isCurrentWeek(currentWeek) ? `Current week: ${weekRange}` : `Viewing: ${weekRange}`}
            </p>
          </div>
        </>
      )}

      {/* Custom Habits Modal */}
      <CustomHabitsModal
        isOpen={isCustomHabitsModalOpen}
        onClose={() => setIsCustomHabitsModalOpen(false)}
        onHabitAdded={() => {
          onRefreshHabits && onRefreshHabits();
          loadWeeklyProgress();
        }}
      />

      {/* Click outside to close week picker */}
      {showWeekPicker && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowWeekPicker(false)}
        />
      )}
    </div>
  );
};

export default WeeklyHabitTracker;