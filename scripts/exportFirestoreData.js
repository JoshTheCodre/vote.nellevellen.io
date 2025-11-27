#!/usr/bin/env node

/**
 * Firestore Data Export Script
 * Exports all collections and documents from Firestore to JSON
 * 
 * Usage: node scripts/exportFirestoreData.js [outputFile]
 * Example: node scripts/exportFirestoreData.js backup.json
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: serviceAccountKey.json not found');
  console.error(`Expected at: ${serviceAccountPath}`);
  console.error('\nTo get your service account key:');
  console.error('1. Go to Firebase Console → Project Settings');
  console.error('2. Service Accounts tab → Generate new private key');
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
 * Export all Firestore data recursively
 */
async function exportFirestoreData() {
  try {
    console.log('📊 Starting Firestore export...\n');
    
    const allData = {};
    const collections = await db.listCollections();
    
    console.log(`Found ${collections.length} collection(s):`);
    collections.forEach(col => console.log(`  • ${col.id}`));
    console.log('');
    
    for (const collection of collections) {
      console.log(`Exporting collection: ${collection.id}...`);
      allData[collection.id] = await exportCollection(collection);
      console.log(`  ✓ Exported ${Object.keys(allData[collection.id]).length} documents\n`);
    }
    
    return allData;
  } catch (error) {
    console.error('❌ Error exporting Firestore data:', error);
    throw error;
  }
}

/**
 * Export a single collection with all sub-collections
 */
async function exportCollection(collectionRef) {
  try {
    const collectionData = {};
    const docs = await collectionRef.get();
    
    for (const doc of docs.docs) {
      const docData = doc.data();
      
      // Convert Firestore timestamps to ISO strings
      const processedData = processTimestamps(docData);
      
      // Check for sub-collections
      const subCollections = await doc.ref.listCollections();
      if (subCollections.length > 0) {
        processedData._subCollections = {};
        for (const subCollection of subCollections) {
          processedData._subCollections[subCollection.id] = await exportCollection(subCollection);
        }
      }
      
      collectionData[doc.id] = processedData;
    }
    
    return collectionData;
  } catch (error) {
    console.error(`❌ Error exporting collection:`, error);
    throw error;
  }
}

/**
 * Convert Firestore Timestamps to ISO strings
 */
function processTimestamps(data) {
  if (data === null || data === undefined) return data;
  
  if (data.toDate && typeof data.toDate === 'function') {
    // Firestore Timestamp
    return data.toDate().toISOString();
  }
  
  if (Array.isArray(data)) {
    return data.map(item => processTimestamps(item));
  }
  
  if (typeof data === 'object') {
    const processed = {};
    for (const key in data) {
      processed[key] = processTimestamps(data[key]);
    }
    return processed;
  }
  
  return data;
}

/**
 * Save data to JSON file
 */
function saveToFile(data, filename) {
  const outputPath = path.join(__dirname, '..', filename);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n✅ Data exported successfully to: ${outputPath}`);
  return outputPath;
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  
  try {
    const data = await exportFirestoreData();
    
    // Get filename from command line or use default
    const filename = process.argv[2] || 'firestore-backup.json';
    
    // Save to file
    saveToFile(data, filename);
    
    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n📈 Summary:`);
    console.log(`  Total collections: ${Object.keys(data).length}`);
    Object.entries(data).forEach(([collName, docs]) => {
      const docCount = Object.keys(docs).length;
      console.log(`  • ${collName}: ${docCount} document(s)`);
    });
    console.log(`\n⏱️  Export completed in ${duration}s`);
    
    await admin.app().delete();
    process.exit(0);
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    await admin.app().delete();
    process.exit(1);
  }
}

main();
