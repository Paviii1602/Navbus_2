/**
 * useSocket — Real-time WebSocket Hook for NavBus
 * 
 * Usage (passenger watching a bus):
 *   const { busUpdate, connected } = useSocket({ watchBusId: id })
 *
 * Usage (driver sending GPS):
 *   const { sendDriverLocation, connected } = useSocket({ driverBusId: busId })
 * 
 * Backend URL Resolution:
 *   - Development (web): Uses Vite proxy to localhost:5000
 *   - Production (APK): Uses VITE_BACKEND_URL from environment
 *   - Fallback: Uses current origin (when Flask serves frontend)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';

// Get backend URL with proper handling for Android/Capacitor
function getBackendUrl() {
  // 1. Check environment variable first (for APK builds)
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && envUrl !== 'YOUR_BACKEND_URL_HERE.onrender.com') {
    // Remove trailing slash
    const cleaned = envUrl.replace(/\/$/, '');
    return cleaned;
  }

  // 2. On native platform (Android/iOS), use the configured backend
  if (Capacitor.isNativePlatform()) {
    const capacitorUrl = import.meta.env.VITE_BACKEND_URL;
    if (capacitorUrl) {
      return capacitorUrl.replace(/\/$/, '');
    }
  }

  // 3. Fallback to current origin (works when Flask serves the frontend)
  return window.location.origin;
}

const SOCKET_URL = getBackendUrl();

// Socket instance singleton
let _socket = null;
let _reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function getSocket() {
  if (!_socket || _socket.disconnected || _socket.connected === false) {
    _socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
    });

    _socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      _reconnectAttempts++;
      if (_reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnection attempts reached');
      }
    });

    _socket.on('connect', () => {
      console.log('Socket connected to:', SOCKET_URL);
      _reconnectAttempts = 0;
    });

    _socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
  }
  return _socket;
}

export function useSocket({ watchBusId = null, driverBusId = null } = {}) {
  const [connected, setConnected] = useState(false);
  const [busUpdate, setBusUpdate] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const watchBusIdRef = useRef(watchBusId);
  const driverBusIdRef = useRef(driverBusId);

  // Update refs when IDs change
  useEffect(() => {
    watchBusIdRef.current = watchBusId;
  }, [watchBusId]);

  useEffect(() => {
    driverBusIdRef.current = driverBusId;
  }, [driverBusId]);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      setError(null);
      console.log('✓ Socket connected');
    };

    const onDisconnect = () => {
      setConnected(false);
      console.log('✗ Socket disconnected');
    };

    const onError = (err) => {
      setError(err.message || 'Connection error');
      console.error('Socket error:', err);
    };

    const onBusUpdate = (data) => {
      setBusUpdate(data);
    };

    // Register global listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);

    // If already connected, update state
    if (socket.connected) {
      setConnected(true);
    }

    // Passenger: join the room for one bus
    if (watchBusId) {
      socket.emit('watch_bus', { bus_id: watchBusId });
      socket.on('bus_update', onBusUpdate);
      console.log('Watching bus:', watchBusId);
    }

    // Cleanup
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      
      if (watchBusId) {
        socket.off('bus_update', onBusUpdate);
        socket.emit('unwatch_bus', { bus_id: watchBusId });
        console.log('Stopped watching bus:', watchBusId);
      }
    };
  }, [watchBusId]);

  // Driver: send GPS via WebSocket (faster than REST)
  const sendDriverLocation = useCallback((lat, lng, speed) => {
    if (socketRef.current && driverBusIdRef.current) {
      if (socketRef.current.connected) {
        socketRef.current.emit('driver_location', {
          bus_id: driverBusIdRef.current,
          lat,
          lng,
          speed: speed || 0,
          timestamp: Date.now(),
        });
      } else {
        console.warn('Socket not connected, cannot send driver location');
      }
    }
  }, []);

  // Manual emit function for custom events
  const emit = useCallback((event, data) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  // Check connection status
  const isConnected = useCallback(() => {
    return socketRef.current?.connected || false;
  }, []);

  // Disconnect manually (for cleanup)
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      setConnected(false);
    }
  }, []);

  // Reconnect manually
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  }, []);

  return {
    connected,
    busUpdate,
    error,
    sendDriverLocation,
    emit,
    isConnected,
    disconnect,
    reconnect,
    socket: socketRef.current,
  };
}

/**
 * useSocketWatch - Simplified hook for watching a bus
 * @param {number|null} busId - Bus ID to watch
 * @returns {Object} - { connected, busUpdate, error }
 */
export function useSocketWatch(busId) {
  return useSocket({ watchBusId: busId });
}

/**
 * useSocketDriver - Simplified hook for driver GPS streaming
 * @param {number|null} busId - Bus ID being driven
 * @returns {Object} - { connected, sendDriverLocation, error }
 */
export function useSocketDriver(busId) {
  return useSocket({ driverBusId: busId });
}

export default useSocket;
