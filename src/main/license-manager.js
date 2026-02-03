/**
 * GamerClone - License Manager
 * Handles license key validation against the GamerClone backend
 */

const axios = require('axios');
const { machineIdSync } = require('node-machine-id');

class LicenseManager {
  constructor(store) {
    this.store = store;
    this.apiBaseUrl = 'https://api.gamerclone.com'; // Your backend API
    this.machineId = this.getMachineId();
  }

  /**
   * Get unique machine identifier for license binding
   */
  getMachineId() {
    try {
      return machineIdSync(true);
    } catch (error) {
      console.error('Error getting machine ID:', error);
      // Fallback to a stored UUID if machine ID fails
      let storedId = this.store.get('machineId');
      if (!storedId) {
        const { v4: uuidv4 } = require('uuid');
        storedId = uuidv4();
        this.store.set('machineId', storedId);
      }
      return storedId;
    }
  }

  /**
   * Validate a license key against the backend
   */
  async validateLicense(licenseKey) {
    if (!licenseKey) {
      return false;
    }

    try {
      const response = await axios.post(`${this.apiBaseUrl}/license/validate`, {
        license_key: licenseKey,
        machine_id: this.machineId,
        app_version: require('../../package.json').version
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GamerClone Desktop App'
        }
      });

      if (response.data.valid) {
        // Store API keys provided by the backend
        if (response.data.api_keys) {
          this.store.set('deepgramKey', response.data.api_keys.deepgram);
          this.store.set('anthropicKey', response.data.api_keys.anthropic);
          this.store.set('elevenLabsKey', response.data.api_keys.eleven_labs);
        }
        
        // Store license info
        this.store.set('licenseType', response.data.license_type);
        this.store.set('licenseExpiry', response.data.expires_at);
        
        console.log('License validated successfully');
        return true;
      } else {
        console.log('License validation failed:', response.data.message);
        return false;
      }
    } catch (error) {
      console.error('License validation error:', error.message);
      
      // If we can't reach the server, check if we have cached validation
      const cachedExpiry = this.store.get('licenseExpiry');
      if (cachedExpiry && new Date(cachedExpiry) > new Date()) {
        console.log('Using cached license validation');
        return true;
      }
      
      return false;
    }
  }

  /**
   * Activate a new license
   */
  async activateLicense(licenseKey) {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/license/activate`, {
        license_key: licenseKey,
        machine_id: this.machineId,
        machine_name: require('os').hostname(),
        platform: process.platform,
        app_version: require('../../package.json').version
      }, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GamerClone Desktop App'
        }
      });

      if (response.data.success) {
        return {
          success: true,
          message: 'License activated successfully!'
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Activation failed'
        };
      }
    } catch (error) {
      console.error('License activation error:', error);
      
      return {
        success: false,
        message: error.response?.data?.message || 'Could not connect to license server'
      };
    }
  }

  /**
   * Deactivate license from this machine
   */
  async deactivateLicense() {
    const licenseKey = this.store.get('licenseKey');
    
    if (!licenseKey) {
      return true;
    }

    try {
      await axios.post(`${this.apiBaseUrl}/license/deactivate`, {
        license_key: licenseKey,
        machine_id: this.machineId
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Clear stored license data
      this.store.delete('licenseKey');
      this.store.delete('deepgramKey');
      this.store.delete('anthropicKey');
      this.store.delete('elevenLabsKey');
      this.store.delete('licenseType');
      this.store.delete('licenseExpiry');
      
      return true;
    } catch (error) {
      console.error('License deactivation error:', error);
      return false;
    }
  }

  /**
   * Get current license status
   */
  getLicenseStatus() {
    return {
      isActive: this.store.get('isActivated'),
      licenseKey: this.store.get('licenseKey'),
      licenseType: this.store.get('licenseType'),
      expiresAt: this.store.get('licenseExpiry'),
      machineId: this.machineId
    };
  }
}

module.exports = LicenseManager;
