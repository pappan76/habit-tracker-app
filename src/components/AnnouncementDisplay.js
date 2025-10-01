import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  Calendar, 
  Users, 
  BarChart3,
  AlertCircle,
  Gift,
  HelpCircle,
  Target,
  Megaphone,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  getActiveAnnouncements,
  recordAnnouncementView,
  submitAnnouncementResponse,
  hasUserResponded
} from '../services/announcementService';

const AnnouncementDisplay = ({ user }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState(null);
  const [responseStates, setResponseStates] = useState({});
  const [submittingResponse, setSubmittingResponse] = useState(false);

  const announcementTypes = {
    info: { icon: <AlertCircle className="w-5 h-5" />, color: 'blue', bg: 'bg-blue-50', border: 'border-blue-200' },
    promo: { icon: <Gift className="w-5 h-5" />, color: 'green', bg: 'bg-green-50', border: 'border-green-200' },
    event: { icon: <Calendar className="w-5 h-5" />, color: 'purple', bg: 'bg-purple-50', border: 'border-purple-200' },
    poll: { icon: <BarChart3 className="w-5 h-5" />, color: 'orange', bg: 'bg-orange-50', border: 'border-orange-200' },
    questionnaire: { icon: <HelpCircle className="w-5 h-5" />, color: 'indigo', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    goal: { icon: <Target className="w-5 h-5" />, color: 'red', bg: 'bg-red-50', border: 'border-red-200' }
  };

  const priorityColors = {
    low: 'text-gray-600',
    medium: 'text-blue-600',
    high: 'text-orange-600',
    urgent: 'text-red-600'
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await getActiveAnnouncements();
      
      // Filter announcements based on target audience
      const filteredAnnouncements = data.filter(announcement => {
        if (announcement.targetAudience === 'all') return true;
        if (announcement.targetAudience === 'admins' && user?.isAdmin) return true;
        if (announcement.targetAudience === 'users' && !user?.isAdmin) return true;
        return false;
      });

      // Check expiration
      const currentDate = new Date();
      const validAnnouncements = filteredAnnouncements.filter(announcement => {
        if (!announcement.expiresAt) return true;
        const expiryDate = new Date(announcement.expiresAt.seconds * 1000);
        return expiryDate > currentDate;
      });

      setAnnouncements(validAnnouncements);

      // Check response status for each announcement
      const responseChecks = validAnnouncements.map(async (announcement) => {
        const hasResponded = await hasUserResponded(announcement.id, user.uid);
        return { id: announcement.id, hasResponded };
      });

      const responseResults = await Promise.all(responseChecks);
      const responseStatusMap = {};
      responseResults.forEach(result => {
        responseStatusMap[result.id] = result.hasResponded;
      });
      setResponseStates(responseStatusMap);

    } catch (error) {
      console.error('Error loading announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAnnouncement = async (announcementId) => {
    try {
      await recordAnnouncementView(announcementId, user.uid);
      setExpandedAnnouncement(expandedAnnouncement === announcementId ? null : announcementId);
    } catch (error) {
      console.error('Error recording view:', error);
      setExpandedAnnouncement(expandedAnnouncement === announcementId ? null : announcementId);
    }
  };

  const handlePollResponse = async (announcementId, optionIndex) => {
    try {
      setSubmittingResponse(true);
      await submitAnnouncementResponse(announcementId, user.uid, { 
        type: 'poll', 
        selectedOption: optionIndex 
      });
      setResponseStates(prev => ({ ...prev, [announcementId]: true }));
    } catch (error) {
      console.error('Error submitting poll response:', error);
      alert('Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleQuestionnaireResponse = async (announcementId, responses) => {
    try {
      setSubmittingResponse(true);
      await submitAnnouncementResponse(announcementId, user.uid, { 
        type: 'questionnaire', 
        responses 
      });
      setResponseStates(prev => ({ ...prev, [announcementId]: true }));
    } catch (error) {
      console.error('Error submitting questionnaire response:', error);
      alert('Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleActionClick = (announcement) => {
    if (announcement.actionUrl) {
      window.open(announcement.actionUrl, '_blank');
    }
  };

  const getTypeConfig = (type) => {
    return announcementTypes[type] || announcementTypes.info;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No announcements at this time</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Megaphone className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">Announcements</h2>
        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
          {announcements.length}
        </span>
      </div>

      {announcements.map((announcement) => {
        const typeConfig = getTypeConfig(announcement.type);
        const isExpanded = expandedAnnouncement === announcement.id;
        const hasResponded = responseStates[announcement.id];

        return (
          <div
            key={announcement.id}
            className={`border-l-4 ${typeConfig.border} ${typeConfig.bg} rounded-lg shadow-sm overflow-hidden`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`text-${typeConfig.color}-600 mt-1`}>
                    {typeConfig.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                      <span className={`text-xs font-medium ${priorityColors[announcement.priority]} uppercase`}>
                        {announcement.priority}
                      </span>
                      {hasResponded && (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                          Responded
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm mb-3">{announcement.content}</p>
                    
                    {announcement.expiresAt && (
                      <p className="text-xs text-gray-500 mb-2">
                        Expires: {new Date(announcement.expiresAt.seconds * 1000).toLocaleDateString()}
                      </p>
                    )}

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleViewAnnouncement(announcement.id)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            View Details
                          </>
                        )}
                      </button>

                      {announcement.actionRequired && announcement.actionText && (
                        <button
                          onClick={() => handleActionClick(announcement)}
                          className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          {announcement.actionText}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {/* Poll */}
                  {announcement.type === 'poll' && announcement.pollOptions && !hasResponded && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">Cast your vote:</h4>
                      <div className="space-y-2">
                        {announcement.pollOptions.map((option, index) => (
                          <button
                            key={index}
                            onClick={() => handlePollResponse(announcement.id, index)}
                            disabled={submittingResponse}
                            className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            {option.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Questionnaire */}
                  {announcement.type === 'questionnaire' && announcement.questions && !hasResponded && (
                    <QuestionnaireForm
                      questions={announcement.questions}
                      onSubmit={(responses) => handleQuestionnaireResponse(announcement.id, responses)}
                      submitting={submittingResponse}
                    />
                  )}

                  {/* Response Status */}
                  {hasResponded && (announcement.type === 'poll' || announcement.type === 'questionnaire') && (
                    <div className="text-center py-4">
                      <div className="inline-flex items-center gap-2 text-green-600">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          ✓
                        </div>
                        <span className="font-medium">Thank you for your response!</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Questionnaire Form Component
const QuestionnaireForm = ({ questions, onSubmit, submitting }) => {
  const [responses, setResponses] = useState({});

  const handleInputChange = (questionIndex, value) => {
    setResponses(prev => ({
      ...prev,
      [questionIndex]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required questions
    const missingRequired = questions.some((question, index) => 
      question.required && !responses[index]
    );

    if (missingRequired) {
      alert('Please answer all required questions');
      return;
    }

    onSubmit(responses);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h4 className="font-medium text-gray-900">Please answer the following questions:</h4>
      
      {questions.map((question, index) => (
        <div key={index} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          
          {question.type === 'textarea' ? (
            <textarea
              value={responses[index] || ''}
              onChange={(e) => handleInputChange(index, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              required={question.required}
            />
          ) : (
            <input
              type={question.type}
              value={responses[index] || ''}
              onChange={(e) => handleInputChange(index, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={question.required}
            />
          )}
        </div>
      ))}
      
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Response'}
      </button>
    </form>
  );
};

export default AnnouncementDisplay;