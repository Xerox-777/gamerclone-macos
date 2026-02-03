/**
 * GamerClone - Voice Pipeline
 * Handles STT (Deepgram) → LLM (Claude Vision) → TTS (ElevenLabs)
 */

const WebSocket = require('ws');
const Anthropic = require('@anthropic-ai/sdk');
const { Readable } = require('stream');

// Game profiles for context
const gameProfiles = require('../shared/game-profiles');

class VoicePipeline {
  constructor(store) {
    this.store = store;
    this.audioBuffer = [];
    this.isListening = false;
    this.deepgramWs = null;
    this.elevenLabsWs = null;
    
    // API clients
    this.anthropic = null;
    
    // Audio capture (will be initialized when needed)
    this.audioCapture = null;
    this.audioPlayer = null;
  }

  /**
   * Initialize API clients with stored credentials
   */
  initializeClients() {
    const apiKeys = this.getApiKeys();
    
    if (apiKeys.anthropic) {
      this.anthropic = new Anthropic({
        apiKey: apiKeys.anthropic
      });
    }
  }

  /**
   * Get API keys from secure storage
   * In production, these would be fetched from your backend after license validation
   */
  getApiKeys() {
    // For MVP, these could be stored after license activation
    // Your backend would provide these after validating the license
    return {
      deepgram: process.env.DEEPGRAM_API_KEY || this.store.get('deepgramKey'),
      anthropic: process.env.ANTHROPIC_API_KEY || this.store.get('anthropicKey'),
      elevenLabs: process.env.ELEVENLABS_API_KEY || this.store.get('elevenLabsKey')
    };
  }

  /**
   * Start listening for voice input
   */
  startListening() {
    this.isListening = true;
    this.audioBuffer = [];
    
    // Play "listening" sound
    this.playSound('listening');
    
    console.log('Voice pipeline: Started listening');
  }

  /**
   * Stop listening and return audio data
   */
  stopListening() {
    this.isListening = false;
    
    // Play "processing" sound
    this.playSound('processing');
    
    const audioData = Buffer.concat(this.audioBuffer);
    this.audioBuffer = [];
    
    console.log(`Voice pipeline: Stopped listening, captured ${audioData.length} bytes`);
    return audioData;
  }

  /**
   * Process a voice query with screenshots
   */
  async processQuery(audioData, screenshots, gameProfileId) {
    try {
      this.initializeClients();
      
      // Step 1: Speech-to-Text with Deepgram
      console.log('Step 1: Converting speech to text...');
      const transcript = await this.speechToText(audioData);
      
      if (!transcript || transcript.trim() === '') {
        throw new Error('Could not understand audio');
      }
      
      console.log(`Transcript: "${transcript}"`);
      
      // Step 2: Analyze with Claude Vision
      console.log('Step 2: Analyzing with Claude Vision...');
      const response = await this.analyzeWithClaude(transcript, screenshots, gameProfileId);
      
      console.log(`Claude response: "${response}"`);
      
      // Step 3: Text-to-Speech with ElevenLabs
      console.log('Step 3: Converting response to speech...');
      await this.textToSpeech(response);
      
      return {
        transcript,
        response,
        success: true
      };
    } catch (error) {
      console.error('Voice pipeline error:', error);
      
      // Speak the error
      await this.textToSpeech("Sorry, I couldn't process that. Please try again.");
      
      throw error;
    }
  }

