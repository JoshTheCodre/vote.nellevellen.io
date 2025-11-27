#!/usr/bin/env node

/**
 * Quick Setup Admin Roles Script (Demo Data)
 * Initializes admin roles with predefined demo data for testing
 * 
 * Usage: node scripts/setupAdminRolesQuick.js
 */

const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin SDK
const serviceAccountPath = require('path').join(__dirname, '../serviceAccountKey.json');
const fs = require('fs');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: serviceAccountKey.json not found');
  console.error(`Expected at: ${serviceAccountPath}`);
  console.error('\nTo get your service account key:');
  console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('2. Click "Generate New Private Key"');
  console.error('3. Save as serviceAccountKey.json in project root');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();

/**
 * Generate a secure random key with proper prefix
 */
function generateSecureKey(prefix) {
  const randomBytes = crypto.randomBytes(16).toString('hex').toUpperCase();
  return `${prefix}${randomBytes}`;
}

/**
 * Setup admin roles with demo data
 */
async function setupAdminRolesQuick() {
  console.log('\n🔐 NACOS Admin Roles Quick Setup (Demo Data)');
  console.log('═══════════════════════════════════════\n');

  try {
    // Generate secure keys
    const chairmanKey = generateSecureKey('NACOS_CHAIRMAN_');
    const secretaryKey = generateSecureKey('NACOS_SECRETARY_');
    
    const committee = [
      {
        id: 1,
        email: 'committee1@nacos.com',
        name: 'Committee Member 1',
        key: generateSecureKey('NACOS_COMMITTEE_1_')
      },
      {
        id: 2,
        email: 'committee2@nacos.com',
        name: 'Committee Member 2',
        key: generateSecureKey('NACOS_COMMITTEE_2_')
      },
      {
        id: 3,
        email: 'committee3@nacos.com',
        name: 'Committee Member 3',
        key: generateSecureKey('NACOS_COMMITTEE_3_')
      },
      {
        id: 4,
        email: 'committee4@nacos.com',
        name: 'Committee Member 4',
        key: generateSecureKey('NACOS_COMMITTEE_4_')
      }
    ];

    // Prepare roles data
    const rolesData = {
      chairman: {
        email: 'chairman@nacos.com',
        name: 'ELECO Chairman',
        key: chairmanKey,
        permissions: ['all']
      },
      secretary: {
        email: 'secretary@nacos.com',
        name: 'Secretary General',
        key: secretaryKey,
        permissions: ['manage_positions', 'manage_candidates', 'view_results']
      },
      committee,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Save to Firestore
    console.log('💾 Saving roles to Firestore...');
    const roleDocRef = db.collection('admin').doc('role');
    await roleDocRef.set(rolesData);
    console.log('✅ Roles saved successfully!\n');

    // Display summary
    console.log('═══════════════════════════════════════');
    console.log('📊 ADMIN ROLES CREATED');
    console.log('═══════════════════════════════════════\n');
    
    console.log('🎯 CHAIRMAN (Full Access)');
    console.log(`   Name: ELECO Chairman`);
    console.log(`   Email: chairman@nacos.com`);
    console.log(`   🔑 Key: ${chairmanKey}`);
    console.log(`   Permissions: All\n`);
    
    console.log('📝 SECRETARY-GENERAL (Position Management)');
    console.log(`   Name: Secretary General`);
    console.log(`   Email: secretary@nacos.com`);
    console.log(`   🔑 Key: ${secretaryKey}`);
    console.log(`   Permissions: Manage positions & candidates\n`);
    
    console.log('👥 COMMITTEE MEMBERS (Results Download Only)');
    committee.forEach((member, idx) => {
      console.log(`   ${idx + 1}. ${member.name}`);
      console.log(`      Email: ${member.email}`);
      console.log(`      🔑 Key: ${member.key}`);
    });
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ Quick Setup Complete!');
    console.log('═══════════════════════════════════════\n');
    
    console.log('🔒 KEY FORMAT VALIDATION:');
    console.log('   • Chairman keys start with: NACOS_CHAIRMAN_');
    console.log('   • Secretary keys start with: NACOS_SECRETARY_');
    console.log('   • Committee keys start with: NACOS_COMMITTEE_[1-4]_\n');

    // Save to local file for reference
    const summaryFile = `admin-roles-demo-${Date.now()}.json`;
    fs.writeFileSync(summaryFile, JSON.stringify(rolesData, null, 2));
    console.log(`💾 Keys saved to: ${summaryFile}`);
    console.log('📋 Use these keys to login to /admin\n');
    console.log('⚠️  IMPORTANT: Delete this file after testing!\n');

  } catch (error) {
    console.error('❌ Error setting up roles:', error);
    process.exit(1);
  } finally {
    await admin.app().delete();
    process.exit(0);
  }
}

// Run the setup
setupAdminRolesQuick();
