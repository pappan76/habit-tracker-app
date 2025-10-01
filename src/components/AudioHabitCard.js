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
  getDocs, setDoc, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  CheckCircle, 
  Headphones, 
  RotateCcw, 
  Plus,
  ChevronLeft, // Add these icon imports
  ChevronRight, 
  Clock,
  History
} from 'lucide-react';
import '../styles/audioHabitCard.css';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import ErrorBoundary from './ErrorBoundary';

// Add these styles to the <head> element
const styles = `
  .weekly-audio-item.completed {
    background-color: rgba(16, 185, 129, 0.1); /* Light green background */
    border: 1px solid #10b981; /* Green border */
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2); /* Subtle green shadow */
  }
  
  .weekly-audio-item .progress-fill.completed {
    background: linear-gradient(90deg, #10b981, #059669); /* Green gradient */
  }
  
  .weekly-audio-footer {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280; /* Gray text */
  }
  
  .days-remaining {
    font-weight: 500;
    color: #ef4444; /* Red text to create urgency */
  }
  
  .weekly-audio-item.completed .days-remaining {
    color: #10b981; /* Change to green when completed */
  }
  
  .completion-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    background: #10b981; /* Green background */
    color: white;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }
`;

// Enhanced WeeklyFeaturedAudios component
const WeeklyFeaturedAudios = () => {
  const [user] = useAuthState(auth);
  const [weeklyAudios, setWeeklyAudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekId, setCurrentWeekId] = useState('');
  const [userCompletions, setUserCompletions] = useState({});
  const [isAdmin, setIsAdmin] = useState(true); // Keep this for admin controls
  const [isGeneratingWeeklyAudios, setIsGeneratingWeeklyAudios] = useState(false);
  
// New state variables for history
  const [showHistory, setShowHistory] = useState(false);
  const [historyWeeks, setHistoryWeeks] = useState([]);
  const [selectedHistoryWeekId, setSelectedHistoryWeekId] = useState('');
  const [historyAudios, setHistoryAudios] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);

  console.log('WeeklyFeaturedAudios component rendering');
  console.log('User:', user?.uid);
  console.log('Admin status:', isAdmin);

  useEffect(() => {
    // Insert the styles into the document
    const styleElement = document.createElement('style');
    styleElement.innerHTML = styles;
    document.head.appendChild(styleElement);
    
    return () => {
      // Clean up
      document.head.removeChild(styleElement);
    };
  }, []);
    // Function to get current week ID (YYYY-WW format)
  // Updated to use Saturday as the first day of the week
  const getCurrentWeekId = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, ..., 6 = Saturday
    
    // Adjust date to previous Saturday if not already Saturday
    const startOfWeek = new Date(now);
    if (dayOfWeek !== 6) { // If not Saturday
      startOfWeek.setDate(now.getDate() - ((dayOfWeek + 1) % 7));
    }
    
    // Calculate week number from the Saturday-based week
    const startOfYear = new Date(startOfWeek.getFullYear(), 0, 1);
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weekNumber = Math.ceil(
      (startOfWeek - startOfYear) / millisecondsPerWeek
    );
    
    return `${startOfWeek.getFullYear()}-${weekNumber.toString().padStart(2, '0')}`;
  };

  // For auto-selection, use a curated playlist of SoundCloud URLs
  const audioPool = [
    'https://soundcloud.com/manoj-m-286517998/bill-britt-6-6-8-6-6?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/29-bww-3047-kumar-shivaram-anjali-founders-triple-diamond-address-1?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/31-bww-3064-ramesh-rama-the-battle-for-your-mind-3?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/28-bww-2806-ajmani-sugeet-kaajal-programming-your-mind-for-success-gaashaan-ali-maka-things-that-matter-4?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/29-bww-3047-kumar-shivaram-anjali-founders-triple-diamond-address-1?in=manoj-m-286517998/sets/70f0d2b4-e017-452c-ab07-0e56c77721ce&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/31-bww-3062-jim-dornan-becoming-champions-gold-edition-bww-3?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/30-bww-3058-gagan-adlakha-mega-anoop-phogat-titan-be-a-leader?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/sandyinterview?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/32-bww-3080-michael-and-carla?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/33-bww-3070-mona-and-rishi?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing'
  ];

  // Get random audios from the pool with actual SoundCloud metadata
  const getRandomAudios = async (count = 5) => {
    console.log('Getting random audios, count:', count);
    console.log('Audio pool size:', audioPool.length);
    
    const shuffled = [...audioPool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    
    console.log('Selected audio URLs:', selected);
    
    // Array to hold the processed audios with metadata
    const processedAudios = [];
    
    // Process each audio URL to get its metadata
    for (let i = 0; i < selected.length; i++) {
      const url = selected[i];
      try {
        // Fetch metadata from SoundCloud oEmbed API
        const response = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        
        if (response.ok) {
          const data = await response.json();
          
          // Extract title and author from the response
          const title = data.title || `Audio ${i + 1}`;
          const author = data.author_name || 'Unknown Artist';
          const description = `By ${author}`;
          
          processedAudios.push({
            title,
            description,
            audioUrl: url
          });
        } else {
          // Fallback if API call fails
          processedAudios.push({
            title: `Featured Audio ${i + 1}`,
            description: 'Weekly featured audio',
            audioUrl: url
          });
          console.log(`Failed to fetch metadata for ${url}, status: ${response.status}`);
        }
      } catch (error) {
        // Handle errors and still add the audio with default metadata
        console.error(`Error fetching metadata for ${url}:`, error);
        processedAudios.push({
          title: `Featured Audio ${i + 1}`,
          description: 'Weekly featured audio',
          audioUrl: url
        });
      }
    }
    
    console.log('Processed audios with metadata:', processedAudios);
    return processedAudios;
  };
    // Save weekly audios to Firestore
  const saveWeeklyAudios = async (audios) => {
    if (!currentWeekId) {
      console.error('No week ID available');
      return;
    }
    
    try {
      console.log('Starting to save weekly audios...');
      console.log('Current week ID:', currentWeekId);
      
      const weeklyRef = collection(db, 'weeklyAudios');
      const weeklyQuery = query(weeklyRef, where('weekId', '==', currentWeekId), limit(1));
      const weeklySnapshot = await getDocs(weeklyQuery);
      
      const now = new Date();
      const currentDay = now.getDay();
      
      // Find the previous Saturday (or today if it's Saturday)
      const saturdayOffset = currentDay === 6 ? 0 : (currentDay + 1);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - saturdayOffset);
      weekStart.setHours(0, 0, 0, 0);
      
      // Find the upcoming Friday
      const fridayOffset = currentDay === 5 ? 0 : (5 - currentDay + (currentDay === 6 ? 6 : 0));
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + fridayOffset);
      weekEnd.setHours(23, 59, 59, 999);
      
      if (weeklySnapshot.empty) {
        // Create new document for this week
        console.log('Creating new weekly audio document');
        console.log('Week period:', weekStart.toISOString(), 'to', weekEnd.toISOString());
        const newDocRef = await addDoc(weeklyRef, {
          weekId: currentWeekId,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          audios,
          createdAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now)
        });
        console.log('New document created with ID:', newDocRef.id);
      } else {
        // Update existing document
        console.log('Updating existing weekly audio document');
        const docRef = weeklySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          audios,
          updatedAt: Timestamp.fromDate(now)
        });
        console.log('Document updated successfully');
      }
      
      // Update state after saving
      setWeeklyAudios(audios);
      console.log('Weekly audios saved successfully!');
      
      return true;
    } catch (error) {
      console.error('Error saving weekly audios:', error);
      return false;
    }
  };

  // Generate weekly audios if none exist
  const generateWeeklyAudios = async () => {
    if (isGeneratingWeeklyAudios || !currentWeekId) return;
    
    try {
      setIsGeneratingWeeklyAudios(true);
      console.log('Generating weekly featured audios...');
      
      // Get 5 random audios with metadata
      const randomAudios = await getRandomAudios(5);
      
      // Save them to Firestore
      const result = await saveWeeklyAudios(randomAudios);
      
      if (result) {
        console.log('Weekly audios generated successfully');
      }
    } catch (error) {
      console.error('Error generating weekly audios:', error);
    } finally {
      setIsGeneratingWeeklyAudios(false);
    }
  };

  // Fetch this week's featured audios
 const fetchWeeklyAudios = useCallback(async () => {
    console.log('Fetching weekly audios...');
    if (!user) {
      console.log('No user available, canceling fetch');
      return;
    }
    
    setLoading(true);
    try {
      const weekId = getCurrentWeekId();
      console.log('Current week ID:', weekId);
      setCurrentWeekId(weekId);
      
      // Get the current week's audios
      const weeklyRef = collection(db, 'weeklyAudios');
      const weeklyQuery = query(weeklyRef, where('weekId', '==', weekId), limit(1));
      const weeklySnapshot = await getDocs(weeklyQuery);
      
      if (!weeklySnapshot.empty) {
        const weeklyData = weeklySnapshot.docs[0].data();
        console.log('Found weekly audios:', weeklyData.audios || []);
        setWeeklyAudios(weeklyData.audios || []);
      } else {
        console.log('No featured audios for this week, generating new ones...');
        setWeeklyAudios([]);
        
        // Auto-generate weekly audios since none exist
        generateWeeklyAudios();
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
          console.log('User has completions:', completions);
        } else {
          console.log('No completions found for user');
        }
        
        setUserCompletions(completions);
      }
    } catch (error) {
      console.error('Error fetching weekly audios:', error);
    } finally {
      setLoading(false);
      console.log('Fetch complete, loading set to false');
    }
  }, [user]);

 // New function to fetch history weeks
  const fetchHistoryWeeks = useCallback(async () => {
    if (!user) return;
    
    setHistoryLoading(true);
    try {
      // Get all week entries, sorted by weekId in descending order
      const weeklyRef = collection(db, 'weeklyAudios');
      const weeklyQuery = query(weeklyRef, orderBy('weekId', 'desc'), limit(10));
      const weeklySnapshot = await getDocs(weeklyQuery);
      
      if (!weeklySnapshot.empty) {
        const weeks = weeklySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            weekId: data.weekId,
            startDate: data.startDate,
            endDate: data.endDate,
            createdAt: data.createdAt,
            audios: data.audios || []
          };
        });
        
        setHistoryWeeks(weeks);
        
        // If we have history and are showing history, set the selected week
        if (weeks.length > 0 && showHistory) {
          setSelectedHistoryWeekId(weeks[historyIndex].weekId);
          setHistoryAudios(weeks[historyIndex].audios);
        }
      } else {
        setHistoryWeeks([]);
      }
    } catch (error) {
      console.error('Error fetching history weeks:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [user, showHistory, historyIndex]);

  // New function to fetch user completions for a historical week
  const fetchHistoryCompletions = useCallback(async (weekId) => {
    if (!user || !weekId) return {};
    
    try {
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
      
      return completions;
    } catch (error) {
      console.error('Error fetching history completions:', error);
      return {};
    }
  }, [user]);
  
  // Handle navigation between history weeks
  const navigateHistory = async (direction) => {
    const newIndex = historyIndex + direction;
    
    if (newIndex >= 0 && newIndex < historyWeeks.length) {
      setHistoryIndex(newIndex);
      const weekData = historyWeeks[newIndex];
      setSelectedHistoryWeekId(weekData.weekId);
      setHistoryAudios(weekData.audios);
      
      // Fetch completions for this historical week
      const historyCompletions = await fetchHistoryCompletions(weekData.weekId);
      setUserCompletions(historyCompletions);
    }
  };
  
  const formatDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return "";
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const options = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
};
  // Check if user is admin
  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;
      
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const isUserAdmin = userDoc.data().isAdmin === true;
          console.log('User admin status from DB:', isUserAdmin);
          setIsAdmin(isUserAdmin);
        } else {
          console.log('User document does not exist');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    checkAdminStatus();
  }, [user]);


  // Load weekly audios on component mount
  useEffect(() => {
    console.log('Weekly audios effect running, user:', user?.uid);
    if (user) {
      fetchWeeklyAudios();
      fetchHistoryWeeks();
    }
  }, [user, fetchWeeklyAudios, fetchHistoryWeeks]);


    useEffect(() => {
    if (showHistory && historyWeeks.length > 0) {
      const weekData = historyWeeks[historyIndex];
      setSelectedHistoryWeekId(weekData.weekId);
      setHistoryAudios(weekData.audios);
      
      // Fetch completions for this historical week
      fetchHistoryCompletions(weekData.weekId).then(completions => {
        setUserCompletions(completions);
      });
    } else if (!showHistory) {
      // When exiting history view, reset to current week
      fetchWeeklyAudios();
    }
  }, [showHistory, historyWeeks, historyIndex, fetchHistoryCompletions, fetchWeeklyAudios]);


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
      
      console.log(`Marked audio "${title}" as completed`);
    } catch (error) {
      console.error('Error marking audio as completed:', error);
    }
  };
