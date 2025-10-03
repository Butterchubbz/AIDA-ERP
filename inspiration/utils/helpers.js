// src/utils/helpers.js

/**
 * Generates a simple unique ID string.
 * This is primarily for client-side keys and temporary IDs.
 * For robust, globally unique IDs, especially for database records,
 * Firebase Firestore generates its own document IDs automatically.
 * @returns {string} A unique ID string.
 */
export const generateUniqueId = () => {
  // Generates a string like '_abcdefg123'
  return '_' + Math.random().toString(36).substring(2, 11);
};

/**
 * Basic email validation function.
 * @param {string} email - The email string to validate.
 * @returns {boolean} True if the email format is valid, false otherwise.
 */
export const isValidEmail = email => {
  // A simple regex for email validation. More robust validation might be needed for production.
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Basic password strength check.
 * Checks for a minimum length of 6 characters.
 * @param {string} password - The password string to check.
 * @returns {boolean} True if the password meets the minimum length, false otherwise.
 */
export const isStrongPassword = password => {
  return password.length >= 6; // Firebase Auth requires at least 6 characters for passwords
};

/**
 * Formats a given number as a currency string (e.g., $1,234.56).
 * @param {number} amount - The number to format.
 * @param {string} currency - The currency code (e.g., 'USD', 'EUR').
 * @param {string} locale - The locale string (e.g., 'en-US', 'de-DE').
 * @returns {string} The formatted currency string.
 */
export const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The input string.
 * @returns {string} The string with the first letter capitalized.
 */
export const capitalizeFirstLetter = str => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Add more helper functions as needed for your application
// e.g., date formatting, array manipulations, etc.