  /**
   * Speech-to-Text using Deepgram
   */
  async speechToText(audioData) {
    const apiKeys = this.getApiKeys();
    
    if (!apiKeys.deepgram) {
      throw new Error('Deepgram API key not configured');
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket('wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1', {
        headers: {
          'Authorization': `Token ${apiKeys.deepgram}`
        }
      });

      let transcript = '';

      ws.on('open', () => {
        console.log('Deepgram connection opened');
        ws.send(audioData);
        ws.send(JSON.stringify({ type: 'CloseStream' }));
      });

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.channel?.alternatives?.[0]?.transcript) {
          transcript = response.channel.alternatives[0].transcript;
        }
      });

      ws.on('close', () => {
        console.log('Deepgram connection closed');
        resolve(transcript);
      });

      ws.on('error', (error) => {
        console.error('Deepgram error:', error);
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        ws.close();
        if (!transcript) {
          reject(new Error('STT timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Analyze screenshots with Claude Vision
   */
  async analyzeWithClaude(userQuery, screenshots, gameProfileId) {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const gameProfile = gameProfiles[gameProfileId] || gameProfiles.generic;
    
    // Build the message content with images
    const content = [];
    
    // Add screenshots (most recent last for better context)
    for (const screenshot of screenshots) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: screenshot.base64.replace('data:image/jpeg;base64,', '')
        }
      });
    }
    
    // Add the user's question
    content.push({
      type: 'text',
      text: userQuery
    });

    const systemPrompt = this.buildSystemPrompt(gameProfile);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 300, // Keep responses concise for voice
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: content
          }
        ]
      });

      return response.content[0].text;
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  /**
   * Build system prompt based on game profile
   */
  buildSystemPrompt(gameProfile) {
    return `You are GamerClone, an expert AI gaming coach. You provide real-time voice guidance to help players improve.

CURRENT GAME: ${gameProfile.name}
${gameProfile.context}

RESPONSE GUIDELINES:
- Be concise - responses will be spoken aloud (aim for 1-3 sentences)
- Be specific and actionable - tell them exactly what to do
- Reference what you see in the screenshots
- Use gaming terminology appropriate for this game
- Sound confident and encouraging, like a coach
- If you can't see clearly or aren't sure, say so briefly

GAMEPLAY CONTEXT:
${gameProfile.tips}

Analyze the screenshots and answer the player's question directly and helpfully.`;
  }

  /**
   * Text-to-Speech using ElevenLabs
   */
  async textToSpeech(text) {
    const apiKeys = this.getApiKeys();
    
    if (!apiKeys.elevenLabs) {
      console.log('ElevenLabs not configured, skipping TTS');
      return;
    }

    // Default voice ID (you can make this configurable)
    const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // "Sarah" - clear, professional voice
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_turbo_v2_5`, {
        headers: {
          'xi-api-key': apiKeys.elevenLabs
        }
      });

      const audioChunks = [];

      ws.on('open', () => {
        console.log('ElevenLabs connection opened');
        
        // Send initial config
        ws.send(JSON.stringify({
          text: ' ', // Initial space
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          },
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 290]
          }
        }));
        
        // Send the actual text
        ws.send(JSON.stringify({
          text: text,
          flush: true
        }));
      });

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        
        if (response.audio) {
          // Decode base64 audio and add to chunks
          const audioBuffer = Buffer.from(response.audio, 'base64');
          audioChunks.push(audioBuffer);
          
          // Play audio chunk immediately for streaming playback
          this.playAudioChunk(audioBuffer);
        }
        
        if (response.isFinal) {
          ws.close();
        }
      });

      ws.on('close', () => {
        console.log('ElevenLabs connection closed');
        resolve(Buffer.concat(audioChunks));
      });

      ws.on('error', (error) => {
        console.error('ElevenLabs error:', error);
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        ws.close();
      }, 30000);
    });
  }

  /**
   * Play an audio chunk (for streaming playback)
   */
  playAudioChunk(audioBuffer) {
    // In a full implementation, this would use naudiodon or similar
    // to play audio through WASAPI
    // For MVP, we'll implement a simpler approach
    console.log(`Playing audio chunk: ${audioBuffer.length} bytes`);
  }

  /**
   * Play a notification sound
   */
  playSound(type) {
    const sounds = {
      listening: 'listening.wav',
      processing: 'processing.wav',
      error: 'error.wav',
      complete: 'complete.wav'
    };
    
    // In full implementation, play the actual sound file
    console.log(`Playing sound: ${type}`);
  }

  /**
   * Test API connections
   */
  async testConnection() {
    try {
      this.initializeClients();
      
      // Test Claude
      if (this.anthropic) {
        await this.anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        });
      }
      
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

module.exports = VoicePipeline;
