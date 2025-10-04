// services/aiService.js - Using NEW @google/genai SDK
import { GoogleGenAI } from "@google/genai";

// Initialize the Google AI client
const ai = new GoogleGenAI({
  apiKey: process.env.REACT_APP_GEMINI_API_KEY
});

// Rate limiting helpers
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

const waitForRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
};

export const getHabitRecommendations = async (userHabits, userProfile) => {
  const prompt = `Based on the following user habits and profile, suggest 3-5 new habits that would complement their routine:
    
Current Habits: ${userHabits.map(h => h.name).join(', ')}
User Goals: ${userProfile.goals || 'General wellness and productivity'}
    
Provide suggestions in JSON format as an array with each habit having: name, description, category, and reasoning.
Example format: [{"name": "Morning meditation", "description": "5-minute daily meditation", "category": "wellness", "reasoning": "Complements your existing fitness routine"}]`;

  try {
    await waitForRateLimit(); // Add rate limiting
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt
    });
    
    const text = response.text;
    
    // Clean up JSON response (remove markdown code blocks if present)
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('AI recommendation error:', error);
    
    // Return fallback data
    return [
      { 
        name: "Morning Stretching", 
        description: "10-minute daily stretching routine", 
        category: "wellness", 
        reasoning: "Great complement to existing habits" 
      },
      { 
        name: "Evening Journaling", 
        description: "Reflect on your day for 5 minutes", 
        category: "mindfulness", 
        reasoning: "Helps track progress and mental clarity" 
      }
    ];
  }
};

export const generateProgressInsights = async (habitData, weeklyScores) => {
  const prompt = `Analyze this habit tracking data and provide 3 key insights:
    
Habits: ${JSON.stringify(habitData)}
Weekly Scores: ${weeklyScores.join(', ')}
    
Focus on: patterns, improvement areas, and motivational observations.
Respond in JSON format: {"insights": ["insight 1", "insight 2", "insight 3"]}`;

  try {
    await waitForRateLimit(); // Add rate limiting
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt
    });
    
    const text = response.text;
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('Insights generation error:', error);
    return { 
      insights: [
        'Keep tracking your habits consistently for better results',
        'Focus on building one habit at a time',
        'Celebrate your progress, no matter how small'
      ] 
    };
  }
};

export const generateMotivationalMessage = async (userProgress, currentStreak) => {
  const prompt = `Create a motivational message for a user with:
- Current streak: ${currentStreak} days
- Recent progress: ${userProgress}% completion rate
    
Make it encouraging, specific, and under 100 characters. Return ONLY the message text, no JSON formatting.`;

  try {
    await waitForRateLimit(); // Add rate limiting
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt
    });
    
    return response.text.trim().replace(/['"]/g, '');
  } catch (error) {
    console.error('Motivation generation error:', error);
    return "Keep up the great work! Every day counts towards your goals.";
  }
};

// Optional: Add caching to reduce API calls
const AI_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const getCachedOrGenerate = async (cacheKey, generatorFunction) => {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < AI_CACHE_DURATION) {
        return data;
      }
    }

    const newData = await generatorFunction();
    localStorage.setItem(cacheKey, JSON.stringify({
      data: newData,
      timestamp: Date.now()
    }));
    
    return newData;
  } catch (error) {
    console.error('Cache error:', error);
    return await generatorFunction();
  }
};

// Helper function to test API connection
export const testGeminiConnection = async () => {
  try {
    await waitForRateLimit();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: "Say 'Hello' in one word"
    });
    console.log('✅ Gemini API connected successfully:', response.text);
    return true;
  } catch (error) {
    console.error('❌ Gemini API connection failed:', error);
    return false;
  }
};