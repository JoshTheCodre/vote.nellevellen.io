import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  Firestore,
  serverTimestamp,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Firestore
const db: Firestore = getFirestore(app);

// Types
export interface User {
  id: string;
  avatar: string;
  createdAt: string;
  hasVoted: boolean;
  votedPositions: string[];
}

export interface Position {
  id: string;
  title: string;
  order: number;
}

export interface Candidate {
  id: string;
  name: string;
  position_id: string;
}

export interface Vote {
  voter_id: string;
  position_id: string;
  candidate_id: string;
  candidate_name: string;
  timestamp: string;
}

export interface ElectionConfig {
  startTime: string;
  endTime: string;
  isActive: boolean;
  allowLateVoting?: boolean;
  updatedAt?: string;
}

// Generate secure alphanumeric user ID
function generateSecureUserId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Check if user ID exists in Firestore
export async function checkUserExists(userId: string): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    return userDoc.exists();
  } catch (error) {
    console.error('Error checking user:', error);
    return false;
  }
}

// Generate unique user ID
export async function generateUniqueUserId(): Promise<string> {
  let userId: string = '';
  let exists = true;

  while (exists) {
    userId = generateSecureUserId();
    exists = await checkUserExists(userId);
  }

  return userId;
}

// Create new user in Firestore
export async function createUser(avatar: string): Promise<User> {
  try {
    const userId = await generateUniqueUserId();
    const userData: User = {
      id: userId,
      avatar: avatar,
      createdAt: new Date().toISOString(),
      hasVoted: false,
      votedPositions: []
    };

    await setDoc(doc(db, 'users', userId), userData);
    return userData;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// Get user by ID
export async function getUser(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

// Update user voting status
export async function updateUserVotingStatus(userId: string, positionId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data() as User;
      const votedPositions = userData.votedPositions || [];

      if (!votedPositions.includes(positionId)) {
        votedPositions.push(positionId);
        await setDoc(userRef, {
          ...userData,
          votedPositions: votedPositions,
          hasVoted: votedPositions.length > 0
        });
      }
    }
  } catch (error) {
    console.error('Error updating user voting status:', error);
    throw error;
  }
}

// Mark user as voted (when leaving)
export async function markUserAsVoted(userId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { hasVoted: true });
  } catch (error) {
    console.error('Error marking user as voted:', error);
    throw error;
  }
}

// Get all positions from Firestore
export async function getPositions(): Promise<Position[]> {
  try {
    const positionsCollection = collection(db, 'positions');
    const positionsSnapshot = await getDocs(query(positionsCollection, orderBy('order')));
    const positions: Position[] = [];

    positionsSnapshot.forEach((doc) => {
      positions.push({ id: doc.id, ...doc.data() } as Position);
    });

    return positions;
  } catch (error) {
    console.error('Error getting positions:', error);
    return [];
  }
}

// Get candidates for a specific position
export async function getCandidatesForPosition(positionId: string): Promise<Candidate[]> {
  try {
    const candidatesCollection = collection(db, 'candidates');
    const candidatesQuery = query(candidatesCollection, where('position_id', '==', positionId));
    const candidatesSnapshot = await getDocs(candidatesQuery);
    const candidates: Candidate[] = [];

    candidatesSnapshot.forEach((doc) => {
      candidates.push({ id: doc.id, ...doc.data() } as Candidate);
    });

    return candidates;
  } catch (error) {
    console.error('Error getting candidates:', error);
    return [];
  }
}

// Get all candidates
export async function getAllCandidates(): Promise<Candidate[]> {
  try {
    const candidatesCollection = collection(db, 'candidates');
    const candidatesSnapshot = await getDocs(candidatesCollection);
    const candidates: Candidate[] = [];

    candidatesSnapshot.forEach((doc) => {
      candidates.push({ id: doc.id, ...doc.data() } as Candidate);
    });

    return candidates;
  } catch (error) {
    console.error('Error getting all candidates:', error);
    return [];
  }
}

// Get all users
export async function getAllUsers(): Promise<User[]> {
  try {
    const usersCollection = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollection);
    const users: User[] = [];

    usersSnapshot.forEach((doc) => {
      users.push(doc.data() as User);
    });

    return users;
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
}

