#!/usr/bin/env node

/**
 * Setup Admin Roles Script
 * Initializes admin roles in Firestore with secure keys
 * 
 * Usage: node scripts/setupAdminRoles.js
 */

const admin = require('firebase-admin');
const readline = require('readline');
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
 * Create readline interface for user input
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Setup admin roles in Firestore
 */
async function setupAdminRoles() {
  console.log('\n🔐 NACOS Admin Roles Setup');
  console.log('═══════════════════════════════════════\n');

  try {
    // Check if roles already exist
    const roleDocRef = db.collection('admin').doc('role');
    const roleDoc = await roleDocRef.get();

    if (roleDoc.exists()) {
      console.log('⚠️  Admin roles already exist in Firestore!\n');
      const overwrite = await askQuestion('Do you want to overwrite existing roles? (yes/no): ');
      
      if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
        console.log('\n❌ Setup cancelled. Existing roles preserved.');
        process.exit(0);
      }
      console.log('');
    }

    // Collect Chairman information
    console.log('📋 CHAIRMAN (ELECO Chairman)');
    console.log('───────────────────────────────────────');
    const chairmanEmail = await askQuestion('Enter Chairman email: ');
    const chairmanName = await askQuestion('Enter Chairman name: ');
    const chairmanKey = generateSecureKey('NACOS_CHAIRMAN_');
    console.log(`✅ Generated Chairman key: ${chairmanKey}\n`);

    // Collect Secretary information
    console.log('📋 SECRETARY-GENERAL');
    console.log('───────────────────────────────────────');
    const secretaryEmail = await askQuestion('Enter Secretary-General email: ');
    const secretaryName = await askQuestion('Enter Secretary-General name: ');
    const secretaryKey = generateSecureKey('NACOS_SECRETARY_');
    console.log(`✅ Generated Secretary key: ${secretaryKey}\n`);

    // Collect Committee Members information
    console.log('📋 COMMITTEE MEMBERS (4 members)');
    console.log('───────────────────────────────────────');
    const committee = [];
    
    for (let i = 1; i <= 4; i++) {
      console.log(`\nCommittee Member ${i}:`);
      const email = await askQuestion(`  Email: `);
      const name = await askQuestion(`  Name: `);
      const key = generateSecureKey(`NACOS_COMMITTEE_${i}_`);
      console.log(`  ✅ Generated key: ${key}`);
      
      committee.push({
        id: i,
        email,
        name,
        key
      });
    }

    // Prepare roles data
    const rolesData = {
      chairman: {
        email: chairmanEmail,
        name: chairmanName,
        key: chairmanKey,
        permissions: ['all']
      },
      secretary: {
        email: secretaryEmail,
        name: secretaryName,
        key: secretaryKey,
        permissions: ['manage_positions', 'manage_candidates', 'view_results']
      },
      committee,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Save to Firestore
    console.log('\n\n💾 Saving roles to Firestore...');
    await roleDocRef.set(rolesData);
    console.log('✅ Roles saved successfully!\n');

    // Display summary
    console.log('═══════════════════════════════════════');
    console.log('📊 ADMIN ROLES SUMMARY');
    console.log('═══════════════════════════════════════\n');
    
    console.log('🎯 CHAIRMAN (Full Access)');
    console.log(`   Name: ${chairmanName}`);
    console.log(`   Email: ${chairmanEmail}`);
    console.log(`   Key: ${chairmanKey}`);
    console.log(`   Permissions: All (manage elections, positions, candidates, download results)\n`);
    
    console.log('📝 SECRETARY-GENERAL (Position Management)');
    console.log(`   Name: ${secretaryName}`);
    console.log(`   Email: ${secretaryEmail}`);
    console.log(`   Key: ${secretaryKey}`);
    console.log(`   Permissions: Manage positions & candidates\n`);
    
    console.log('👥 COMMITTEE MEMBERS (Results Download Only)');
    committee.forEach((member, idx) => {
      console.log(`   ${idx + 1}. ${member.name} (${member.email})`);
      console.log(`      Key: ${member.key}`);
    });
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ Setup Complete!');
    console.log('═══════════════════════════════════════\n');
    
    console.log('📧 IMPORTANT: Send each admin their respective key via secure channel\n');
    console.log('🔒 KEY FORMAT VALIDATION:');
    console.log('   • Chairman keys MUST start with: NACOS_CHAIRMAN_');
    console.log('   • Secretary keys MUST start with: NACOS_SECRETARY_');
    console.log('   • Committee keys MUST start with: NACOS_COMMITTEE_[1-4]_\n');

    // Save to local file for reference
    const summaryFile = `admin-roles-${Date.now()}.json`;
    fs.writeFileSync(summaryFile, JSON.stringify(rolesData, null, 2));
    console.log(`💾 Roles saved to: ${summaryFile}`);
    console.log('⚠️  Keep this file secure and delete after distributing keys!\n');

  } catch (error) {
    console.error('❌ Error setting up roles:', error);
    process.exit(1);
  } finally {
    await admin.app().delete();
    process.exit(0);
  }
}

// Run the setup
setupAdminRoles();
