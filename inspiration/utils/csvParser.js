// src/utils/csvParser.js

/**
 * Parses a CSV file into an array of objects.
 * @param {File} file - The CSV file to parse.
 * @returns {Promise<Array<Object>>} A promise that resolves with the parsed data.
 */
export const parseCsvFile = file => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== ''); // Split and remove empty lines
        if (lines.length < 2) {
          return reject(new Error('CSV file must have a header and at least one data row.'));
        }
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          return headers.reduce((obj, header, index) => {
            obj[header] = values[index]?.trim();
            return obj;
          }, {});
        });
        resolve(data);
      } catch (e) {
        reject(new Error('Failed to parse CSV file: ' + e.message));
      }
    };

    reader.onerror = error => reject(error);
    reader.readAsText(file);
  });
};