// Cast a vote
export async function castVote(
  userId: string,
  positionId: string,
  candidateId: string,
  candidateName: string
): Promise<Vote> {
  try {
    const vote: Omit<Vote, 'timestamp'> & { timestamp: any } = {
      voter_id: userId,
      position_id: positionId,
      candidate_id: candidateId,
      candidate_name: candidateName,
      timestamp: serverTimestamp()
    };

    // Add vote to Firestore
    await addDoc(collection(db, 'votes'), vote);

    // Update user voting status
    await updateUserVotingStatus(userId, positionId);

    return { ...vote, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Error casting vote:', error);
    throw error;
  }
}

// Get votes for a specific user
export async function getUserVotes(userId: string): Promise<Vote[]> {
  try {
    const votesCollection = collection(db, 'votes');
    const votesQuery = query(votesCollection, where('voter_id', '==', userId));
    const votesSnapshot = await getDocs(votesQuery);
    const votes: Vote[] = [];

    votesSnapshot.forEach((doc) => {
      votes.push(doc.data() as Vote);
    });

    return votes;
  } catch (error) {
    console.error('Error getting user votes:', error);
    return [];
  }
}

// Get voting results
export async function getVotingResults(): Promise<Vote[]> {
  try {
    const votesCollection = collection(db, 'votes');
    const votesSnapshot = await getDocs(votesCollection);
    const votes: Vote[] = [];

    votesSnapshot.forEach((doc) => {
      votes.push(doc.data() as Vote);
    });

    return votes;
  } catch (error) {
    console.error('Error getting voting results:', error);
    return [];
  }
}

// Get election configuration
export async function getElectionConfig(): Promise<ElectionConfig | null> {
  try {
    const configDoc = await getDoc(doc(db, 'admin', 'election_config'));
    if (configDoc.exists()) {
      return configDoc.data() as ElectionConfig;
    }
    return null;
  } catch (error) {
    console.error('Error getting election config:', error);
    return null;
  }
}

// Update election configuration
export async function updateElectionConfig(config: ElectionConfig): Promise<boolean> {
  try {
    await setDoc(doc(db, 'admin', 'election_config'), {
      ...config,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error updating election config:', error);
    return false;
  }
}

// Check if election is currently active
export async function isElectionActive(): Promise<boolean> {
  try {
    const config = await getElectionConfig();
    if (!config || !config.isActive) return false;

    const now = new Date();
    const startTime = new Date(config.startTime);
    const endTime = new Date(config.endTime);

    return now >= startTime && now <= endTime;
  } catch (error) {
    console.error('Error checking election status:', error);
    return false;
  }
}

// Add a new candidate
export async function addCandidate(name: string, positionId: string): Promise<boolean> {
  try {
    await addDoc(collection(db, 'candidates'), {
      name,
      position_id: positionId
    });
    return true;
  } catch (error) {
    console.error('Error adding candidate:', error);
    return false;
  }
}

// Update a candidate
export async function updateCandidate(candidateId: string, name: string, positionId: string): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'candidates', candidateId), {
      name,
      position_id: positionId
    });
    return true;
  } catch (error) {
    console.error('Error updating candidate:', error);
    return false;
  }
}

// Delete a candidate
export async function deleteCandidate(candidateId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'candidates', candidateId));
    return true;
  } catch (error) {
    console.error('Error deleting candidate:', error);
    return false;
  }
}

// Add a new position
export async function addPosition(title: string, order: number): Promise<boolean> {
  try {
    await addDoc(collection(db, 'positions'), {
      title,
      order
    });
    return true;
  } catch (error) {
    console.error('Error adding position:', error);
    return false;
  }
}

// Update a position
export async function updatePosition(positionId: string, title: string, order: number): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'positions', positionId), {
      title,
      order
    });
    return true;
  } catch (error) {
    console.error('Error updating position:', error);
    return false;
  }
}

// Delete a position
export async function deletePosition(positionId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'positions', positionId));
    return true;
  } catch (error) {
    console.error('Error deleting position:', error);
    return false;
  }
}

export { db };
