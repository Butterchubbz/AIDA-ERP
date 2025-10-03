// src/components/MessageBox.js

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom'; // Required for createPortal

/**
 * A custom modal component to display messages or confirmation prompts.
 * This replaces browser's native alert() and confirm() methods.
 * It is managed by a hook, allowing us to imperatively show/hide it.
 *
 * NOW INCLUDES A TRANSIENT "TOAST" NOTIFICATION SYSTEM for non-blocking feedback.
 */

// Context for the message box, allowing a single instance to be controlled globally
const MessageBoxContext = createContext();

// Custom hook to provide access to the message box's show and toast functions
export const useMessageBox = () => useContext(MessageBoxContext);

// Provider component that manages the state and rendering of the message box and toast
export const MessageBoxProvider = ({ children }) => {
  // State for modal visibility
  const [isVisible, setIsVisible] = useState(false);
  // State for modal title
  const [title, setTitle] = useState('');
  // State for modal message content
  const [message, setMessage] = useState('');
  // State to determine if it's a confirmation (shows "Cancel" button)
  const [isConfirmation, setIsConfirmation] = useState(false);
  // Ref to resolve the promise for confirmation (resolve/reject based on user action)
  const resolveRef = useRef(null);

  // NEW: State for toast notification
  const [toastMessage, setToastMessage] = useState(null);
  const [isToastVisible, setIsToastVisible] = useState(false); // RENAMED: from showToast to isToastVisible
  const toastTimerRef = useRef(null); // Ref to clear timeout for toast

  /**
   * Function to show the message box modal.
   * @param {string} titleText - The title of the message box.
   * @param {string} messageText - The main message content.
   * @param {boolean} confirmOption - If true, it acts as a confirmation dialog.
   * @returns {Promise<boolean>} Resolves true for OK/Confirm, false for Cancel.
   */
  const showMessageBox = useCallback((titleText, messageText, confirmOption = false) => {
    setTitle(titleText);
    setMessage(messageText);
    setIsConfirmation(confirmOption);
    setIsVisible(true);

    return new Promise(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  /**
   * Function to show a transient toast notification.
   * @param {string} msg - The message to display in the toast.
   * @param {string} type - Optional type for styling ('success', 'error', 'info', etc.).
   * @param {number} duration - How long the toast should display in ms (default: 3000).
   */
  const showToast = useCallback((msg, type = 'info', duration = 3000) => {
    // This remains showToast
    setToastMessage({ msg, type });
    setIsToastVisible(true); // UPDATED: Use setIsToastVisible

    // Clear any existing timer to prevent multiple toasts from overlapping incorrectly
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setIsToastVisible(false); // UPDATED: Use setIsToastVisible
      setToastMessage(null);
    }, duration);
  }, []);

  // Handle the "OK" or "Confirm" button click for the modal
  const handleConfirm = useCallback(() => {
    setIsVisible(false);
    if (resolveRef.current) {
      resolveRef.current(true);
    }
  }, []);

  // Handle the "Cancel" button click for the modal (for confirmation dialogs)
  const handleCancel = useCallback(() => {
    setIsVisible(false);
    if (resolveRef.current) {
      resolveRef.current(false);
    }
  }, []);

  // Effect to handle keyboard events (e.g., Escape key to close modal)
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape' && isVisible) {
        if (isConfirmation) {
          handleCancel();
        } else {
          handleConfirm();
        }
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, isConfirmation, handleConfirm, handleCancel]);

  // The value provided to consumers of this context
  const value = {
    showMessageBox, // For blocking modals
    showToast, // For non-blocking toasts
  };

  return (
    <MessageBoxContext.Provider value={value}>
      {children}

      {/* Modal Render */}
      {isVisible &&
        createPortal(
          <div
            onClick={e => {
              // Close if clicked on the overlay, not on the modal content itself
              if (e.target === e.currentTarget) {
                // e.currentTarget refers to the div with fixed inset-0
                if (isConfirmation) {
                  handleCancel();
                } else {
                  handleConfirm();
                }
              }
            }}
            className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-out"
          >
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm transform transition-transform duration-300 ease-out scale-100 opacity-100 text-slate-100">
              <h3 className="text-xl font-semibold text-cyan-400 mb-4 border-b pb-2">{title}</h3>
              <p className="text-slate-200 text-base mb-6">{message}</p>
              <div className="flex justify-end space-x-3">
                {isConfirmation && (
                  <button
                    onClick={handleCancel}
                    className="px-5 py-2 rounded-md border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  className="px-5 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                >
                  {isConfirmation ? 'Confirm' : 'OK'}
                </button>
              </div>
            </div>
          </div>,
          document.body // Portal to the document body
        )}

      {/* Toast Notification Render */}
      {isToastVisible &&
        toastMessage &&
        createPortal(
          // UPDATED: Use isToastVisible
          <div
            className={`fixed bottom-4 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-xl text-white z-50 transition-all duration-300 transform
                               ${
                                 toastMessage.type === 'success'
                                   ? 'bg-emerald-600'
                                   : toastMessage.type === 'error'
                                   ? 'bg-red-600'
                                   : 'bg-blue-600'
                               }
                               ${
                                 isToastVisible
                                   ? 'translate-y-0 opacity-100'
                                   : 'translate-y-full opacity-0'
                               }`} // UPDATED: Use isToastVisible
            role="status"
            aria-live="polite"
          >
            {toastMessage.msg}
          </div>,
          document.body
        )}
    </MessageBoxContext.Provider>
  );
};
