/**
 * useGeoLocation - Capacitor Geolocation Hook for Android
 * Uses @capacitor/geolocation for native GPS access on Android devices
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export function useGeoLocation(options = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 3000,
    watch = false,
  } = options;

  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(null);
  const watchIdRef = useRef(null);

  // Check and request permissions
  const checkPermissions = useCallback(async () => {
    try {
      const permissions = await Geolocation.checkPermissions();
      const granted = permissions.location === 'granted';
      setPermissionGranted(granted);
      return granted;
    } catch (err) {
      console.error('Error checking permissions:', err);
      setPermissionGranted(false);
      return false;
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    try {
      const permissions = await Geolocation.requestPermissions();
      const granted = permissions.location === 'granted' || permissions.location === 'limited';
      setPermissionGranted(granted);
      return granted;
    } catch (err) {
      console.error('Error requesting permissions:', err);
      setPermissionGranted(false);
      return false;
    }
  }, []);

  // Get current position once
  const getCurrentPosition = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Check permissions first
      const hasPermission = await checkPermissions();
      if (!hasPermission) {
        const granted = await requestPermissions();
        if (!granted) {
          throw new Error('Location permission denied');
        }
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout,
        maximumAge,
      });

      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
        heading: pos.coords.heading,
        timestamp: pos.timestamp,
      });
      return pos;
    } catch (err) {
      console.error('Geolocation error:', err);
      setError(err.message || 'Failed to get location');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [checkPermissions, requestPermissions, enableHighAccuracy, timeout, maximumAge]);

  // Watch position continuously
  const startWatching = useCallback(async (onPositionChange, onError) => {
    try {
      // Check permissions first
      const hasPermission = await checkPermissions();
      if (!hasPermission) {
        const granted = await requestPermissions();
        if (!granted) {
          throw new Error('Location permission denied');
        }
      }

      // Clear existing watch
      if (watchIdRef.current !== null) {
        await Geolocation.clearWatch({ id: watchIdRef.current });
      }

      const watchId = await Geolocation.watchPosition(
        (pos, err) => {
          if (err) {
            setError(err.message || 'Watch error');
            onError?.(err);
            return;
          }
          if (pos) {
            const newPos = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
              heading: pos.coords.heading,
              timestamp: pos.timestamp,
            };
            setPosition(newPos);
            onPositionChange?.(newPos);
          }
        },
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        }
      );

      watchIdRef.current = watchId;
      return watchId;
    } catch (err) {
      console.error('Start watching error:', err);
      setError(err.message || 'Failed to start watching');
      throw err;
    }
  }, [checkPermissions, requestPermissions, enableHighAccuracy, timeout, maximumAge]);

  // Stop watching position
  const stopWatching = useCallback(async () => {
    if (watchIdRef.current !== null) {
      try {
        await Geolocation.clearWatch({ id: watchIdRef.current });
        watchIdRef.current = null;
      } catch (err) {
        console.error('Clear watch error:', err);
      }
    }
  }, []);

  // Initial permission check on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Auto-start watching if watch option is enabled
  useEffect(() => {
    if (watch) {
      startWatching();
      return () => stopWatching();
    }
  }, [watch, startWatching, stopWatching]);

  return {
    position,
    error,
    loading,
    permissionGranted,
    getCurrentPosition,
    startWatching,
    stopWatching,
    checkPermissions,
    requestPermissions,
  };
}

// Legacy browser-based hook fallback (for web development)
export function useGeoLocationWeb(options = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 3000,
    watch = false,
  } = options;

  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const watchIdRef = useRef(null);

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return Promise.reject(new Error('Geolocation not supported'));
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
            heading: pos.coords.heading,
            timestamp: pos.timestamp,
          };
          setPosition(newPos);
          setLoading(false);
          resolve(pos);
        },
        (err) => {
          setError(err.message || 'Failed to get location');
          setLoading(false);
          reject(err);
        },
        { enableHighAccuracy, timeout, maximumAge }
      );
    });
  }, [enableHighAccuracy, timeout, maximumAge]);

  const startWatching = useCallback((onPositionChange, onError) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return null;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        };
        setPosition(newPos);
        onPositionChange?.(newPos);
      },
      (err) => {
        setError(err.message || 'Watch error');
        onError?.(err);
      },
      { enableHighAccuracy, timeout, maximumAge }
    );

    return watchIdRef.current;
  }, [enableHighAccuracy, timeout, maximumAge]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (watch) {
      startWatching();
      return () => stopWatching();
    }
  }, [watch, startWatching, stopWatching]);

  return {
    position,
    error,
    loading,
    permissionGranted: true,
    getCurrentPosition,
    startWatching,
    stopWatching,
  };
}

// Smart hook that auto-detects platform
export function useSmartGeoLocation(options = {}) {
  const isNative = Capacitor.isNativePlatform();
  const capacitorHook = useGeoLocation(options);
  const webHook = useGeoLocationWeb(options);

  return isNative ? capacitorHook : webHook;
}
