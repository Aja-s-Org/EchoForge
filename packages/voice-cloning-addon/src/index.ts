/**
 * EchoForge Voice Cloning Addon - Main Entry Point
 *
 * This package provides the voice cloning functionality including:
 * - Voice cloning through f5-tts integration
 * - Audio processing utilities
 * - Memory management
 * - Python service integration
 * - Node.js N-API bindings for C++ functionality
 */

export * from './lib/core-engine';

// Voice Cloning Types and Interfaces
export * from './types';

// N-API Bindings for C++ functionality
export * from './lib/napi-binding';
