// utils/weekUtils.js
export const CUSTOM_WEEK_DAYS = [
  { short: 'Sat', full: 'Saturday', index: 6 },
  { short: 'Sun', full: 'Sunday', index: 0 },
  { short: 'Mon', full: 'Monday', index: 1 },
  { short: 'Tue', full: 'Tuesday', index: 2 },
  { short: 'Wed', full: 'Wednesday', index: 3 },
  { short: 'Thu', full: 'Thursday', index: 4 },
  { short: 'Fri', full: 'Friday', index: 5 }
];

/**
 * Get the start of the custom week (Saturday) for a given date
 */
export const getCustomWeekStart = (date = new Date()) => {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Calculate days to subtract to get to Saturday
  let daysToSubtract;
  if (dayOfWeek === 6) { // Saturday
    daysToSubtract = 0;
  } else { // Sunday (0) to Friday (5)
    daysToSubtract = dayOfWeek + 1;
  }
  
  d.setDate(d.getDate() - daysToSubtract);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get the end of the custom week (Friday) for a given date
 */
export const getCustomWeekEnd = (date = new Date()) => {
  const weekStart = getCustomWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
};

/**
 * Get all dates in the custom week (Saturday to Friday)
 */
export const getCustomWeekDates = (date = new Date()) => {
  const weekStart = getCustomWeekStart(date);
  const dates = [];
  
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(weekStart.getDate() + i);
    dates.push(currentDate);
  }
  
  return dates;
};

/**
 * Format date to YYYY-MM-DD string
 */
export const formatDateString = (date) => {
  return date.toISOString().split('T')[0];
};

/**
 * Check if a date is today
 */
export const isToday = (date) => {
  const today = new Date();
  return formatDateString(date) === formatDateString(today);
};

/**
 * Get week range string (e.g., "Dec 30 - Jan 5")
 */
export const getWeekRangeString = (date = new Date()) => {
  const weekStart = getCustomWeekStart(date);
  const weekEnd = getCustomWeekEnd(date);
  
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const startDay = weekStart.getDate();
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
  const endDay = weekEnd.getDate();
  
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  } else {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }
};

/**
 * Navigate to previous custom week
 */
export const getPreviousWeek = (currentDate) => {
  const newDate = new Date(currentDate);
  newDate.setDate(newDate.getDate() - 7);
  return newDate;
};

/**
 * Navigate to next custom week
 */
export const getNextWeek = (currentDate) => {
  const newDate = new Date(currentDate);
  newDate.setDate(newDate.getDate() + 7);
  return newDate;
};

/**
 * Check if we're in the current week
 */
export const isCurrentWeek = (date) => {
  const today = new Date();
  const currentWeekStart = getCustomWeekStart(today);
  const currentWeekEnd = getCustomWeekEnd(today);
  const checkWeekStart = getCustomWeekStart(date);
  
  return formatDateString(currentWeekStart) === formatDateString(checkWeekStart);
};