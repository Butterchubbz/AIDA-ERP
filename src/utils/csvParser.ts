import Papa from 'papaparse';

/**
 * Parses a CSV file into an array of objects using PapaParse.
 * @param {File} file - The CSV file to parse.
 * @returns {Promise<Array<Object>>} A promise that resolves with the parsed data.
 */
export const parseCsvFile = (file: File): Promise<Array<{ [key: string]: string }>> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, // Treat the first row as headers
      skipEmptyLines: true, // Skip empty lines
      dynamicTyping: false, // Keep all values as strings for now; handle type conversion later if needed
      complete: results => {
        if (results.errors.length) {
          // If there are parsing errors, reject the promise
          reject(new Error(results.errors[0].message));
        } else if (!results.data.length) {
          reject(new Error('CSV file is empty or contains no data rows.'));
        } else {
          // PapaParse returns data as an array of objects, which is what we need.
          // Ensure all values are strings, as dynamicTyping is false.
          const parsedData = (results.data as Array<Record<string, string>>).map(row => {
            const newRow: { [key: string]: string } = {};
            for (const key of Object.keys(row)) {
              newRow[key.trim()] = String(row[key] ?? '').trim(); // Trim keys and values
            }
            return newRow;
          });
          resolve(parsedData);
        }
      },
      error: err => {
        // Handle file reading errors
        reject(new Error('Failed to read CSV file: ' + err.message));
      },
    });
  });
};
