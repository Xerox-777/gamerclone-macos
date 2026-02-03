/**
 * GamerClone - Example Backend API
 * 
 * This is a reference implementation showing how to build the backend
 * that validates licenses and provides API keys to the desktop app.
 * 
 * In production, you would:
 * 1. Store licenses in a real database (PostgreSQL, MySQL, etc.)
 * 2. Integrate with LemonSqueezy/Paddle webhooks for purchase handling
 * 3. Implement proper rate limiting and security
 * 4. Use environment variables for all secrets
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// MOCK DATABASE (Replace with real database in production)
// ============================================================

const licenses = new Map();

// Add some test licenses
licenses.set('TEST-1234-5678-DEMO', {
  email: 'test@example.com',
  type: 'pro',
  status: 'active',
  machineIds: [],
  maxMachines: 2,
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
});

// ============================================================
// API KEYS (Store securely in production!)
// ============================================================

const API_KEYS = {
  deepgram: process.env.DEEPGRAM_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  eleven_labs: process.env.ELEVENLABS_API_KEY
};

// ============================================================
// LICENSE ENDPOINTS
// ============================================================

/**
 * Validate a license key
 * POST /license/validate
 */
app.post('/license/validate', async (req, res) => {
  try {
    const { license_key, machine_id, app_version } = req.body;
    
    if (!license_key || !machine_id) {
      return res.status(400).json({
        valid: false,
        message: 'Missing required fields'
      });
    }
    
    const license = licenses.get(license_key);
    
    if (!license) {
      return res.status(200).json({
        valid: false,
        message: 'Invalid license key'
      });
    }
    
    // Check if license is expired
    if (new Date() > license.expiresAt) {
      return res.status(200).json({
        valid: false,
        message: 'License has expired'
      });
    }
    
    // Check if license is active
    if (license.status !== 'active') {
      return res.status(200).json({
        valid: false,
        message: 'License is not active'
      });
    }
    
    // Check machine limit
    if (!license.machineIds.includes(machine_id)) {
      if (license.machineIds.length >= license.maxMachines) {
        return res.status(200).json({
          valid: false,
          message: `License already activated on ${license.maxMachines} machines. Please deactivate another machine first.`
        });
      }
      // Add this machine
      license.machineIds.push(machine_id);
    }
    
    // License is valid! Return API keys
    return res.status(200).json({
      valid: true,
      license_type: license.type,
      expires_at: license.expiresAt.toISOString(),
      api_keys: API_KEYS
    });
    
  } catch (error) {
    console.error('License validation error:', error);
    return res.status(500).json({
      valid: false,
      message: 'Server error during validation'
    });
  }
});

/**
 * Activate a license on a new machine
 * POST /license/activate
 */
app.post('/license/activate', async (req, res) => {
  try {
    const { license_key, machine_id, machine_name, platform, app_version } = req.body;
    
    const license = licenses.get(license_key);
    
    if (!license) {
      return res.status(200).json({
        success: false,
        message: 'Invalid license key'
      });
    }
    
    // Check machine limit
    if (!license.machineIds.includes(machine_id)) {
      if (license.machineIds.length >= license.maxMachines) {
        return res.status(200).json({
          success: false,
          message: `Maximum ${license.maxMachines} machines allowed. Please deactivate another machine first.`
        });
      }
      license.machineIds.push(machine_id);
    }
    
    // Log activation (in production, store in database)
    console.log(`License activated: ${license_key} on ${machine_name} (${platform})`);
    
    return res.status(200).json({
      success: true,
      message: 'License activated successfully'
    });
    
  } catch (error) {
    console.error('License activation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during activation'
    });
  }
});

/**
 * Deactivate a license from a machine
 * POST /license/deactivate
 */
app.post('/license/deactivate', async (req, res) => {
  try {
    const { license_key, machine_id } = req.body;
    
    const license = licenses.get(license_key);
    
    if (!license) {
      return res.status(200).json({
        success: false,
        message: 'Invalid license key'
      });
    }
    
    // Remove machine from list
    license.machineIds = license.machineIds.filter(id => id !== machine_id);
    
    return res.status(200).json({
      success: true,
      message: 'Machine deactivated successfully'
    });
    
  } catch (error) {
    console.error('License deactivation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during deactivation'
    });
  }
});

// ============================================================
// WEBHOOK HANDLERS (for LemonSqueezy/Paddle)
// ============================================================

/**
 * Handle purchase webhook from LemonSqueezy
 * POST /webhooks/lemonsqueezy
 */
app.post('/webhooks/lemonsqueezy', async (req, res) => {
  try {
    // Verify webhook signature (important!)
    const signature = req.headers['x-signature'];
    // ... verify signature with your webhook secret
    
    const event = req.body;
    
    switch (event.meta.event_name) {
      case 'order_created':
        // Generate license key for new purchase
        const newLicenseKey = generateLicenseKey();
        const customerEmail = event.data.attributes.user_email;
        
        licenses.set(newLicenseKey, {
          email: customerEmail,
          type: 'pro', // or based on product
          status: 'active',
          machineIds: [],
          maxMachines: 2,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        });
        
        // Send license key to customer (via email API)
        console.log(`New license created for ${customerEmail}: ${newLicenseKey}`);
        break;
        
      case 'subscription_cancelled':
        // Handle subscription cancellation
        // Mark license as cancelled (allow grace period)
        break;
        
      case 'subscription_expired':
        // Mark license as expired
        break;
    }
    
    return res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================
// HELPERS
// ============================================================

function generateLicenseKey() {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return segments.join('-');
}

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`GamerClone API server running on port ${PORT}`);
  console.log(`Test license key: TEST-1234-5678-DEMO`);
});
