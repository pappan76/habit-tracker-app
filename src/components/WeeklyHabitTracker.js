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
import { ChevronLeft, ChevronRight, Plus, Trash2, Target, Star, LayoutGrid, Table, TrendingUp, Award, Zap, AlertTriangle, X } from 'lucide-react';
import { HabitRecommendations } from './HabitRecommendations';
import { generateProgressInsights, generateMotivationalMessage, getCachedOrGenerate } from '../services/aiService';



const getHabitColorByPerformance = (percentage) => {
  if (percentage >= 80) {
    return 'from-green-500 to-emerald-600';
  } else if (percentage >= 50) {
    return 'from-amber-500 to-orange-600';
  } else {
    return 'from-red-500 to-rose-600';
  }
};

const getContrastingTextColor = (percentage) => {
  if (percentage >= 80) {
    return 'text-gray-900';
  } else if (percentage >= 50) {
    return 'text-gray-900';
  } else {
    return 'text-black';
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

const WeeklyHabitTracker = ({ habits = [], onRefreshHabits, onNavigateToAddHabits }) => {
 const [aiInsights, setAiInsights] = useState([]);
  const [motivationalMessage, setMotivationalMessage] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  
  const [user] = useAuthState(auth);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [completedHabits, setCompletedHabits] = useState({});
  const [habitValues, setHabitValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [isCustomHabitsModalOpen, setIsCustomHabitsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('capsules');

  const weekDates = getCustomWeekDates(currentWeek);
  const weekRange = getWeekRangeString(currentWeek);

  const validHabits = habits.filter(habit => habit && habit.id && habit.name);
  const scoringHabits = validHabits.filter(habit => !habit.isCustom);
  const customHabits = validHabits.filter(habit => habit.isCustom);

  const [showInsights, setShowInsights] = useState(false);

  // Detect duplicate scoring habits
  const getDuplicateHabits = () => {
    const habitGroups = {};
    
    scoringHabits.forEach(habit => {
      const key = habit.name.toLowerCase().trim();
      if (!habitGroups[key]) {
        habitGroups[key] = [];
      }
      habitGroups[key].push(habit);
    });
    
    // Return only groups with duplicates
    return Object.values(habitGroups).filter(group => group.length > 1);
  };

  const duplicateGroups = getDuplicateHabits();

  const deletePredefinedHabit = async (habit) => {
    if (!user || !habit || habit.isCustom) return;

    if (!window.confirm(`Are you sure you want to delete the predefined habit "${habit.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'habits', habit.id));
      onRefreshHabits && onRefreshHabits();
      alert(`Predefined habit "${habit.name}" has been deleted.`);
    } catch (error) {
      console.error('Error deleting predefined habit:', error);
      alert('Failed to delete habit. Please try again.');
    }
  };

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

  useEffect(() => {
  if (validHabits.length > 0) {
    // Only run once per week to avoid rate limits
    const weekKey = currentWeek.toISOString().split('T')[0];
    const lastRun = localStorage.getItem('lastAIRun');
    
    if (lastRun !== weekKey) {
      generateAIInsights();
      generateDailyMotivation();
      localStorage.setItem('lastAIRun', weekKey);
    } else {
      // Load from cache if already run this week
      loadCachedInsights();
      loadCachedMotivation();
    }
  }
}, [validHabits.length, currentWeek.toISOString().split('T')[0]]); // Only change when week actually changes


 const loadCachedInsights = () => {
  const cacheKey = `insights-${currentWeek.toISOString().split('T')[0]}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data } = JSON.parse(cached);
    setAiInsights(data.insights || []);
  }
};

const loadCachedMotivation = () => {
  const cacheKey = `motivation-${new Date().toDateString()}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data } = JSON.parse(cached);
    setMotivationalMessage(data);
  }
};

const generateAIInsights = async () => {
  setLoadingAI(true);
  try {
    const cacheKey = `insights-${currentWeek.toISOString().split('T')[0]}`;
    
    const insights = await getCachedOrGenerate(cacheKey, async () => {
      const habitData = scoringHabits.map(habit => ({
        name: habit.name,
        completionRate: getHabitCompletionPercentage(habit),
        weeklyTotal: getHabitWeekProgress(habit)
      }));

      const weeklyScores = weekDates.map(date => getDailyScore(date));
      return await generateProgressInsights(habitData, weeklyScores);
    });
    
    setAiInsights(insights.insights || []);
  } catch (error) {
    console.error('AI insights error:', error);
  } finally {
    setLoadingAI(false);
  }
};

const generateDailyMotivation = async () => {
  try {
    const avgCompletion = scoringHabits.reduce((sum, habit) => 
      sum + getHabitCompletionPercentage(habit), 0) / scoringHabits.length;
    
    // Cache for the whole day
    const cacheKey = `motivation-${new Date().toDateString()}`;
    
    const message = await getCachedOrGenerate(
      cacheKey,
      () => generateMotivationalMessage(avgCompletion, getWeeklyScore())
    );
    
    setMotivationalMessage(message);
  } catch (error) {
    console.error('Motivation error:', error);
    setMotivationalMessage("Keep up the great work! Every day counts.");
  }
};

// Optional: Add manual refresh buttons
const handleRefreshInsights = async () => {
  // Clear cache and regenerate
  const cacheKey = `insights-${currentWeek.toISOString().split('T')[0]}`;
  localStorage.removeItem(cacheKey);
  await generateAIInsights();
};

const handleRefreshMotivation = async () => {
  const cacheKey = `motivation-${new Date().toDateString()}`;
  localStorage.removeItem(cacheKey);
  await generateDailyMotivation();
};

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

// Replace your AIInsightsSection component with this:

const AIInsightsSection = () => (
  <div className="space-y-3">
    {/* Motivation Message - Clean & Attractive */}
    {motivationalMessage && (
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-pink-500/10 rounded-xl blur-xl"></div>
        <div className="relative flex items-center gap-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl px-4 py-3 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-lg shadow-lg shrink-0">
            <Zap size={16} className="text-black" />
          </div>
          <p className="flex-1 text-black text-sm font-semibold leading-relaxed">
            {motivationalMessage}
          </p>
          <button
            onClick={handleRefreshMotivation}
            className="bg-white/10 hover:bg-white/15 border border-white/20 text-amber-200 hover:text-black px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0"
          >
            New Quote
          </button>
        </div>
      </div>
    )}

    {/* Insights Accordion */}
    <div className="bg-gradient-to-r from-slate-800/95 to-slate-900/95 backdrop-blur-lg rounded-2xl border border-violet-500/20 hover:border-violet-500/40 shadow-lg transition-all overflow-hidden">
      <button
        onClick={() => {
          if (!showInsights && aiInsights.length === 0 && !loadingAI) {
            generateAIInsights();
          }
          setShowInsights(!showInsights);
        }}
        className="w-full px-4 py-3.5 hover:bg-white/5 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-2 rounded-lg">
            <Award size={16} className="text-black" />
          </div>
          <div className="text-left">
            <p className="text-black text-sm font-semibold">AI Insights</p>
            <p className="text-slate-500 text-xs">Powered by Gemini</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {showInsights && aiInsights.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRefreshInsights();
              }}
              className="bg-white/5 hover:bg-white/10 text-black/60 hover:text-black px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            >
              ↻
            </button>
          )}
          <ChevronRight 
            size={18} 
            className={`text-black/60 transform transition-transform ${showInsights ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {showInsights && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3">
          {loadingAI ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-violet-500 border-t-transparent mb-2"></div>
              <p className="text-slate-500 text-xs">Analyzing...</p>
            </div>
          ) : aiInsights.length > 0 ? (
            <div className="space-y-2">
              {aiInsights.map((insight, index) => (
                <div 
                  key={index} 
                  className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50 hover:border-violet-500/30 transition-colors"
                >
                  <div className="flex gap-2">
                    <div className="bg-violet-500/10 rounded p-1 shrink-0 mt-0.5">
                      <TrendingUp size={12} className="text-violet-400" />
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">{insight}</p>
                  </div>
                </div>
              ))}
              <p className="text-slate-600 text-xs text-center pt-2 mt-2 border-t border-slate-800">
                Last updated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="bg-slate-800/50 rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-2">
                <Award size={20} className="text-slate-600" />
              </div>
              <p className="text-slate-500 text-xs">Complete habits to see insights</p>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
<div className="sticky top-0 bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl z-40 border-b border-white/10 backdrop-blur-xl">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
    {/* Top Row: Navigation + Score */}
    <div className="flex items-center justify-between gap-4 mb-4">
      {/* Week Navigation */}
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={() => setCurrentWeek(getPreviousWeek(currentWeek))}
          className="p-2 bg-white/10 hover:bg-white/15 rounded-xl transition-all active:scale-95 border border-white/5"
        >
          <ChevronLeft size={18} className="text-black" />
        </button>
        <div className="text-left">
          <h1 className="text-lg sm:text-xl font-bold text-black">{weekRange}</h1>
          <p className="text-xs text-black/50 font-medium">Sat - Fri</p>
        </div>
      </div>

      {/* Weekly Score */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl px-4 py-2.5 shadow-lg border border-white/20">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-black shrink-0" />
          <div>
            <p className="text-xs font-semibold text-black/80 uppercase tracking-wide">Score</p>
            <p className="text-2xl font-black text-black leading-none">{getWeeklyScore()}</p>
          </div>
        </div>
      </div>

      {/* Next Week Button */}
      <button
        onClick={() => setCurrentWeek(getNextWeek(currentWeek))}
        className="p-2 bg-white/10 hover:bg-white/15 rounded-xl transition-all active:scale-95 border border-white/5"
      >
        <ChevronRight size={18} className="text-black" />
      </button>
    </div>

    {/* AI Section */}
    {validHabits.length > 0 && <AIInsightsSection />}

    {/* Current Week Jump Button */}
    {!isCurrentWeek(currentWeek) && (
      <button
        onClick={() => setCurrentWeek(new Date())}
        className="w-full mt-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-black py-2 rounded-xl text-sm font-semibold transition-all"
      >
        Jump to Current Week
      </button>
    )}
  </div>
</div>

const HabitCard = ({ habit, isCustom, isDuplicate }) => {
  const progress = getHabitWeekProgress(habit);
  const completionPercentage = getHabitCompletionPercentage(habit);
  const cardColor = getHabitColorByPerformance(completionPercentage);
  const goalProgress = getLeadershipGoalProgress(habit, habitValues);

  return (
    <div className={`flex-shrink-0 w-80 rounded-2xl p-5 shadow-xl bg-gradient-to-br ${cardColor} border-2 ${
      isDuplicate ? 'border-red-400' : 'border-white/10'
    } hover:scale-[1.01] transition-transform`}>
      {isDuplicate && (
        <div className="mb-3 bg-red-500/20 rounded-lg p-2.5 border border-red-400/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-red-300" />
              <span className="text-xs font-semibold text-red-300">Duplicate</span>
            </div>
            <button
              onClick={() => deletePredefinedHabit(habit)}
              className="bg-red-500 hover:bg-red-600 text-black p-1 rounded text-xs"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5 border border-white/20">
            <span className="text-3xl">{habit.icon}</span>
          </div>
          <div>
            <h3 className="font-bold text-lg text-black drop-shadow">{habit.name}</h3>
            {habit.type === 'number' && (
              <p className="text-xs text-black/70 font-medium">Goal: {habit.target} {habit.unit}</p>
            )}
          </div>
        </div>
        {isCustom && (
          <button 
            onClick={() => deleteCustomHabit(habit)}
            className="text-black/70 hover:text-black p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4 bg-white/15 backdrop-blur-sm rounded-xl p-3 border border-white/20">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-black font-semibold">{progress}/7 days</span>
          <span className="text-black font-bold">{completionPercentage}%</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
          <div 
            className="h-2.5 bg-white rounded-full transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Goal Progress (if applicable) */}
      {goalProgress && goalProgress.isActive && (
        <div className="mb-4 bg-yellow-400/20 rounded-xl p-3 border border-yellow-400/30">
          <div className="flex justify-between text-xs mb-2 text-black">
            <span className="font-semibold">Leadership Goal</span>
            <span className="font-bold">{Math.round(goalProgress.progress)}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
            <div 
              className="h-2 bg-gradient-to-r from-yellow-300 to-orange-400 rounded-full"
              style={{ width: `${goalProgress.progress}%` }}
            />
          </div>
          <p className="text-xs text-black/80 text-center mt-1.5">
            {goalProgress.remaining} needed • {goalProgress.daysRemaining} days left
          </p>
        </div>
      )}

      {/* Daily Tracking Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, index) => {
          const key = `${habit.id}-${formatDateString(date)}`;
          const isCompleted = habit.type === 'number' 
            ? (habitValues[key] || 0) >= (habit.target || 1)
            : completedHabits[key];
          const isTodayDate = isToday(date);
          const value = habitValues[key] || 0;

          return (
            <div key={index} className="flex flex-col items-center gap-1">
              <div className={`text-xs font-bold ${isTodayDate ? 'text-blue-300' : 'text-black/70'}`}>
                {CUSTOM_WEEK_DAYS[index].short}
              </div>
              <div className={`text-base font-bold ${isTodayDate ? 'text-blue-300' : 'text-black'}`}>
                {date.getDate()}
              </div>
              
              {habit.type === 'number' ? (
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={value}
                  onChange={(e) => updateHabitValue(habit, date, e.target.value)}
                  className={`w-11 h-11 text-center text-sm font-bold border-2 rounded-lg focus:outline-none focus:ring-2 ${
                    isTodayDate 
                      ? 'border-blue-400 bg-blue-50 text-blue-900 focus:ring-blue-400' 
                      : 'border-white/30 bg-white text-slate-900 focus:ring-white/50'
                  }`}
                />
              ) : (
                <button
                  onClick={() => toggleHabitCompletion(habit, date)}
                  className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center font-bold transition-all ${
                    isCompleted
                      ? 'bg-white/90 text-green-600 border-white/90'
                      : isTodayDate
                      ? 'border-blue-400 bg-blue-50/50 text-blue-600'
                      : 'border-white/30 bg-white/10 text-black/50 hover:bg-white/20'
                  }`}
                >
                  {isCompleted && '✓'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="sticky top-0 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 shadow-2xl z-40 border-b-4 border-white/10">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentWeek(getPreviousWeek(currentWeek))}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-2xl transition-all active:scale-95 backdrop-blur-md shadow-lg border border-white/30"
            >
              <ChevronLeft size={24} className="text-black" />
            </button>
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl px-6 py-4 shadow-2xl border-2 border-white/30 transform hover:scale-105 transition-all">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Zap size={20} className="text-black" />
                  <p className="text-xs font-black text-black uppercase tracking-wider">Weekly Score</p>
                </div>
                <p className="text-4xl font-black text-black drop-shadow-lg">{getWeeklyScore()}</p>
                <p className="text-xs text-black/90 font-bold">points</p>
              </div>
              <div className="text-center">
                <h1 className="text-3xl font-black text-black drop-shadow-2xl tracking-tight">{weekRange}</h1>
                <p className="text-sm text-black/90 font-semibold mt-1">Saturday - Friday</p>
             </div>
            </div>
            
            <button
              onClick={() => setCurrentWeek(getNextWeek(currentWeek))}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-2xl transition-all active:scale-95 backdrop-blur-md shadow-lg border border-white/30"
            >
              <ChevronRight size={24} className="text-black" />
            </button>
          </div>
          {validHabits.length > 0 && <AIInsightsSection />}

        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-400 border-t-transparent mx-auto shadow-xl"></div>
          <p className="mt-6 text-black font-bold text-lg">Loading your habits...</p>
        </div>
      ) : (
        <div className="p-6">
          {!isCurrentWeek(currentWeek) && (
            <div className="mb-6">
              <button
                onClick={() => setCurrentWeek(new Date())}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-black py-4 rounded-2xl font-black hover:shadow-2xl transition-all active:scale-95 shadow-xl text-lg border-2 border-white/20"
              >
                Jump to Current Week
              </button>
            </div>
          )}

          {/* Duplicate Habits Warning */}
          {duplicateGroups.length > 0 && (
            <div className="mb-8">
              <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-xl rounded-3xl border-2 border-red-400/50 shadow-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle size={28} className="text-red-400" />
                  <div>
                    <h2 className="text-xl font-black text-red-400">Duplicate Habits Detected</h2>
                    <p className="text-sm text-red-300 font-semibold">Multiple instances of the same habit found</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {duplicateGroups.map((group, index) => (
                    <div key={index} className="bg-black/20 rounded-2xl p-4 border border-red-400/30">
                      <h3 className="font-bold text-red-300 mb-2">"{group[0].name}" ({group.length} instances)</h3>
                      <div className="flex flex-wrap gap-2">
                        {group.map((habit, idx) => (
                          <button
                            key={habit.id}
                            onClick={() => deletePredefinedHabit(habit)}
                            className="bg-red-500/30 hover:bg-red-500/50 text-red-200 px-3 py-1 rounded-lg transition-all text-sm font-semibold flex items-center gap-2 border border-red-400/50"
                          >
                            <span>#{idx + 1}</span>
                            <Trash2 size={12} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Show Add Habits button when no scoring habits exist */}
          {scoringHabits.length === 0 && onNavigateToAddHabits && (
            <div className="mb-8">
              <div className="text-center py-16 bg-gradient-to-br from-indigo-900/30 to-purple-900/30 backdrop-blur-xl rounded-3xl border-2 border-white/20 shadow-2xl">
                <div className="text-7xl mb-6">🎯</div>
                <h2 className="text-3xl font-black text-black mb-4 drop-shadow-lg">
                  Ready to Start Scoring?
                </h2>
                <p className="text-lg text-black/80 mb-8 max-w-md mx-auto font-semibold">
                  Add predefined habits that earn you points and help you compete on the leaderboard!
                </p>
                <button
                  onClick={onNavigateToAddHabits}
                  className="bg-gradient-to-r from-emerald-500 to-green-600 text-black px-10 py-5 rounded-2xl font-black hover:shadow-2xl transition-all active:scale-95 text-lg shadow-xl border-2 border-white/20 hover:from-emerald-400 hover:to-green-500 transform hover:scale-105"
                >
                  <Target size={24} className="inline mr-3" />
                  Add Scoring Habits
                </button>
              </div>
            </div>
          )}
          
         {viewMode === 'capsules' ? (
            <>
              {scoringHabits.length > 0 && (
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-6 px-2">
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-cyan-400 to-blue-500 p-3 rounded-2xl shadow-2xl border-2 border-white/30">
                        <Target size={26} className="text-black" />
                      </div>
                      <div>
                        <h2 className="font-black text-black text-2xl drop-shadow-lg">Scoring Habits</h2>
                        <p className="text-sm text-black/80 font-semibold">These habits earn you points</p>
                      </div>
                    </div>
                    
                    {/* Table view toggle moved to right */}
                    <button
                      onClick={() => setViewMode(viewMode === 'capsules' ? 'table' : 'capsules')}
                      className="bg-white/10 backdrop-blur-md text-black px-4 py-3 rounded-2xl font-bold hover:bg-white/20 transition-all active:scale-95 flex items-center gap-2 border-2 border-white/20 shadow-lg"
                    >
                      {viewMode === 'capsules' ? <Table size={20} /> : <LayoutGrid size={20} />}
                      <span className="hidden sm:inline text-sm">{viewMode === 'capsules' ? 'Table' : 'Cards'}</span>
                    </button>
                  </div>
                  <div className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
                    {scoringHabits.map(habit => {
                      const duplicateGroup = duplicateGroups.find(group => 
                        group.some(h => h.id === habit.id)
                      );
                      const isDuplicate = duplicateGroup && duplicateGroup.length > 1;
                      
                      return (
                        <HabitCard 
                          key={habit.id} 
                          habit={habit} 
                          isCustom={false} 
                          isDuplicate={isDuplicate}
                        />
                      );
                    })}
                  </div>
                  
                  <div className="mt-8">
                    <button
                      onClick={() => setIsCustomHabitsModalOpen(true)}
                      className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-black py-5 rounded-2xl font-black hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 text-lg shadow-xl border-2 border-white/20"
                    >
                      <Plus size={28} strokeWidth={3} />
                      Add Custom Habit
                    </button>
                  </div>
                </div>
              )}

              {customHabits.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6 px-2">
                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-3 rounded-2xl shadow-2xl border-2 border-white/30">
                      <Star size={26} className="text-black" />
                    </div>
                    <div>
                      <h2 className="font-black text-black text-2xl drop-shadow-lg">Custom Habits</h2>
                      <p className="text-sm text-black/80 font-semibold">Your personal tracking goals</p>
                    </div>
                  </div>
                  <div className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
                    {customHabits.map(habit => (
                      <HabitCard key={habit.id} habit={habit} isCustom={true} isDuplicate={false} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border-2 border-white/20">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/10 border-b-2 border-white/20">
                    <tr>
                      <th className="p-5 text-left font-black text-black min-w-[200px]">Habit</th>
                      {weekDates.map((date, index) => (
                        <th key={index} className="p-5 text-center min-w-[80px]">
                          <div className="text-sm font-black text-black">{CUSTOM_WEEK_DAYS[index].short}</div>
                          <div className={`text-xs mt-1 font-bold ${isToday(date) ? 'text-cyan-300' : 'text-black/70'}`}>
                            {date.getDate()}
                          </div>
                        </th>
                      ))}
                      <th className="p-5 text-center bg-white/10 min-w-[100px]">
                        <div className="text-sm font-black text-black">Total</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {validHabits.map((habit, idx) => {
                      const progress = getHabitWeekProgress(habit);
                      const weeklyTotal = habit.type === 'number' 
                        ? weekDates.reduce((sum, date) => sum + (habitValues[`${habit.id}-${formatDateString(date)}`] || 0), 0)
                        : progress;

                      const duplicateGroup = duplicateGroups.find(group => 
                        group.some(h => h.id === habit.id)
                      );
                      const isDuplicate = duplicateGroup && duplicateGroup.length > 1;

                      return (
                        <tr key={habit.id} className={`border-b border-black/10 ${idx % 2 === 0 ? 'bg-white/5' : 'bg-transparent'} hover:bg-white/10 transition-colors ${
                          isDuplicate ? 'bg-red-500/10' : ''
                        }`}>
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">{habit.icon}</span>
                              <div className="flex-1">
                                <div className={`font-bold ${isDuplicate ? 'text-red-400' : 'text-black'} flex items-center gap-2`}>
                                  {habit.name}
                                  {isDuplicate && (
                                    <div className="flex items-center gap-1">
                                      <AlertTriangle size={16} className="text-red-400" />
                                      <button
                                        onClick={() => deletePredefinedHabit(habit)}
                                        className="bg-red-500 hover:bg-red-600 text-black p-1 rounded text-xs transition-all"
                                        title="Delete duplicate"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {habit.type === 'number' && (
                                  <div className="text-xs text-black/70 font-semibold">Target: {habit.target} {habit.unit}</div>
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
                              <td key={index} className="p-5 text-center">
                                {habit.type === 'number' ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    value={value}
                                    onChange={(e) => updateHabitValue(habit, date, e.target.value)}
                                    className={`w-16 text-center text-sm font-bold border-2 rounded-xl focus:outline-none focus:ring-2 transition-all p-2 ${
                                      isTodayDate ? 'border-cyan-400 bg-cyan-50 focus:ring-cyan-400' : 'border-white/30 bg-white/10 text-black focus:ring-white/50'
                                    }`}
                                  />
                                ) : (
                                  <button
                                    onClick={() => toggleHabitCompletion(habit, date)}
                                    className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all mx-auto font-bold text-lg ${
                                      isCompleted
                                        ? 'bg-green-500 border-green-400 text-black shadow-lg'
                                        : isTodayDate
                                        ? 'border-cyan-400 bg-cyan-400/20 hover:bg-cyan-400/30 text-black'
                                        : 'border-white/30 bg-white/10 hover:bg-white/20 text-black/50'
                                    }`}
                                  >
                                    {isCompleted && '✓'}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-5 text-center bg-white/10 font-black text-black text-lg">
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
            <div className="text-center py-20 bg-white/5 backdrop-blur-md rounded-3xl border-2 border-white/20">
              <div className="text-7xl mb-6">🎯</div>
              <p className="text-black font-black mb-8 text-2xl">No habits yet</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {onNavigateToAddHabits && (
                  <button
                    onClick={onNavigateToAddHabits}
                    className="bg-gradient-to-r from-emerald-500 to-green-600 text-black px-10 py-5 rounded-2xl font-black hover:shadow-2xl transition-all active:scale-95 text-lg shadow-xl border-2 border-white/20"
                  >
                    <Target size={24} className="inline mr-3" />
                    Add Scoring Habits
                  </button>
                )}
                <button 
                  onClick={() => setIsCustomHabitsModalOpen(true)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-black px-10 py-5 rounded-2xl font-black hover:shadow-2xl transition-all active:scale-95 text-lg shadow-xl border-2 border-white/20"
                >
                  Create Your First Habit
                </button>
              </div>
            </div>
          )}

          {validHabits.length > 0 && (
            <div className="mt-10 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 backdrop-blur-xl border-2 border-white/20 rounded-3xl p-8 shadow-2xl">
              <h3 className="font-black text-black mb-6 text-2xl flex items-center gap-3">
                <Award size={28} />
                Week Summary & Insights
              </h3>
              
              {scoringHabits.length > 0 && (
                <>
                  <h4 className="font-black text-cyan-300 mb-4 text-lg flex items-center gap-2">
                    <Target size={22} />
                    Scoring Habits Performance:
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
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
                        <div key={habit.id} className="bg-white/10 backdrop-blur-md rounded-2xl p-5 text-center shadow-xl border-2 border-white/20 hover:border-white/40 transition-all transform hover:scale-105">
                          <div className="text-4xl mb-3">{habit.icon}</div>
                          <div className="text-sm font-bold text-black/90 mb-2">{habit.name}</div>
                          <div className={`text-3xl font-black mb-2 ${
                            completionPercentage >= 80 ? 'text-green-400' : 
                            completionPercentage >= 50 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {weeklyTotal} {habit.type === 'number' ? 'pts' : 'days'}
                          </div>
                          <div className="text-xs text-black/70 font-bold">
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
                    <div className="mb-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-black rounded-2xl p-6 shadow-2xl border-2 border-white/30">
                      <h4 className="font-black text-black mb-4 text-xl flex items-center gap-2">
                        <Award size={24} />
                        Leadership Promotion Goal
                      </h4>
                      <div className="grid grid-cols-2 gap-8 mb-5">
                        <div className="text-center">
                          <div className="text-5xl font-black">{goalProgress.total}</div>
                          <div className="text-sm opacity-90 font-bold mt-1">Completed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-5xl font-black text-yellow-300">{goalProgress.remaining}</div>
                          <div className="text-sm opacity-90 font-bold mt-1">Remaining</div>
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2 font-bold">
                          <span>Progress</span>
                          <span>{Math.round(goalProgress.progress)}%</span>
                        </div>
                        <div className="w-full bg-white/25 rounded-full h-4 backdrop-blur-sm shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-yellow-300 to-orange-400 h-4 rounded-full transition-all shadow-xl"
                            style={{ width: `${goalProgress.progress}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-sm opacity-95 text-center font-bold">
                        {goalProgress.daysRemaining} days remaining until December 1st
                      </div>
                      {goalProgress.remaining > 0 && goalProgress.daysRemaining > 0 && (
                        <div className="text-sm text-center mt-4 bg-white/20 rounded-xl px-5 py-3 font-black backdrop-blur-sm">
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
                  <h4 className="font-black text-amber-300 mb-4 text-lg flex items-center gap-2">
                    <Star size={22} />
                    Custom Habits Performance:
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
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
                        <div key={habit.id} className="bg-white/5 backdrop-blur-md rounded-2xl p-5 text-center shadow-lg border-2 border-white/10 transform hover:scale-105 transition-all">
                          <div className="text-4xl mb-3 opacity-90">{habit.icon}</div>
                          <div className="text-sm font-bold text-black/80 mb-2">{habit.name}</div>
                          <div className="text-3xl font-black text-black mb-2">
                            {weeklyTotal} {habit.type === 'number' ? habit.unit : 'days'}
                          </div>
                          <div className="text-xs text-black/60 font-bold">
                            {completionPercentage}% on track
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              
              <div className="bg-black/10 backdrop-blur-md rounded-2xl p-6 border-2 border-cyan-400/40 shadow-xl">
                <h4 className="font-black text-cyan-300 mb-4 text-lg flex items-center gap-2">
                  <Zap size={22} />
                  How Scoring Works:
                </h4>
                <div className="text-sm text-black space-y-3 font-semibold">
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400 text-xl">•</span>
                    <span><strong className="text-cyan-300">Scoring Habits:</strong> Contribute to your daily and weekly point totals</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-amber-400 text-xl">•</span>
                    <span><strong className="text-amber-300">Custom Habits:</strong> Personal tracking only (no points awarded)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-green-400 text-xl">•</span>
                    <span><strong className="text-green-300">Checkmarks:</strong> Earn 1 point per completion</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-purple-400 text-xl">•</span>
                    <span><strong className="text-purple-300">Numbers:</strong> Points equal the number entered (appointments, contacts, etc.)</span>
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
            height: 12px;
          }
          .scrollbar-hide::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
          }
          .scrollbar-hide::-webkit-scrollbar-thumb {
            background: rgba(139, 92, 246, 0.6);
            border-radius: 10px;
          }
          .scrollbar-hide::-webkit-scrollbar-thumb:hover {
            background: rgba(139, 92, 246, 0.9);
          }
          .scrollbar-hide {
            -ms-overflow-style: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(139, 92, 246, 0.6) rgba(255, 255, 255, 0.1);
          }
        }
      `}</style>
    </div>
  );
};

export default WeeklyHabitTracker;