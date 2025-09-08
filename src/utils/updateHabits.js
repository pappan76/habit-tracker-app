import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

export const updateHabitNames = async () => {
  try {
    console.log('Starting habit name updates...');
    
    // Query for habits with old names
    const meetGreetsQuery = query(
      collection(db, 'habits'),
      where('name', '==', 'Meet & Greets')
    );
    
    const newCustomersQuery = query(
      collection(db, 'habits'),
      where('name', '==', 'New Customers')
    );
    
    // Get the documents
    const [meetGreetsSnapshot, newCustomersSnapshot] = await Promise.all([
      getDocs(meetGreetsQuery),
      getDocs(newCustomersQuery)
    ]);
    
    console.log(`Found ${meetGreetsSnapshot.docs.length} "Meet & Greets" habits`);
    console.log(`Found ${newCustomersSnapshot.docs.length} "New Customers" habits`);
    
    // Use batch for atomic updates
    const batch = writeBatch(db);
    
    // Update Meet & Greets to Retail
    meetGreetsSnapshot.docs.forEach(docSnapshot => {
      batch.update(docSnapshot.ref, {
        name: 'Retail',
        description: 'Focus on retail activities and customer engagement',
        icon: '🏪',
        category: 'Business',
        unit: 'activities',
        target: 5,
        updatedAt: new Date()
      });
    });
    
    // Update New Customers to Org Chart
    newCustomersSnapshot.docs.forEach(docSnapshot => {
      batch.update(docSnapshot.ref, {
        name: 'Org Chart',
        description: 'Work on organizational structure and team development',
        icon: '📊',
        category: 'Business',
        updatedAt: new Date()
      });
    });
    
    // Commit all updates
    await batch.commit();
    
    const totalUpdated = meetGreetsSnapshot.docs.length + newCustomersSnapshot.docs.length;
    console.log(`Successfully updated ${totalUpdated} habits`);
    
    return {
      success: true,
      meetGreetsUpdated: meetGreetsSnapshot.docs.length,
      newCustomersUpdated: newCustomersSnapshot.docs.length,
      totalUpdated
    };
    
  } catch (error) {
    console.error('Error updating habit names:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
export { updateHabitNames };