#!/usr/bin/env node

/**
 * Firestore Data Import Script
 * Imports data from JSON file back to Firestore
 * 
 * Usage: node scripts/importFirestoreData.js <inputFile> [--confirm]
 * Example: node scripts/importFirestoreData.js backup.json --confirm
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: serviceAccountKey.json not found');
  console.error(`Expected at: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();

/**
 * Create readline interface for user confirmation
 */
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Import Firestore data from JSON file
 */
async function importFirestoreData(inputFile, skipConfirmation = false) {
  try {
    // Read and parse JSON file
    if (!fs.existsSync(inputFile)) {
      throw new Error(`File not found: ${inputFile}`);
    }

    console.log(`📂 Reading file: ${inputFile}...`);
    const rawData = fs.readFileSync(inputFile, 'utf-8');
    const data = JSON.parse(rawData);

    const collections = Object.keys(data);
    console.log(`\n📊 Found ${collections.length} collection(s):`);
    
    let totalDocuments = 0;
    collections.forEach(collName => {
      const docCount = Object.keys(data[collName]).length;
      totalDocuments += docCount;
      console.log(`  • ${collName}: ${docCount} document(s)`);
    });

    console.log(`\n⚠️  Total documents to import: ${totalDocuments}`);
    
    // Ask for confirmation unless --confirm flag is passed
    if (!skipConfirmation) {
      const confirmed = await askConfirmation(
        '\n⚠️  WARNING: This will overwrite existing data!\nContinue? (yes/no): '
      );
      
      if (!confirmed) {
        console.log('❌ Import cancelled');
        process.exit(0);
      }
    }

    console.log('\n🔄 Starting import...\n');

    // Import each collection
    for (const collName of collections) {
      console.log(`Importing collection: ${collName}...`);
      await importCollection(collName, data[collName]);
      console.log(`  ✓ Imported successfully\n`);
    }

    return { success: true, documentCount: totalDocuments };
  } catch (error) {
    console.error('❌ Error importing Firestore data:', error);
    throw error;
  }
}

/**
 * Import a single collection
 */
async function importCollection(collectionName, collectionData) {
  try {
    let documentCount = 0;
    const docIds = Object.keys(collectionData);

    for (const docId of docIds) {
      const docData = collectionData[docId];
      
      // Extract sub-collections if they exist
      let subCollectionsData = {};
      if (docData._subCollections) {
        subCollectionsData = docData._subCollections;
        delete docData._subCollections; // Remove from document data
      }

      // Convert ISO timestamp strings back to Firestore Timestamps
      const processedData = processTimestampsForImport(docData);

      // Write document
      await db.collection(collectionName).doc(docId).set(processedData);
      documentCount++;

      // Import sub-collections
      if (Object.keys(subCollectionsData).length > 0) {
        for (const [subCollName, subCollData] of Object.entries(subCollectionsData)) {
          await importSubCollection(
            collectionName,
            docId,
            subCollName,
            subCollData
          );
        }
      }
    }

    console.log(`  Wrote ${documentCount} document(s)`);
  } catch (error) {
    console.error(`Error importing collection ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Import sub-collection
 */
async function importSubCollection(parentCollection, parentDocId, subCollName, subCollData) {
  try {
    const docIds = Object.keys(subCollData);

    for (const docId of docIds) {
      const docData = subCollData[docId];
      const processedData = processTimestampsForImport(docData);

      await db
        .collection(parentCollection)
        .doc(parentDocId)
        .collection(subCollName)
        .doc(docId)
        .set(processedData);
    }
  } catch (error) {
    console.error(
      `Error importing sub-collection ${parentCollection}/${parentDocId}/${subCollName}:`,
      error
    );
    throw error;
  }
}

/**
 * Convert ISO timestamp strings back to Firestore Timestamps
 */
function processTimestampsForImport(data) {
  if (data === null || data === undefined) return data;

  // Check if it's an ISO timestamp string
  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data)) {
    try {
      return admin.firestore.Timestamp.fromDate(new Date(data));
    } catch (e) {
      return data;
    }
  }

  if (Array.isArray(data)) {
    return data.map(item => processTimestampsForImport(item));
  }

  if (typeof data === 'object') {
    const processed = {};
    for (const key in data) {
      processed[key] = processTimestampsForImport(data[key]);
    }
    return processed;
  }

  return data;
}

/**
 * Main execution
 */
async function main() {
  const inputFile = process.argv[2];
  const skipConfirmation = process.argv.includes('--confirm');

  if (!inputFile) {
    console.error('❌ Error: No input file specified');
    console.error('Usage: node scripts/importFirestoreData.js <inputFile> [--confirm]');
    console.error('Example: node scripts/importFirestoreData.js backup.json --confirm');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    const result = await importFirestoreData(inputFile, skipConfirmation);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Import completed successfully!`);
    console.log(`  Documents imported: ${result.documentCount}`);
    console.log(`  Time taken: ${duration}s`);

    await admin.app().delete();
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    await admin.app().delete();
    process.exit(1);
  }
}

main();
