/**
 * useBackButton - Android Hardware Back Button Handler
 * Uses @capacitor/app for native back button handling on Android
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function useBackButton(handlers = {}) {
  const {
    onBack,           // Custom back handler - return true to prevent default
    onExit,           // App exit handler (when on last screen)
    canPop = true,    // Whether back can pop navigation stack
    exitOnLast = true,// Exit app when on last screen
  } = handlers;

  const handlerRef = useRef(handlers);
  handlerRef.current = handlers;

  useEffect(() => {
    // Only register on Android native platform
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleBackButton = async (info) => {
      const currentHandlers = handlerRef.current;

      // First, try custom onBack handler
      if (currentHandlers.onBack) {
        try {
          const shouldPreventDefault = await currentHandlers.onBack();
          if (shouldPreventDefault === true) {
            return; // Handler prevented default behavior
          }
        } catch (err) {
          console.error('Back button handler error:', err);
        }
      }

      // If no custom handler or it didn't prevent default
      // Check if we can pop (navigate back)
      if (currentHandlers.canPop !== false) {
        // Try to go back in history
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
      }

      // If we can't pop and exitOnLast is true, exit app
      if (currentHandlers.exitOnLast !== false) {
        if (currentHandlers.onExit) {
          await currentHandlers.onExit();
        }
        // Exit the app
        CapApp.exitApp();
      }
    };

    // Register the back button listener
    CapApp.addListener('backButton', handleBackButton);

    // Cleanup
    return () => {
      CapApp.removeAllListeners('backButton');
    };
  }, []);

  // Programmatic back navigation
  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  // Check if we're on the first screen (can't go back further)
  const canGoBack = useCallback(() => {
    return window.history.length > 1;
  }, []);

  return {
    goBack,
    canGoBack,
  };
}

/**
 * useHardwareBack - Simplified hook for basic back button handling
 * @param {Function} onBack - Optional custom back handler
 * @returns {Object} - { goBack, canGoBack }
 */
export function useHardwareBack(onBack = null) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleBack = async () => {
      if (onBackRef.current) {
        try {
          const result = await onBackRef.current();
          if (result === true) return; // Prevented default
        } catch (err) {
          console.error('Back handler error:', err);
        }
      }

      // Default: go back in history
      if (window.history.length > 1) {
        window.history.back();
      } else {
        // Exit app
        CapApp.exitApp();
      }
    };

    CapApp.addListener('backButton', handleBack);

    return () => {
      CapApp.removeAllListeners('backButton');
    };
  }, []);

  return {
    goBack: () => window.history.back(),
    canGoBack: () => window.history.length > 1,
  };
}

/**
 * useBackButtonExit - Hook to show exit confirmation dialog
 * @param {number} doublePressDelay - Time window for double press (ms)
 * @returns {Object} - { showExitPrompt, resetExitPrompt }
 */
export function useBackButtonExit(doublePressDelay = 2000) {
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const exitTimerRef = useRef(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleBack = async () => {
      if (showExitPrompt) {
        // Second press - exit
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
        }
        CapApp.exitApp();
      } else {
        // First press - show prompt
        setShowExitPrompt(true);
        exitTimerRef.current = setTimeout(() => {
          setShowExitPrompt(false);
          exitTimerRef.current = null;
        }, doublePressDelay);
      }
    };

    CapApp.addListener('backButton', handleBack);

    return () => {
      CapApp.removeAllListeners('backButton');
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [showExitPrompt, doublePressDelay]);

  const resetExitPrompt = useCallback(() => {
    setShowExitPrompt(false);
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  return { showExitPrompt, resetExitPrompt };
}

// Default export
export default useBackButton;
