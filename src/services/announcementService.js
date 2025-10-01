import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit,
  serverTimestamp,
  getDoc,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { db } from './firebase';

const ANNOUNCEMENTS_COLLECTION = 'announcements';
const ANNOUNCEMENT_RESPONSES_COLLECTION = 'announcementResponses';

// Create announcement (Admin only)
export const createAnnouncement = async (announcementData) => {
  try {
    const docRef = await addDoc(collection(db, ANNOUNCEMENTS_COLLECTION), {
      ...announcementData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
      viewCount: 0,
      responseCount: 0
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating announcement:', error);
    throw error;
  }
};

// Get all active announcements
export const getActiveAnnouncements = async () => {
  try {
    const q = query(
      collection(db, ANNOUNCEMENTS_COLLECTION),
      where('isActive', '==', true),
      orderBy('priority', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching announcements:', error);
    throw error;
  }
};

// Get announcements for admin management
export const getAllAnnouncements = async () => {
  try {
    const q = query(
      collection(db, ANNOUNCEMENTS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching all announcements:', error);
    throw error;
  }
};

// Update announcement
export const updateAnnouncement = async (announcementId, updates) => {
  try {
    const announcementRef = doc(db, ANNOUNCEMENTS_COLLECTION, announcementId);
    await updateDoc(announcementRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    throw error;
  }
};

// Delete announcement
export const deleteAnnouncement = async (announcementId) => {
  try {
    await deleteDoc(doc(db, ANNOUNCEMENTS_COLLECTION, announcementId));
  } catch (error) {
    console.error('Error deleting announcement:', error);
    throw error;
  }
};

// Record announcement view
export const recordAnnouncementView = async (announcementId, userId) => {
  try {
    const announcementRef = doc(db, ANNOUNCEMENTS_COLLECTION, announcementId);
    await updateDoc(announcementRef, {
      viewedBy: arrayUnion(userId),
      viewCount: increment(1)
    });
  } catch (error) {
    console.error('Error recording announcement view:', error);
    throw error;
  }
};

// Submit response to announcement
export const submitAnnouncementResponse = async (announcementId, userId, responseData) => {
  try {
    // Create response document
    await addDoc(collection(db, ANNOUNCEMENT_RESPONSES_COLLECTION), {
      announcementId,
      userId,
      response: responseData,
      createdAt: serverTimestamp()
    });

    // Update announcement response count
    const announcementRef = doc(db, ANNOUNCEMENTS_COLLECTION, announcementId);
    await updateDoc(announcementRef, {
      respondedBy: arrayUnion(userId),
      responseCount: increment(1)
    });
  } catch (error) {
    console.error('Error submitting announcement response:', error);
    throw error;
  }
};

// Get responses for an announcement (Admin only)
export const getAnnouncementResponses = async (announcementId) => {
  try {
    const q = query(
      collection(db, ANNOUNCEMENT_RESPONSES_COLLECTION),
      where('announcementId', '==', announcementId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching announcement responses:', error);
    throw error;
  }
};

// Check if user has responded to announcement
export const hasUserResponded = async (announcementId, userId) => {
  try {
    const q = query(
      collection(db, ANNOUNCEMENT_RESPONSES_COLLECTION),
      where('announcementId', '==', announcementId),
      where('userId', '==', userId),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking user response:', error);
    return false;
  }
};

// Toggle announcement active status
export const toggleAnnouncementStatus = async (announcementId, isActive) => {
  try {
    const announcementRef = doc(db, ANNOUNCEMENTS_COLLECTION, announcementId);
    await updateDoc(announcementRef, {
      isActive,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error toggling announcement status:', error);
    throw error;
  }
};

// Get announcement statistics
export const getAnnouncementStats = async (announcementId) => {
  try {
    const announcementRef = doc(db, ANNOUNCEMENTS_COLLECTION, announcementId);
    const announcementDoc = await getDoc(announcementRef);
    
    if (!announcementDoc.exists()) {
      throw new Error('Announcement not found');
    }

    const data = announcementDoc.data();
    return {
      viewCount: data.viewCount || 0,
      responseCount: data.responseCount || 0,
      viewedBy: data.viewedBy || [],
      respondedBy: data.respondedBy || []
    };
  } catch (error) {
    console.error('Error fetching announcement stats:', error);
    throw error;
  }
};