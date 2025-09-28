import Papa from 'papaparse';

/**
 * Parses a CSV file and maps it to your transaction format.
 * @param {File} file - The CSV file to parse.
 * @param {string} userId - The user ID to assign to each transaction.
 * @returns {Promise<Array>} - Resolves to an array of transaction objects.
 */
export default function parseBankCSV(file, userId) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions = results.data.map(row => ({
            id: `csv-${Date.now()}-${Math.random()}`,
            type: row.Type?.toLowerCase() === 'income' ? 'income' : 'expense',
            amount: parseFloat(row.Amount),
            description: row.Description || '',
            category: row.Category || '',
            date: row.Date || new Date().toISOString().split('T')[0],
            userId,
            createdAt: new Date()
          }));
          resolve(transactions);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err)
    });
  });
}