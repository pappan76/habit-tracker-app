import React, { useState, useEffect } from 'react';
import { getActiveAnnouncements } from '../services/announcementService';

const AnnouncementBadge = ({ user }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
  }, [user]);

  const loadUnreadCount = async () => {
    try {
      const announcements = await getActiveAnnouncements();
      
      // Filter announcements user hasn't viewed
      const unreadAnnouncements = announcements.filter(announcement => {
        // Check if user has viewed this announcement
        const viewedBy = announcement.viewedBy || [];
        return !viewedBy.includes(user.uid);
      });

      setUnreadCount(unreadAnnouncements.length);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  if (unreadCount === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  );
};

export default AnnouncementBadge;