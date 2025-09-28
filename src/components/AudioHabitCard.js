import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  collection, 
  doc, 
  updateDoc, 
  arrayUnion, 
  increment, 
  getDoc, 
  addDoc, 
  query, 
  where, 
  limit,  Timestamp,
  getDocs,setDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { CheckCircle, Headphones, RotateCcw, Plus } from 'lucide-react';
import '../styles/audioHabitCard.css';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import ErrorBoundary from './ErrorBoundary';

// Add this component to your file
const WeeklyFeaturedAudios = () => {
  const [user] = useAuthState(auth);
  const [weeklyAudios, setWeeklyAudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekId, setCurrentWeekId] = useState('');
  const [userCompletions, setUserCompletions] = useState({});
  const [isAdmin, setIsAdmin] = useState(false); // For admin functionality

  // Function to get current week ID (YYYY-WW format)
  const getCurrentWeekId = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 604800000; // milliseconds in a week
    const week = Math.ceil(diff / oneWeek);
    return `${now.getFullYear()}-${week.toString().padStart(2, '0')}`;
  };

  // Fetch this week's featured audios
  const fetchWeeklyAudios = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const weekId = getCurrentWeekId();
      setCurrentWeekId(weekId);
      
      // Get the current week's audios
      const weeklyRef = collection(db, 'weeklyAudios');
      const weeklyQuery = query(weeklyRef, where('weekId', '==', weekId), limit(1));
      const weeklySnapshot = await getDocs(weeklyQuery);
      
      if (!weeklySnapshot.empty) {
        const weeklyData = weeklySnapshot.docs[0].data();
        setWeeklyAudios(weeklyData.audios || []);
      } else {
        console.log('No featured audios for this week');
        setWeeklyAudios([]);
        
        // For admin only: If no audios for this week and user is admin, could auto-generate
        if (isAdmin) {
          // Populate with fallback audios or auto-select from a pool
        }
      }
      
      // Fetch user's completions for this week's audios
      if (user) {
        const completionsRef = collection(db, 'weeklyAudioCompletions');
        const completionsQuery = query(
          completionsRef,
          where('userId', '==', user.uid),
          where('weekId', '==', weekId)
        );
        
        const completionsSnapshot = await getDocs(completionsQuery);
        const completions = {};
        
        if (!completionsSnapshot.empty) {
          const completionsDoc = completionsSnapshot.docs[0].data();
          completionsDoc.audios?.forEach(audio => {
            completions[audio.audioUrl] = true;
          });
        }
        
        setUserCompletions(completions);
      }
    } catch (error) {
      console.error('Error fetching weekly audios:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;
      
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setIsAdmin(userDoc.data().isAdmin === true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    checkAdminStatus();
  }, [user]);

  // Load weekly audios on component mount
  useEffect(() => {
    if (user) {
      fetchWeeklyAudios();
    }
  }, [user, fetchWeeklyAudios]);

  // Mark an audio as completed
  const markAudioCompleted = async (audioUrl, title) => {
    if (!user || userCompletions[audioUrl]) return;
    
    try {
      const completionsRef = collection(db, 'weeklyAudioCompletions');
      const completionsQuery = query(
        completionsRef,
        where('userId', '==', user.uid),
        where('weekId', '==', currentWeekId)
      );
      
      const completionsSnapshot = await getDocs(completionsQuery);
      const now = new Date();
      const audioData = {
        audioUrl,
        title,
        completedAt: Timestamp.fromDate(now)
      };
      
      if (completionsSnapshot.empty) {
        // Create new document
        await addDoc(completionsRef, {
          userId: user.uid,
          weekId: currentWeekId,
          audios: [audioData],
          createdAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now)
        });
      } else {
        // Update existing document
        const docRef = completionsSnapshot.docs[0].ref;
        await updateDoc(docRef, {
          audios: arrayUnion(audioData),
          updatedAt: Timestamp.fromDate(now)
        });
      }
      
      // Update local state
      setUserCompletions(prev => ({
        ...prev,
        [audioUrl]: true
      }));
      
      // Update user stats
      const userStatsRef = doc(db, 'userStats', user.uid);
      const statsDoc = await getDoc(userStatsRef);
      if (statsDoc.exists()) {
        await updateDoc(userStatsRef, {
          weeklyAudiosCompleted: increment(1),
          lastWeeklyAudioDate: now.toISOString()
        });
      } else {
        await setDoc(userStatsRef, {
          weeklyAudiosCompleted: 1,
          lastWeeklyAudioDate: now.toISOString()
        });
      }
    } catch (error) {
      console.error('Error marking audio as completed:', error);
    }
  };

  if (loading) {
    return (
      <div className="weekly-featured-container loading">
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading weekly audios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="weekly-featured-container">
      <div className="weekly-featured-header">
        <h2 className="text-xl font-bold">This Week's Featured Audios</h2>
        <p className="text-sm text-gray-600">Listen to our curated selection for this week</p>
      </div>
      
      {weeklyAudios.length === 0 ? (
        <div className="no-audios-message">
          <p>No featured audios available for this week</p>
        </div>
      ) : (
        <div className="weekly-audios-grid">
          {weeklyAudios.map((audio, index) => (
            <WeeklyAudioItem 
              key={index}
              audio={audio}
              isCompleted={userCompletions[audio.audioUrl]}
              onComplete={() => markAudioCompleted(audio.audioUrl, audio.title)}
            />
          ))}
        </div>
      )}
      
      {isAdmin && (
        <div className="admin-controls mt-6">
          <AdminAudioManager 
            currentWeekId={currentWeekId}
            currentAudios={weeklyAudios}
            onUpdate={fetchWeeklyAudios}
          />
        </div>
      )}
    </div>
  );
};

