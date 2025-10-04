// src/components/HabitRecommendations.jsx
import { useState } from 'react';
import { getHabitRecommendations } from '../services/aiService';

function HabitRecommendations({ userHabits, userProfile }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const recs = await getHabitRecommendations(userHabits, userProfile);
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recommendations">
      <button onClick={loadRecommendations} disabled={loading}>
        {loading ? 'Generating...' : 'Get AI Recommendations'}
      </button>

      <div className="recommendations-list">
        {recommendations.map((rec, index) => (
          <div key={index} className="recommendation-card">
            <h3>{rec.name}</h3>
            <p>{rec.description}</p>
            <span className="category">{rec.category}</span>
            <p className="reasoning">{rec.reasoning}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HabitRecommendations;