// Handle showing history view
  const toggleHistoryView = () => {
    setShowHistory(!showHistory);
  };
  // If loading, show a spinner
  if (loading || (showHistory && historyLoading)) {
    return (
      <div className="weekly-featured-container loading">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">
            {showHistory ? 'Loading audio history...' : 'Generating this week\'s featured audios...'}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="weekly-featured-container loading">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading weekly audios...</p>
        </div>
      </div>
    );
  }

  if (isGeneratingWeeklyAudios) {
    return (
      <div className="weekly-featured-container loading">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Generating this week's featured audios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="weekly-featured-container" style={{ border: '2px solid blue', padding: '15px', margin: '15px 0' }}>
      <div className="weekly-featured-header">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">{showHistory ? 'Weekly Audio History' : "This Week's Featured Audios"}</h2>
          <button 
            onClick={toggleHistoryView}
            className="audio-history-toggle"
          >
            {showHistory ? (
              <>
                <RotateCcw size={16} />
                Current Week
              </>
            ) : (
              <>
                <History size={16} />
                View History
              </>
            )}
          </button>
        </div>
        <p className="text-sm text-gray-200">
          {showHistory 
            ? 'Browse your past weekly audio selections' 
            : 'Listen to our curated selection for this week (Saturday-Friday)'}
        </p>
      </div>

      {/* History navigation UI */}
      {isAdmin && showHistory && historyWeeks.length > 0 && (
        <div className="history-navigation">
          <button 
            onClick={() => navigateHistory(-1)} 
            disabled={historyIndex <= 0}
            className="history-button"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="week-indicator">
            <Clock size={16} />
            <span className="history-week-label">
              Week {selectedHistoryWeekId} 
            </span>
            <span className="text-sm opacity-80">
              {formatDateRange(
                historyWeeks[historyIndex]?.startDate,
                historyWeeks[historyIndex]?.endDate
              )}
            </span>
          </div>
          
          <button 
            onClick={() => navigateHistory(1)} 
            disabled={historyIndex >= historyWeeks.length - 1}
            className="history-button"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {showHistory ? (
        // Show historical audios
        historyAudios.length === 0 ? (
          <div className="no-audios-message">
            <p>No featured audios available for this historical week</p>
          </div>
        ) : (
          <div className="weekly-audios-grid">
            {historyAudios.map((audio, index) => (
              <WeeklyAudioItem 
                key={index}
                audio={audio}
                isCompleted={userCompletions[audio.audioUrl]}
                onComplete={() => markAudioCompleted(audio.audioUrl, audio.title)}
                isHistorical={true}
              />
            ))}
          </div>
        )
      ) : (
        // Show current week audios
        weeklyAudios.length === 0 ? (
          <div className="no-audios-message">
            <p>No featured audios available for this week</p>
            {isAdmin && (
              <button
                onClick={generateWeeklyAudios}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={isGeneratingWeeklyAudios}
              >
                {isGeneratingWeeklyAudios ? 'Generating...' : 'Generate Weekly Audios'}
              </button>
            )}
          </div>
        ) : (
          <div className="weekly-audios-grid">
            {weeklyAudios.map((audio, index) => (
              <WeeklyAudioItem 
                key={index}
                audio={audio}
                isCompleted={userCompletions[audio.audioUrl]}
                onComplete={() => markAudioCompleted(audio.audioUrl, audio.title)}
                isHistorical={false}
              />
            ))}
          </div>
        )
      )}
      
      {/* Always show admin controls for admin users */}
      {isAdmin && !showHistory && (
        <div className="admin-controls mt-6" style={{ border: '2px dashed red', padding: '10px' }}>
          <h3>Admin Controls (Visible because isAdmin={String(isAdmin)})</h3>
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

// WeeklyAudioItem component with improved progress tracking and completion indication
// Updated WeeklyAudioItem component with Firebase progress tracking like AudioHabitItem
const WeeklyAudioItem = ({ audio, isCompleted, onComplete, isHistorical = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [remainingDays, setRemainingDays] = useState(0);
  const [user] = useAuthState(auth);
  const widgetRef = useRef(null);
  const iframeRef = useRef(null);
  const sessionStartTimeRef = useRef(null);
  const progressUpdateTimerRef = useRef(null);
  
  // Calculate remaining days in the current week (Sat-Fri)
    // Calculate remaining days in the current week (Sat-Fri)
  useEffect(() => {
    const calculateRemainingDays = () => {
      // Only calculate remaining days for current week, not historical
      if (isHistorical) {
        setRemainingDays(0);
        return;
      }
      
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Convert to Saturday-based week (where Saturday is day 0)
      const satBasedDay = (currentDay + 1) % 7;
      
      // Calculate days until end of week (Friday)
      const daysRemaining = 7 - satBasedDay;
      
      setRemainingDays(daysRemaining);
    };
    
    calculateRemainingDays();
  }, [isHistorical]); // Add isHistorical to the dependency array
  
  // Load initial progress from Firebase
  useEffect(() => {
    const loadProgress = async () => {
      if (!user || !audio.audioUrl) return;
      
      try {
        // Use the same structure as AudioHabitItem for consistency
        const progressDocRef = doc(
          db, 
          'weeklyAudioProgress', 
          `${user.uid}_${audio.audioUrl.replace(/[^a-zA-Z0-9]/g, '_')}`
        );
        
        const progressDoc = await getDoc(progressDocRef);
        if (progressDoc.exists()) {
          const savedProgress = progressDoc.data();
          
          // Set progress from Firebase
          if (savedProgress.progressPercentage) {
            setProgress(savedProgress.progressPercentage);
          }
          
          if (savedProgress.sessionDuration) {
            setSessionDuration(savedProgress.sessionDuration);
          }
        }
      } catch (error) {
        console.error('Error loading audio progress:', error);
      }
    };
    
    loadProgress();
  }, [user, audio.audioUrl]);

  // Save progress to Firebase (debounced to prevent too many writes)
  const saveProgress = useCallback(
    debounce(async (currentProgress, duration) => {
      if (!user || !audio.audioUrl || isCompleted) return;
      
      try {
        const progressDocRef = doc(
          db, 
          'weeklyAudioProgress', 
          `${user.uid}_${audio.audioUrl.replace(/[^a-zA-Z0-9]/g, '_')}`
        );
        
        await setDoc(progressDocRef, {
          userId: user.uid,
          audioUrl: audio.audioUrl,
          audioTitle: audio.title,
          progressPercentage: currentProgress,
          sessionDuration: duration,
          lastUpdated: serverTimestamp()
        }, { merge: true });
        
        console.log(`Saved progress (${currentProgress}%) for weekly audio: ${audio.title}`);
      } catch (error) {
        console.error('Error saving audio progress:', error);
      }
    }, 2000),
    [user, audio.audioUrl, audio.title, isCompleted]
  );

  // Set up SoundCloud widget and event listeners
  useEffect(() => {
    // Load the SoundCloud Widget API if not already loaded
    if (!window.SC) {
      const script = document.createElement('script');
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.async = true;
      document.body.appendChild(script);
      
      script.onload = initializeWidget;
    } else {
      initializeWidget();
    }
    
    function initializeWidget() {
      if (!iframeRef.current) return;
      
      try {
        // Create widget once iframe is loaded
        const iframe = iframeRef.current;
        if (window.SC && window.SC.Widget) {
          const widget = window.SC.Widget(iframe);
          widgetRef.current = widget;
          
          widget.bind(window.SC.Widget.Events.READY, () => {
            console.log("SoundCloud widget ready for weekly audio");
            
            // If we have saved progress, seek to that position
            if (progress > 0 && progress < 90) {
              widget.getDuration((duration) => {
                const seekPosition = (progress / 100) * duration;
                widget.seekTo(seekPosition);
              });
            }
            
            widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (e) => {
              const currentPosition = e.currentPosition;
              const duration = e.loadedProgress.duration;
              const currentProgress = Math.floor((currentPosition / duration) * 100);
              
              setProgress(currentProgress);
              
              // Save progress periodically to Firebase
              if (currentProgress % 5 === 0) { // Save every 5% progress
                saveProgress(currentProgress, sessionDuration);
              }
              
              // Auto-mark as completed when progress reaches 90%
              if (currentProgress > 90 && !isCompleted) {
                onComplete();
              }
            });
            
            widget.bind(window.SC.Widget.Events.PLAY, () => {
              setIsPlaying(true);
              sessionStartTimeRef.current = Date.now();
              
              // Set up timer to periodically update session duration
              progressUpdateTimerRef.current = setInterval(() => {
                if (sessionStartTimeRef.current) {
                  const currentDuration = (Date.now() - sessionStartTimeRef.current) / 1000;
                  const totalDuration = sessionDuration + currentDuration;
                  setSessionDuration(totalDuration);
                }
              }, 10000); // Update every 10 seconds
            });
            
            widget.bind(window.SC.Widget.Events.PAUSE, () => {
              setIsPlaying(false);
              
              if (progressUpdateTimerRef.current) {
                clearInterval(progressUpdateTimerRef.current);
              }
              
              if (sessionStartTimeRef.current) {
                const currentDuration = (Date.now() - sessionStartTimeRef.current) / 1000;
                const totalDuration = sessionDuration + currentDuration;
                setSessionDuration(totalDuration);
                sessionStartTimeRef.current = null;
                
                // Save progress when paused
                widget.getPosition((position) => {
                  widget.getDuration((duration) => {
                    const pausedProgress = Math.floor((position / duration) * 100);
                    saveProgress(pausedProgress, totalDuration);
                  });
                });
              }
            });
            
            widget.bind(window.SC.Widget.Events.FINISH, () => {
              setIsPlaying(false);
              
              if (progressUpdateTimerRef.current) {
                clearInterval(progressUpdateTimerRef.current);
              }
              
              if (sessionStartTimeRef.current) {
                const currentDuration = (Date.now() - sessionStartTimeRef.current) / 1000;
                const totalDuration = sessionDuration + currentDuration;
                setSessionDuration(totalDuration);
                sessionStartTimeRef.current = null;
                
                // Save 100% progress when finished
                saveProgress(100, totalDuration);
              }
              
              if (!isCompleted) {
                onComplete();
              }
            });
          });
        }
      } catch (error) {
        console.error('Error initializing SoundCloud widget:', error);
      }
    }
    
    return () => {
      // Cleanup
      if (widgetRef.current) {
        try {
          widgetRef.current.unbind(window.SC.Widget.Events.PLAY_PROGRESS);
          widgetRef.current.unbind(window.SC.Widget.Events.PLAY);
          widgetRef.current.unbind(window.SC.Widget.Events.PAUSE);
          widgetRef.current.unbind(window.SC.Widget.Events.FINISH);
        } catch (error) {
          console.error('Error cleaning up widget:', error);
        }
      }
      
      if (progressUpdateTimerRef.current) {
        clearInterval(progressUpdateTimerRef.current);
      }
      
      // Save final progress when component unmounts
      if (progress > 0 && !isCompleted) {
        saveProgress(progress, sessionDuration);
      }
    };
  }, [audio.audioUrl, isCompleted, onComplete, progress, saveProgress, sessionDuration]);

  const togglePlayPause = () => {
    if (!widgetRef.current) return;
    
    if (isPlaying) {
      widgetRef.current.pause();
    } else {
      widgetRef.current.play();
    }
  };

  const handleManualComplete = () => {
    if (!isCompleted) {
      // Save 100% progress when manually marked as complete
      saveProgress(100, sessionDuration);
      onComplete();
    }
  };

  // Format time for display (minutes:seconds)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' + secs : secs}`;
  };

   return (
    <div className={`weekly-audio-item ${isCompleted ? 'completed' : ''}`}>
      <div className="audio-item-header">
        <div className="audio-title">
          <h3>{audio.title}</h3>
          <p className="audio-description">{audio.description}</p>
        </div>
        {isCompleted && (
          <div className="completion-badge">
            <span>✓</span>
            <span>Completed</span>
          </div>
        )}
      </div>
      
      <div className="audio-player">
        <iframe
          ref={iframeRef}
          width="100%"
          height="120"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(audio.audioUrl)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`}
        ></iframe>
      </div>
      
      <div className="audio-controls">
        <button onClick={togglePlayPause} className="play-pause-btn">
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="progress-bar">
          <div 
            className={`progress ${isCompleted ? 'completed' : ''}`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        {!isCompleted && (
          <button 
            onClick={handleManualComplete}
            className="complete-btn"
          >
            Mark Complete
          </button>
        )}
      </div>
       {/* Add "Historical" badge if viewing history */}
      {isHistorical && !isCompleted && (
        <div className="historical-badge" style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(107, 114, 128, 0.7)',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.7rem',
          fontWeight: 'bold'
        }}>
          Past Week
        </div>
      )}

      <div className="weekly-audio-footer">
        <div className="progress-stats">
          <span className="progress-percentage">{progress}% completed</span>
          {sessionDuration > 0 && (
            <span className="listening-time">
              {" • "} {formatTime(sessionDuration)} listened
            </span>
          )}
        </div>
        
        {isHistorical ? (
          <div className={`history-status ${isCompleted ? 'completed' : ''}`}>
            {isCompleted ? 'Completed' : 'Not completed'}
          </div>
        ) : (
          <div className={`days-remaining ${isCompleted ? 'completed' : ''}`}>
            {remainingDays} {remainingDays === 1 ? 'day' : 'days'} remaining
          </div>
        )}
      </div>

      <style jsx>{`
        .weekly-audio-item {
          border: 1px solid #e1e1e1;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          background-color: #fff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .weekly-audio-item.completed {
          background-color: #e6f7e6;
          border-color: #a3d9a3;
        }
        
        .audio-item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        
        .audio-title h3 {
          margin: 0 0 5px;
          font-size: 18px;
          font-weight: 600;
        }
        
        .audio-description {
          margin: 0;
          color: #666;
          font-size: 14px;
        }
        
        .completion-badge {
          display: inline-block;
          background-color: #4CAF50;
          color: white;
          font-size: 12px;
          padding: 3px 8px;
          border-radius: 12px;
          margin-top: 5px;
        }
        
        .audio-player {
          margin-top: 10px;
        }
        
        .audio-controls {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
        }
        
        .play-pause-btn, .complete-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .play-pause-btn {
          background-color: #ff5500;
          color: white;
        }
        
        .complete-btn {
          background-color: #4CAF50;
          color: white;
          margin-left: auto;
        }
        
        .complete-btn:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .progress-bar {
          flex: 1;
          height: 8px;
          background-color: #e1e1e1;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .progress {
          height: 100%;
          background-color: #ff5500;
          transition: width 0.2s ease;
        }
        
        .progress.completed {
          background-color: #4CAF50;
        }
        
        .weekly-audio-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          font-size: 14px;
          color: #666;
        }
        
        .progress-stats {
          display: flex;
        }
        
        .listening-time {
          color: #888;
        }
        
        .days-remaining {
          font-weight: 500;
          color: #ef4444;
        }
        
        .days-remaining.completed {
          color: #4CAF50;
        }
      `}</style>
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
  
  console.log('AdminAudioManager rendered with:', { currentWeekId, audiosCount: currentAudios?.length });
  
  // For auto-selection, use a curated playlist of SoundCloud URLs
  const audioPool = [
    'https://soundcloud.com/manoj-m-286517998/bill-britt-6-6-8-6-6?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/29-bww-3047-kumar-shivaram-anjali-founders-triple-diamond-address-1?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/31-bww-3064-ramesh-rama-the-battle-for-your-mind-3?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/28-bww-2806-ajmani-sugeet-kaajal-programming-your-mind-for-success-gaashaan-ali-maka-things-that-matter-4?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/29-bww-3047-kumar-shivaram-anjali-founders-triple-diamond-address-1?in=manoj-m-286517998/sets/70f0d2b4-e017-452c-ab07-0e56c77721ce&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/31-bww-3062-jim-dornan-becoming-champions-gold-edition-bww-3?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/30-bww-3058-gagan-adlakha-mega-anoop-phogat-titan-be-a-leader?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/sandyinterview?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/32-bww-3080-michael-and-carla?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    'https://soundcloud.com/manoj-m-286517998/33-bww-3070-mona-and-rishi?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing'
  ];

  // Get random audios from the pool with actual SoundCloud metadata
  const getRandomAudios = async (count = 5) => {
    console.log('Getting random audios, count:', count);
    console.log('Audio pool size:', audioPool.length);
    
    const shuffled = [...audioPool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    
    console.log('Selected audio URLs:', selected);
    
    // Array to hold the processed audios with metadata
    const processedAudios = [];
    
    // Process each audio URL to get its metadata
    for (let i = 0; i < selected.length; i++) {
      const url = selected[i];
      try {
        // Fetch metadata from SoundCloud oEmbed API
        const response = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        
        if (response.ok) {
          const data = await response.json();
          
          // Extract title and author from the response
          const title = data.title || `Audio ${i + 1}`;
          const author = data.author_name || 'Unknown Artist';
          const description = `By ${author}`;
          
          processedAudios.push({
            title,
            description,
            audioUrl: url
          });
        } else {
          // Fallback if API call fails
          processedAudios.push({
            title: `Featured Audio ${i + 1}`,
            description: 'Weekly featured audio',
            audioUrl: url
          });
          console.log(`Failed to fetch metadata for ${url}, status: ${response.status}`);
        }
      } catch (error) {
        // Handle errors and still add the audio with default metadata
        console.error(`Error fetching metadata for ${url}:`, error);
        processedAudios.push({
          title: `Featured Audio ${i + 1}`,
          description: 'Weekly featured audio',
          audioUrl: url
        });
      }
    }
    
    console.log('Processed audios with metadata:', processedAudios);
    return processedAudios;
  };
    // Save weekly audios to Firestore
  const saveWeeklyAudios = async (audios) => {
    if (!currentWeekId) {
      console.error('No week ID available');
      return;
    }
    
    setIsSaving(true);
    try {
      console.log('Starting to save weekly audios...');
      console.log('Current week ID:', currentWeekId);
      
      const weeklyRef = collection(db, 'weeklyAudios');
      const weeklyQuery = query(weeklyRef, where('weekId', '==', currentWeekId), limit(1));
      const weeklySnapshot = await getDocs(weeklyQuery);
      
      const now = new Date();
      const currentDay = now.getDay();
      
      // Find the previous Saturday (or today if it's Saturday)
      const saturdayOffset = currentDay === 6 ? 0 : (currentDay + 1);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - saturdayOffset);
      weekStart.setHours(0, 0, 0, 0);
      
      // Find the upcoming Friday
      const fridayOffset = currentDay === 5 ? 0 : (5 - currentDay + (currentDay === 6 ? 6 : 0));
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + fridayOffset);
      weekEnd.setHours(23, 59, 59, 999);
      
      if (weeklySnapshot.empty) {
        // Create new document for this week
        console.log('Creating new weekly audio document');
        console.log('Week period:', weekStart.toISOString(), 'to', weekEnd.toISOString());
        const newDocRef = await addDoc(weeklyRef, {
          weekId: currentWeekId,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          audios,
          createdAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now)
        });
        console.log('New document created with ID:', newDocRef.id);
      } else {
        // Update existing document
        console.log('Updating existing weekly audio document');
        const docRef = weeklySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          audios,
          updatedAt: Timestamp.fromDate(now)
        });
        console.log('Document updated successfully');
      }
      
      console.log('Weekly audios saved successfully!');
      onUpdate();
      alert('Weekly audios updated successfully!');
    } catch (error) {
      console.error('Error saving weekly audios:', error);
      alert('Error saving weekly audios: ' + error.message);
    } finally {
      setIsSaving(false);
      setIsAdding(false);
      console.log('Save operation completed');
    }
  };
  
  // Handle adding a manual audio
  const handleAddAudio = () => {
    console.log('handleAddAudio called with inputs:', audioInputs);
    if (!audioInputs.title || !audioInputs.audioUrl) {
      alert('Title and URL are required');
      return;
    }
    
    const updatedAudios = [
      ...currentAudios,
      { ...audioInputs }
    ];
    
    console.log('Updated audios:', updatedAudios);
    saveWeeklyAudios(updatedAudios);
    setAudioInputs({ title: '', description: '', audioUrl: '' });
  };
  
  // Handle auto-generation of audios
  const handleAutoGenerate = async () => {
    console.log('handleAutoGenerate called');
    try {
      console.log('Starting auto-generation...');
      setIsSaving(true);
      const randomAudios = await getRandomAudios(5);
      console.log('Random audios selected with metadata:', randomAudios);
      await saveWeeklyAudios(randomAudios);
      console.log('Auto-generation completed successfully');
    } catch (error) {
      console.error('Error during auto-generation:', error);
      alert('Failed to auto-generate audios: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-audio-manager">
      <h3 className="text-lg font-semibold mb-4">Manage Weekly Audios</h3>
      <p>Current Week ID: {currentWeekId || 'Not set'}</p>
      <p>Current Audios Count: {currentAudios?.length || 0}</p>
      <p>Week Period: Saturday to Friday</p>
      
      <div className="action-buttons mb-4">
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mr-3"
        >
          {isAdding ? 'Cancel' : 'Add Audio'}
        </button>
        
        <button 
            onClick={() => {
              console.log('Auto-generate button clicked!');
              handleAutoGenerate();
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            style={{ border: '2px solid black' }}
        >
            {isSaving ? 'Generating...' : 'Auto-Generate 5 Audios (Click Me)'}
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

// Ensure the updated WeeklyFeaturedAudios is exported
export { WeeklyFeaturedAudios };

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
  const [showWeeklyAudios, setShowWeeklyAudios] = useState(true); // Default to showing weekly audios
  const [isAdmin, setIsAdmin] = useState(false);

  // Add effect to check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;
      
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const isUserAdmin = userDoc.data().isAdmin === true;
          console.log('User admin status from DB:', isUserAdmin);
          setIsAdmin(isUserAdmin);
        } else {
          console.log('User document does not exist');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    checkAdminStatus();
  }, [user]);

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
        {isAdmin && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Add New Audio Habit
          </button>
        )}
        
        <button
          onClick={() => setShowWeeklyAudios(!showWeeklyAudios)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          {showWeeklyAudios ? 'Hide' : 'Show'} Weekly Featured Audios
        </button>
      </div>

      {/* Show weekly audios component by default */}
      {showWeeklyAudios && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-2">Weekly Featured Audios</h2>
          <WeeklyFeaturedAudios />
        </div>
      )}

      {showAddForm && isAdmin && (
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
       </div>
  );
};
// Add this component within the AudioHabitCard.js file before where it's being used

const AudioHabitItem = ({ habit, userId, onComplete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const iframeRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    // Check if the habit is already completed
    const checkCompletionStatus = async () => {
      if (!userId || !habit.id) return;
      
      try {
        const completionDocRef = doc(db, 'userCompletions', `${userId}_${habit.id}`);
        const completionDoc = await getDoc(completionDocRef);
        if (completionDoc.exists()) {
          setCompleted(true);
        }
      } catch (error) {
        console.error("Error checking completion status:", error);
      }
    };

    checkCompletionStatus();
  }, [userId, habit.id]);

  useEffect(() => {
    let widget = null;

    // Initialize SoundCloud Widget
    if (habit.soundCloudUrl && iframeRef.current) {
      // Load SoundCloud Widget API if not loaded
      if (!window.SC) {
        const script = document.createElement('script');
        script.src = 'https://w.soundcloud.com/player/api.js';
        script.async = true;
        document.body.appendChild(script);

        script.onload = initializeWidget;
      } else {
        initializeWidget();
      }
    }

    function initializeWidget() {
      // Wait until SC is defined
      if (!window.SC) {
        setTimeout(initializeWidget, 100);
        return;
      }

      widget = window.SC.Widget(iframeRef.current);
      widgetRef.current = widget;

      widget.bind(window.SC.Widget.Events.READY, () => {
        console.log("SoundCloud widget ready");
        
        widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (e) => {
          setProgress(e.currentPosition / e.loadedProgress.duration * 100);
          
          // Mark as completed when progress reaches 90%
          if (e.currentPosition / e.loadedProgress.duration > 0.9 && !completed) {
            handleComplete();
          }
        });

        widget.bind(window.SC.Widget.Events.PLAY, () => {
          setIsPlaying(true);
        });

        widget.bind(window.SC.Widget.Events.PAUSE, () => {
          setIsPlaying(false);
        });

        widget.bind(window.SC.Widget.Events.FINISH, () => {
          setIsPlaying(false);
          if (!completed) {
            handleComplete();
          }
        });
      });
    }

    return () => {
      // Cleanup
      if (widgetRef.current) {
        widgetRef.current.unbind(window.SC.Widget.Events.PLAY_PROGRESS);
        widgetRef.current.unbind(window.SC.Widget.Events.PLAY);
        widgetRef.current.unbind(window.SC.Widget.Events.PAUSE);
        widgetRef.current.unbind(window.SC.Widget.Events.FINISH);
      }
    };
  }, [habit.soundCloudUrl, completed]);

  const handleComplete = async () => {
    if (!userId || !habit.id) return;
    
    try {
      // Record completion in Firestore
      const completionDocRef = doc(db, 'userCompletions', `${userId}_${habit.id}`);
      await setDoc(completionDocRef, {
        userId,
        habitId: habit.id,
        completedAt: serverTimestamp(),
      });
      
      setCompleted(true);
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Error marking habit as completed:", error);
    }
  };

  const togglePlayPause = () => {
    if (!widgetRef.current) return;
    
    if (isPlaying) {
      widgetRef.current.pause();
    } else {
      widgetRef.current.play();
    }
  };

  return (
    <div className={`audio-habit-item ${completed ? 'completed' : ''}`}>
      <div className="audio-habit-info">
        <h4>{habit.title}</h4>
        <p>{habit.description || 'No description available'}</p>
        {completed && <span className="completed-badge">Completed</span>}
      </div>
      
      <div className="audio-player">
        <iframe
          ref={iframeRef}
          width="100%"
          height="166"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(habit.soundCloudUrl)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
          title={habit.title}
        ></iframe>
        
        <div className="audio-controls">
          <button onClick={togglePlayPause} className="play-pause-btn">
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${progress}%` }}></div>
          </div>
          {!completed && (
            <button 
              onClick={handleComplete}
              className="complete-btn"
              disabled={completed}
            >
              Mark as Completed
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .audio-habit-item {
          border: 1px solid #e1e1e1;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          background-color: #fff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .audio-habit-item.completed {
          background-color: #e6f7e6;
          border-color: #a3d9a3;
        }
        
        .audio-habit-info {
          margin-bottom: 10px;
        }
        
        .audio-habit-info h4 {
          margin: 0 0 5px;
          font-size: 18px;
        }
        
        .audio-habit-info p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }
        
        .completed-badge {
          display: inline-block;
          background-color: #4CAF50;
          color: white;
          font-size: 12px;
          padding: 3px 8px;
          border-radius: 12px;
          margin-top: 5px;
        }
        
        .audio-player {
          margin-top: 10px;
        }
        
        .audio-controls {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
        }
        
        .play-pause-btn, .complete-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .play-pause-btn {
          background-color: #ff5500;
          color: white;
        }
        
        .complete-btn {
          background-color: #4CAF50;
          color: white;
          margin-left: auto;
        }
        
        .complete-btn:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .progress-bar {
          flex: 1;
          height: 8px;
          background-color: #e1e1e1;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .progress {
          height: 100%;
          background-color: #ff5500;
          transition: width 0.2s ease;
        }
      `}</style>
    </div>
  );
};
// Export the wrapped component
export default function WrappedAudioHabitCard(props) {
  return (
    <ErrorBoundary>
      <AudioHabitCard {...props} />
    </ErrorBoundary>
  );
}