// WeeklyAudioItem component to display each audio
const WeeklyAudioItem = ({ audio, isCompleted, onComplete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const iframeRef = useRef(null);
  const widgetRef = useRef(null);
  
  useEffect(() => {
    // Initialize SoundCloud widget
    if (!iframeRef.current) return;
    
    const initWidget = () => {
      if (window.SC && window.SC.Widget) {
        widgetRef.current = window.SC.Widget(iframeRef.current);
        bindWidgetEvents();
      } else {
        const script = document.createElement('script');
        script.src = 'https://w.soundcloud.com/player/api.js';
        script.onload = () => {
          widgetRef.current = window.SC.Widget(iframeRef.current);
          bindWidgetEvents();
        };
        document.body.appendChild(script);
      }
    };
    
    initWidget();
  }, []);
  
  const bindWidgetEvents = () => {
    if (!widgetRef.current) return;
    
    widgetRef.current.bind(window.SC.Widget.Events.PLAY, () => {
      setIsPlaying(true);
    });
    
    widgetRef.current.bind(window.SC.Widget.Events.PAUSE, () => {
      setIsPlaying(false);
    });
    
    widgetRef.current.bind(window.SC.Widget.Events.PLAY_PROGRESS, (data) => {
      const percentage = Math.round(data.relativePosition * 100);
      setProgress(percentage);
      
      // Mark as completed when user listens to 80%
      if (percentage >= 80 && !isCompleted) {
        onComplete();
      }
    });
  };
  
  return (
    <div className={`weekly-audio-item ${isCompleted ? 'completed' : ''}`}>
      <div className="audio-item-header">
        <h3 className="audio-title">{audio.title}</h3>
        {isCompleted && (
          <div className="completed-badge">
            <CheckCircle size={16} />
            <span>Completed</span>
          </div>
        )}
      </div>
      
      <div className="audio-description">
        <p>{audio.description}</p>
      </div>
      
      <div className="audio-player">
        <iframe
          ref={iframeRef}
          width="100%"
          height="100"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(audio.audioUrl)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`}
        ></iframe>
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

// Admin component to manage weekly audios
const AdminAudioManager = ({ currentWeekId, currentAudios, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [audioInputs, setAudioInputs] = useState({
    title: '',
    description: '',
    audioUrl: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // For auto-selection, you could use a curated playlist of SoundCloud URLs
  const audioPool = [
    // You could have many URLs here that the system can select from
    'https://soundcloud.com/manoj-m-286517998/bill-britt-6-6-8-6-6?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/29-bww-3047-kumar-shivaram-anjali-founders-triple-diamond-address-1?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/31-bww-3064-ramesh-rama-the-battle-for-your-mind-3?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/28-bww-2806-ajmani-sugeet-kaajal-programming-your-mind-for-success-gaashaan-ali-maka-things-that-matter-4?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/29-bww-3047-kumar-shivaram-anjali-founders-triple-diamond-address-1?in=manoj-m-286517998/sets/70f0d2b4-e017-452c-ab07-0e56c77721ce&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/30-bww-3050-ajmani-sugeet-things-done-right-gaashaan-ali-the-next-90-days-2?in=manoj-m-286517998/sets/70f0d2b4-e017-452c-ab07-0e56c77721ce&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/31-bww-3064-ramesh-rama-the-battle-for-your-mind-3?in=manoj-m-286517998/sets/70f0d2b4-e017-452c-ab07-0e56c77721ce&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/28-bww-2806-ajmani-sugeet-kaajal-programming-your-mind-for-success-gaashaan-ali-maka-things-that-matter-4?in=manoj-m-286517998/sets/70f0d2b4-e017-452c-ab07-0e56c77721ce&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/26-bww-2594-ajmani-sugeet-gaashaan-ali-kumar-saji-reflections-1?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/27-bww-2754-ajmani-sugeet-kaajal-new-double-diamonds-gaashaan-ali-maka-new-founders-executive-diamonds-2?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/26-bww-2594-ajmani-sugeet-gaashaan-ali-kumar-saji-reflections-1?in=manoj-m-286517998/sets/sugeet-ali&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/27-bww-2754-ajmani-sugeet-kaajal-new-double-diamonds-gaashaan-ali-maka-new-founders-executive-diamonds-2?in=manoj-m-286517998/sets/sugeet-ali&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/25-bww-2223-gaashaan-ali-maka?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/23-bww-1999-ali-maka-new?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/15-put-work-behind-your-dreams?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/14-the-gift-of-mentorship-tony?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/13-new-diamonds-craig-and?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/6-vinny-pappalardo-mentorship?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/11-all-in-vinny-and-dayna?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/10-the-why-bill-britt?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/5-charlie-durso-book-it?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/7-distractions-and-hidden?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/8-building-a-team-vs-building?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/4-charlie-ann-durso-flush-the?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/3-bww2447-jyotiprakash-rashmi?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/2-bww738-get-engaged-in-the?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/12-never-stop-learning-the?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/9-from-new-ibo-to-core-ibo?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing'

    // ... many more tracks
  ];

  // Get random audios from the pool
  const getRandomAudios = (count = 5) => {
    const shuffled = [...audioPool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(url => ({
      title: `Auto-selected Audio ${Math.floor(Math.random() * 1000)}`,
      description: 'This audio was automatically selected from our curated pool',
      audioUrl: url
    }));
  };
  
  // Save new weekly audios
  const saveWeeklyAudios = async (audios) => {
    setIsSaving(true);
    try {
      const weeklyRef = collection(db, 'weeklyAudios');
      const weeklyQuery = query(weeklyRef, where('weekId', '==', currentWeekId), limit(1));
      const weeklySnapshot = await getDocs(weeklyQuery);
      
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start from Sunday
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // End on Saturday
      
      if (weeklySnapshot.empty) {
        // Create new document for this week
        await addDoc(weeklyRef, {
          weekId: currentWeekId,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          audios,
          createdAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now)
        });
      } else {
        // Update existing document
        const docRef = weeklySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          audios,
          updatedAt: Timestamp.fromDate(now)
        });
      }
      
      onUpdate();
      alert('Weekly audios updated successfully!');
    } catch (error) {
      console.error('Error saving weekly audios:', error);
      alert('Error saving weekly audios');
    } finally {
      setIsSaving(false);
      setIsAdding(false);
    }
  };
  
  // Handle adding a manual audio
  const handleAddAudio = () => {
    if (!audioInputs.title || !audioInputs.audioUrl) {
      alert('Title and URL are required');
      return;
    }
    
    const updatedAudios = [
      ...currentAudios,
      { ...audioInputs }
    ];
    
    saveWeeklyAudios(updatedAudios);
    setAudioInputs({ title: '', description: '', audioUrl: '' });
  };
  
// Update handleAutoGenerate function in AdminAudioManager:
const handleAutoGenerate = async () => {
  try {
    console.log('Starting auto-generation...');
    const randomAudios = getRandomAudios(5);
    console.log('Random audios selected:', randomAudios);
    await saveWeeklyAudios(randomAudios);
    console.log('Auto-generation completed successfully');
  } catch (error) {
    console.error('Error during auto-generation:', error);
    alert('Failed to auto-generate audios: ' + error.message);
  }
};
  
  return (
    <div className="admin-audio-manager">
      <h3 className="text-lg font-semibold mb-4">Manage Weekly Audios</h3>
      
      <div className="action-buttons mb-4">
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mr-3"
        >
          {isAdding ? 'Cancel' : 'Add Audio'}
        </button>
        
        <button 
          onClick={handleAutoGenerate}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          disabled={isSaving}
        >
          {isSaving ? 'Generating...' : 'Auto-Generate 5 Audios'}
        </button>
      </div>
      
      {isAdding && (
        <div className="add-audio-form bg-gray-50 p-4 rounded-lg mb-4">
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input 
              type="text"
              value={audioInputs.title}
              onChange={e => setAudioInputs({...audioInputs, title: e.target.value})}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea 
              value={audioInputs.description}
              onChange={e => setAudioInputs({...audioInputs, description: e.target.value})}
              className="w-full p-2 border rounded"
              rows={2}
            />
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">SoundCloud URL</label>
            <input 
              type="url"
              value={audioInputs.audioUrl}
              onChange={e => setAudioInputs({...audioInputs, audioUrl: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="https://soundcloud.com/..."
            />
          </div>
          
          <button 
            onClick={handleAddAudio}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Add to Weekly Selection'}
          </button>
        </div>
      )}
      
      <div className="current-audios">
        <h4 className="text-md font-medium mb-2">Current Week's Audios ({currentAudios.length}/5)</h4>
        {currentAudios.map((audio, index) => (
          <div key={index} className="audio-item p-2 border-b">
            <div className="flex justify-between">
              <div>
                <div className="font-medium">{audio.title}</div>
                <div className="text-sm text-gray-600">{audio.description}</div>
              </div>
              <button 
                onClick={() => {
                  const updatedAudios = [...currentAudios];
                  updatedAudios.splice(index, 1);
                  saveWeeklyAudios(updatedAudios);
                }}
                className="text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
// Debounce utility
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const AudioHabitCard = ({ user: propUser }) => {
  const [user, loading, error] = useAuthState(auth);
  const [audioHabits, setAudioHabits] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitUrl, setNewHabitUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const addNewAudioHabit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const habitData = {
        userId: user.uid,
        title: newHabitTitle,
        audioUrl: newHabitUrl,
        type: 'audio',
        requiredListeningPercentage: 80,
        createdAt: new Date().toISOString(),
        completions: [],
        totalCompletions: 0,
        currentStreak: 0,
        lastCompletedDate: null,
        stats: {
          audioSessions: 0,
          totalListeningTime: 0,
          completionHistory: []
        }
      };

      await addDoc(collection(db, 'habits'), habitData);
      
      setNewHabitTitle('');
      setNewHabitUrl('');
      setShowAddForm(false);
      fetchAudioHabits();
    } catch (error) {
      console.error('Error adding audio habit:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAudioHabits = useCallback(async () => {
    if (!user) return;

    try {
      const habitsRef = collection(db, 'habits');
      const q = query(habitsRef, 
        where('userId', '==', user.uid),
        where('type', '==', 'audio')
      );
      const querySnapshot = await getDocs(q);
      
      const habits = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setAudioHabits(habits);
    } catch (error) {
      console.error('Error fetching audio habits:', error);
    }
  }, [user]);
    
  useEffect(() => {
    if (error) {
      console.error('Authentication error:', error);
    }
    if (!user && !loading) {
      console.log('User not authenticated');
    }
  }, [user, loading, error]);


  useEffect(() => {
    if (user) {
      fetchAudioHabits();
    }
  }, [user, fetchAudioHabits]);


  return (
    <div className="audio-habits-container">
      <div className="mb-6 flex justify-between items-center">
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add New Audio Habit
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <form onSubmit={addNewAudioHabit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Habit Title
              </label>
              <input
                type="text"
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                SoundCloud URL
              </label>
              <input
                type="url"
                value={newHabitUrl}
                onChange={(e) => setNewHabitUrl(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="https://soundcloud.com/..."
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                {isLoading ? 'Adding...' : 'Add Habit'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {audioHabits.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Headphones size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            No Audio Habits Yet
          </h3>
          <p className="text-gray-600 mb-4">
            Add your first audio habit to get started!
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Audio Habit
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {audioHabits.map(habit => (
            <AudioHabitItem 
              key={habit.id}
              habit={habit}
              userId={user.uid}
              onComplete={fetchAudioHabits}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AudioHabitItem = ({ habit, userId, onComplete }) => {
  const [user, loading, error] = useAuthState(auth);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasCompletedToday, setHasCompletedToday] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [completionHistory, setCompletionHistory] = useState([]);
  const [encryptedMediaError, setEncryptedMediaError] = useState(false);

  const widgetRef = useRef(null);
  const sessionRef = useRef(null);
  const iframeRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const progressRef = useRef({
    percentage: 0,
    duration: 0,
    needsUpdate: false
  });

  // Move hooks before any conditional returns
  const updateProgressInDB = useCallback(async () => {
    if (!user) return;

    const now = Date.now();
    if (now - lastUpdateRef.current < 30000) return;
    if (!progressRef.current.needsUpdate) return;

    try {
      const habitRef = doc(db, 'habits', habit.id);
      await updateDoc(habitRef, {
        'stats.totalListeningTime': increment(progressRef.current.duration),
        lastUpdated: new Date().toISOString()
      });
    console.log('✅ Progress updated successfully');
      progressRef.current.needsUpdate = false;
      lastUpdateRef.current = now;
    } catch (error) {
      console.error('Error updating progress:', error);
      if (error.code === 'permission-denied') {
        console.log('Authentication required');
      }
    }
  }, [habit.id, user]);

  const debouncedProgressUpdate = useRef(
    debounce(async () => {
      if (progressRef.current.needsUpdate) {
        await updateProgressInDB();
      }
    }, 30000)
  ).current;

  const checkTodayCompletion = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `habit_${habit.id}_${today}`;
    
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setHasCompletedToday(JSON.parse(cached));
      return;
    }

    const habitDoc = await getDoc(doc(db, 'habits', habit.id));
    if (habitDoc.exists()) {
      const data = habitDoc.data();
      const completions = data.completions || [];
      const completed = completions.includes(today);
      setHasCompletedToday(completed);
      localStorage.setItem(cacheKey, JSON.stringify(completed));
    }
  }, [habit.id]);

  const loadCompletionHistory = useCallback(async () => {
    if (!user) return;

    try {
      const sessionsRef = collection(db, 'audioSessions');
      const q = query(
        sessionsRef,
        where('habitId', '==', habit.id),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const sessionDoc = snapshot.docs[0].data();
        const completions = sessionDoc.completions || {};
        
        const history = Object.entries(completions)
          .map(([date, record]) => ({
            id: date,
            ...record
          }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 10);
        
        setCompletionHistory(history);
      } else {
        setCompletionHistory([]);
      }
    } catch (error) {
      console.error('Error loading completion history:', error);
      if (error.code === 'permission-denied') {
        console.log('Authentication required');
      }
    }
  }, [habit.id, userId, user]);

  // Add this function at component level to check for existing sessions
 const checkExistingSession = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const sessionsRef = collection(db, 'audioSessions');
      const q = query(
        sessionsRef,
        where('habitId', '==', habit.id),
        where('userId', '==', userId),
        where('createdAt', '>=', `${today}T00:00:00.000Z`),
        where('createdAt', '<=', `${today}T23:59:59.999Z`)
      );

      const snapshot = await getDocs(q);
      return snapshot.empty ? null : {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
    } catch (error) {
      console.error('Error checking existing session:', error);
      return null;
    }
  }, [habit.id, userId]); // Dependencies: recalculate when these change

  const markHabitComplete = useCallback(async (duration, percentageCompleted) => {
    const habitRef = doc(db, 'habits', habit.id);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    try {
      const habitDoc = await getDoc(habitRef);
      const currentData = habitDoc.data();
      const lastCompletedDate = currentData.lastCompletedDate;
      
      let newStreak = currentData.currentStreak || 0;
      if (lastCompletedDate) {
        const lastDate = new Date(lastCompletedDate);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastDate.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
          newStreak += 1;
        } else if (lastDate.toISOString().split('T')[0] !== today) {
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }

      const completionRecord = {
        date: today,
        timestamp: now.toISOString(),
        duration,
        percentageCompleted,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      };
      console.log('📊 Checking for existing audioSession...');

      // Check if audioSession exists
      const sessionsRef = collection(db, 'audioSessions');
      const q = query(
        sessionsRef,
        where('habitId', '==', habit.id),
        where('userId', '==', userId)
      );
      
      const sessionSnapshot = await getDocs(q);
      
       console.log('💾 Updating habit data...', {
        newStreak,
        totalCompletions: currentData.totalCompletions + 1
      });

      // Update everything at once
      await updateDoc(habitRef, {
        completions: arrayUnion(today),
        lastCompletedDate: today,
        totalCompletions: increment(1),
        currentStreak: newStreak,
        'stats.audioSessions': increment(1),
        'stats.totalListeningTime': increment(duration),
        'stats.completionHistory': arrayUnion(completionRecord),
        lastUpdated: now.toISOString()
      });

      if (sessionSnapshot.empty) {
        console.log('📝 Creating new audioSession record');    
        await addDoc(sessionsRef, {
          habitId: habit.id,
          userId,
          habitTitle: habit.title,
          firstCompletion: completionRecord,
          lastCompletion: completionRecord,
          totalCompletions: 1,
          totalDuration: duration,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          completions: { [today]: completionRecord }
        });
      } else {
        console.log('📝 Updating existing audioSession record');
        const sessionDoc = sessionSnapshot.docs[0];
        await updateDoc(doc(sessionsRef, sessionDoc.id), {
          lastCompletion: completionRecord,
          totalCompletions: increment(1),
          totalDuration: increment(duration),
          updatedAt: now.toISOString(),
          [`completions.${today}`]: completionRecord
        });
      }
      console.log('✅ Habit completion saved successfully');
      progressRef.current.needsUpdate = false;
      setHasCompletedToday(true);
      if (onComplete) onComplete();

      return true;
    } catch (error) {
      console.error('❌ Error marking habit complete:', error);
      return false;
    }
  }, [habit.id, habit.title, userId, onComplete]);

 const bindWidgetEvents = useCallback(() => {
    if (!widgetRef.current) return;

    widgetRef.current.bind(window.SC.Widget.Events.PLAY, async () => {
      setIsPlaying(true);
      
      if (!sessionStarted && !hasCompletedToday) {
        const existingSession = await checkExistingSession();
        
        if (existingSession && !existingSession.isCompleted) {
          console.log('🔄 Resuming existing session from today:', existingSession.id);
      sessionRef.current = {
        ...existingSession,
        startTime: Date.now(),
        isActive: true,
        status: 'playing',
        sessionId: existingSession.id // Store the existing session ID
      };
    } else if (!existingSession) {
      console.log('🎵 Starting new audio session (no existing session found)');
      sessionRef.current = {
        habitId: habit.id,
        startTime: Date.now(),
        startedAt: new Date().toISOString(),
        pauseCount: 0,
        isActive: true,
        lastPlayPosition: 0,
        actualPlayTime: 0
      };
    } else {
      console.log('⏭️ Found completed session for today, skipping session tracking');
    }
    setSessionStarted(true);
  }
});

// Update the PAUSE handler
widgetRef.current.bind(window.SC.Widget.Events.PAUSE, async () => {
  setIsPlaying(false);
  if (sessionRef.current) {
    sessionRef.current.pauseCount++;
    if (progressRef.current.duration > 30) {
      console.log('⏸️ Paused at position:', progressRef.current.duration);
      
      if (!hasCompletedToday) {
        const currentTime = Date.now();
        const sessionDuration = Math.round((currentTime - sessionRef.current.startTime) / 1000);
        
        sessionRef.current.actualPlayTime += 
          progressRef.current.duration - (sessionRef.current.lastPlayPosition || 0);
        sessionRef.current.lastPlayPosition = progressRef.current.duration;

        try {
          await updateProgressInDB();

          const sessionsRef = collection(db, 'audioSessions');
          const sessionData = {
            lastPlayPosition: progressRef.current.duration,
            actualPlayTime: sessionRef.current.actualPlayTime,
            totalDuration: sessionDuration,
            pauseCount: sessionRef.current.pauseCount,
            status: 'paused',
            updatedAt: new Date().toISOString()
          };

          if (sessionRef.current.sessionId) {
            // Update existing session
            console.log('📝 Updating existing session:', sessionRef.current.sessionId);
            await updateDoc(doc(sessionsRef, sessionRef.current.sessionId), sessionData);
          } else {
            // Create new session only if one doesn't exist
            const existingSession = await checkExistingSession();
            
            if (!existingSession) {
              console.log('📝 Creating new session record');
              const newSessionRef = await addDoc(sessionsRef, {
                habitId: habit.id,
                userId,
                habitTitle: habit.title,
                createdAt: sessionRef.current.startedAt,
                startedAt: sessionRef.current.startedAt,
                isCompleted: false,
                ...sessionData
              });
              sessionRef.current.sessionId = newSessionRef.id;
            } else {
              console.log('📝 Using existing session:', existingSession.id);
              sessionRef.current.sessionId = existingSession.id;
              await updateDoc(doc(sessionsRef, existingSession.id), sessionData);
            }
          }
        } catch (error) {
          console.error('❌ Error saving session on pause:', error);
        }
      } else {
        console.log('⏭️ Skipping session save - audio already completed today');
      }

      debouncedProgressUpdate();
    }
  }
});

    widgetRef.current.bind(window.SC.Widget.Events.PLAY_PROGRESS, (data) => {
      const percentage = Math.round(data.relativePosition * 100);
      const duration = Math.round(data.currentPosition / 1000);
      
      setProgress(percentage);
      
      progressRef.current = {
        percentage,
        duration,
        needsUpdate: true
      };

      debouncedProgressUpdate();

      if (percentage >= habit.requiredListeningPercentage && !hasCompletedToday) {
        markHabitComplete(duration, percentage);
      }
    });
  }, [habit.requiredListeningPercentage, hasCompletedToday, markHabitComplete, sessionStarted, debouncedProgressUpdate]);

  const handleReset = useCallback(async () => {
    if (!hasCompletedToday) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
         console.log('🔄 Resetting habit completion for today:', {
        habitId: habit.id,
        date: today
      });
      const habitDoc = await getDoc(doc(db, 'habits', habit.id));
      const data = habitDoc.data();
      const updatedCompletions = (data.completions || []).filter(date => date !== today);
      
      await updateDoc(doc(db, 'habits', habit.id), {
        completions: updatedCompletions,
        totalCompletions: Math.max(0, (data.totalCompletions || 1) - 1)
      });
    console.log('✅ Habit reset successful');

      setHasCompletedToday(false);
      setProgress(0);
    } catch (error) {
      console.error('Error resetting habit:', error);
    }
  }, [habit.id, hasCompletedToday]);
  

  useEffect(() => {
    checkTodayCompletion();
  }, [checkTodayCompletion]);

  useEffect(() => {
    if (user) {
      checkTodayCompletion();
    }
  }, [checkTodayCompletion, user]);

  useEffect(() => {
    if (!iframeRef.current) return;

    const initWidget = () => {
      if (window.SC && window.SC.Widget) {
        widgetRef.current = window.SC.Widget(iframeRef.current);
        bindWidgetEvents();
      } else {
        const script = document.createElement('script');
        script.src = 'https://w.soundcloud.com/player/api.js';
        script.onerror = () => {
          setEncryptedMediaError(true);
        };
        script.onload = () => {
          try {
            widgetRef.current = window.SC.Widget(iframeRef.current);
            bindWidgetEvents();
          } catch (error) {
            console.error('Error initializing SoundCloud widget:', error);
            setEncryptedMediaError(true);
          }
        };
        document.body.appendChild(script);
      }
    };

    initWidget();

     return () => {
    if (sessionRef.current?.isActive) {
      const now = Date.now();
      const totalDuration = Math.max(
        sessionRef.current.actualPlayTime,
        Math.round((now - sessionRef.current.startTime) / 1000)
      );

      // Only save sessions that lasted more than 1 second
      if (totalDuration > 1) {
        const sessionData = {
          ...sessionRef.current,
          endedAt: new Date().toISOString(),
          status: 'interrupted',
          totalDuration,
          actualPlayTime: sessionRef.current.actualPlayTime
        };
        console.log('📝 Session saved on cleanup:', sessionData);

        // Optionally, save significant sessions to the database
        if (totalDuration > 30) {
          try {
            const sessionsRef = collection(db, 'audioSessions');
            addDoc(sessionsRef, {
              ...sessionData,
              userId,
              habitTitle: habit.title,
              createdAt: sessionData.startedAt,
              updatedAt: sessionData.endedAt
            }).then(() => {
              console.log('💾 Long session saved to database');
            });
          } catch (error) {
            console.error('Error saving session:', error);
          }
        }
      } else {
        console.log('⏭️ Skipping short session save:', {
          habitId: habit.id,
          duration: totalDuration
        });
      }
    }
    if (progressRef.current.needsUpdate) {
      console.log('🔄 Final progress update on cleanup');
      updateProgressInDB();
    }
  };
}, [bindWidgetEvents, updateProgressInDB, userId, habit.id, habit.title]);

    // Show loading state while checking authentication
    if (loading) {
        return <div>Loading...</div>;
    }

    // Show error state if authentication failed
    if (error) {
        return <div>Error: {error.message}</div>;
    }

    // Show not authenticated state
    if (!user) {
        return <div>Please sign in to access this feature</div>;
    }
  if (encryptedMediaError) {
    return (
      <div className="audio-habit-card error">
        <div className="p-4 bg-red-50 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800">{habit.title}</h3>
          <p className="text-red-600 mt-2">
            Unable to load audio player. Your browser might not support encrypted media content.
            Try using a different browser or enabling DRM support.
          </p>
          <a 
            href={habit.audioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 mt-2 inline-block"
          >
            Open in SoundCloud
          </a>
        </div>
      </div>
    );
  }

  return (
    <div 
      id={`audio-habit-${habit.id}`}
      className={`audio-habit-card ${hasCompletedToday ? 'completed' : ''}`}
    >
      <div className="habit-header">
        <div className="habit-title-section">
          <Headphones className="habit-icon" />
          <div>
            <h3 className="text-lg font-semibold">{habit.title}</h3>
          </div>
        </div>
        {hasCompletedToday && (
          <div className="completed-badge">
            <CheckCircle className="check-icon" size={16} />
            <span>Completed</span>
          </div>
        )}
      </div>

      <div className="audio-player-container">
       <iframe
            ref={iframeRef}
            id={`sc-widget-${habit.id}`}
            title={habit.title}
            width="100%"
            height="120"
            scrolling="no"
            frameBorder="no"
            allow="autoplay; encrypted-media"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(habit.audioUrl)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`}
            />
      </div>

      <div className="progress-section">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="progress-info">
          <span className="progress-text">{progress}%</span>
          <span className="progress-requirement">
            Goal: {habit.requiredListeningPercentage}%
          </span>
        </div>
      </div>

      <div className="mt-3">
        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory) loadCompletionHistory();
          }}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showHistory ? 'Hide History' : 'Show History'}
        </button>
      </div>

      {showHistory && (
        <div className="mt-4 border-t pt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Completions</h4>
          {completionHistory.length > 0 ? (
            <div className="space-y-2">
              {completionHistory.map(record => (
                <div key={record.id} className="text-sm text-gray-600 flex justify-between items-center">
                  <div>
                    {new Date(record.timestamp).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-4">
                    <span>{record.duration}s</span>
                    <span>{record.percentageCompleted}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No completion history yet</p>
          )}
        </div>
      )}

      {hasCompletedToday && (
        <button 
          className="reset-button mt-3"
          onClick={handleReset}
          title="Reset today's completion"
        >
          <RotateCcw size={16} />
          Reset
        </button>
      )}
    </div>
  );
};
// Remove the old export default AudioHabitCard and replace with this:
// Export both components
export { WeeklyFeaturedAudios };
export default function WrappedAudioHabitCard(props) {
  return (
    <ErrorBoundary>
      <AudioHabitCard {...props} />
    </ErrorBoundary>
  );
}