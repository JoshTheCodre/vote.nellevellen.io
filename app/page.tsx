'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Lock, Check, ArrowRight, BarChart2 } from 'lucide-react';
import { getUser, getAllUsers, User, getElectionConfig, ElectionConfig } from '@/lib/firebase';
import Footer from '@/components/Footer';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [voterId, setVoterId] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasVotedUser, setHasVotedUser] = useState(false);
  const [electionStatus, setElectionStatus] = useState<'Not Started' | 'Active' | 'Ended' | 'Not Configured'>('Not Configured');
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    // Check if already logged in
    const storedVoterId = sessionStorage.getItem('voterId');
    if (storedVoterId) {
      // Check if user has already voted
      const checkVotingStatus = async () => {
        const user = await getUser(storedVoterId);
        if (user?.hasVoted) {
          // User has voted, clear session and show results only
          sessionStorage.clear();
          setHasVotedUser(true);
        } else {
          router.push('/voting');
        }
      };
      checkVotingStatus();
    }

    // Load users
    const loadUsers = async () => {
      const users = await getAllUsers();
      setAllUsers(users);
    };
    loadUsers();

    // Listen to election config changes
    const unsubscribe = onSnapshot(doc(db, 'admin', 'election_config'), (docSnap) => {
      if (docSnap.exists()) {
        const config = docSnap.data() as ElectionConfig;
        updateElectionStatus(config);
      } else {
        setElectionStatus('Not Configured');
        setTimeRemaining('No election configured');
      }
    });

    // Update time remaining every second
    const interval = setInterval(() => {
      getElectionConfig().then(config => {
        if (config) updateElectionStatus(config);
      });
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [router]);

  const updateElectionStatus = (config: ElectionConfig) => {
    const now = new Date();
    const startTime = new Date(config.startTime);
    const endTime = new Date(config.endTime);

    if (!config.isActive) {
      setElectionStatus('Not Started');
      setTimeRemaining('Election not activated');
    } else if (now < startTime) {
      setElectionStatus('Not Started');
      const ms = startTime.getTime() - now.getTime();
      setTimeRemaining(`Starts in ${formatTimeRemaining(ms)}`);
    } else if (now > endTime) {
      setElectionStatus('Ended');
      setTimeRemaining('Voting has ended');
    } else {
      setElectionStatus('Active');
      const ms = endTime.getTime() - now.getTime();
      setTimeRemaining(`${formatTimeRemaining(ms)} remaining`);
    }
  };

  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  useEffect(() => {
    const trimmedId = voterId.trim().toUpperCase();
    const user = allUsers.find(u => u.id === trimmedId);
    setSelectedUser(user || null);
  }, [voterId, allUsers]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = voterId.trim().toUpperCase();

    if (!trimmedId) {
      toast.error('⚠️ Please enter your Voter ID');
      return;
    }

    // Check if election is active
    if (electionStatus === 'Ended') {
      toast.error('✗ Voting has ended. You can view the results page.');
      return;
    }
    
    if (electionStatus !== 'Active') {
      toast.error('✗ Voting is not currently active. Please try again when the election starts.');
      return;
    }

    setIsLoading(true);

    try {
      const user = await getUser(trimmedId);

      if (!user) {
        toast.error('✗ Voter ID not found. Please check and try again.');
        setIsLoading(false);
        return;
      }

      if (user.hasVoted === true) {
        toast.error('⚠️ You have already completed your voting session. You cannot login again.');
        setIsLoading(false);
        return;
      }

      toast.success('✓ Login successful! Redirecting...');

      // Clear any previous session
      sessionStorage.clear();

      // Store voter info
      const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.avatar}`;
      console.log('Setting avatar URL:', avatarUrl);
      sessionStorage.setItem('voterId', trimmedId);
      sessionStorage.setItem('voterAvatar', avatarUrl);

      setTimeout(() => {
        router.push('/voting');
      }, 500);
    } catch (error) {
      console.error('Login error:', error);
      toast.error('✗ Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {/* Live Results Link - Top */}
          <div className="text-center">
            <Link
              href="/results"
              className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 hover:border-green-400 rounded-2xl transition-all duration-200 hover:shadow-lg group w-full justify-center"
            >
              <BarChart2 className="w-6 h-6 text-green-600 group-hover:scale-110 transition-transform" />
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">View Live Election Results</p>
                <p className="text-sm text-gray-600">Watch the results in real-time</p>
              </div>
              <ArrowRight className="w-5 h-5 text-green-600 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {!hasVotedUser && (
            <>
              {/* OR Divider */}
              <div className="flex items-center justify-center gap-4">
                <div className="h-px bg-gray-300 flex-1" />
                <span className="text-gray-500 text-sm font-medium px-3 py-1 bg-gray-50 rounded-full">OR</span>
                <div className="h-px bg-gray-300 flex-1" />
              </div>

              {/* Login Card */}
              <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-lg">
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-6">
                    <Image
                      src="/NACOS.png"
                      alt="NACOS Logo"
                      width={90}
                      height={90}
                      className="rounded-full shadow-xl border-4 border-green-600"
                    />
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">NACOS Rivers</h1>
                  <p className="text-gray-600 font-medium">Secure Voting Portal</p>
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 transition-all">
                    {electionStatus === 'Active' && (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-700 font-semibold">🟢 {timeRemaining}</span>
                      </>
                    )}
                    {electionStatus === 'Not Started' && (
                      <>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-xs text-blue-700 font-semibold">⏱️ {timeRemaining}</span>
                      </>
                    )}
                    {electionStatus === 'Ended' && (
                      <>
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        <span className="text-xs text-gray-700 font-semibold">🏁 {timeRemaining}</span>
                      </>
                    )}
                    {electionStatus === 'Not Configured' && (
                      <>
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <span className="text-xs text-amber-700 font-semibold">⚙️ {timeRemaining}</span>
                      </>
                    )}
                  </div>
                </div>

                <form onSubmit={handleLogin} noValidate>
                  <div className="mb-6">
                    <label htmlFor="voterId" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-green-600" />
                      Voter ID
                    </label>
                    <input
                      type="text"
                      id="voterId"
                      value={voterId}
                      onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                      className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl text-gray-900 bg-white focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-100 transition duration-200 placeholder-gray-400 uppercase text-center text-lg font-semibold tracking-wider"
                      placeholder="e.g., TIGER-001"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  {/* Voter Display Section */}
                  {selectedUser && (
                    <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-4">
                        <Image
                          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${selectedUser.avatar}`}
                          alt="Voter Avatar"
                          width={64}
                          height={64}
                          className="rounded-full"
                          unoptimized
                        />
                        <div>
                          <p className="text-sm text-gray-600">Voting As</p>
                          <p className="text-lg font-bold text-gray-900">{selectedUser.id}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 active:scale-95 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {isLoading ? 'Verifying...' : 'Login to Vote'}
                  </button>
                </form>

                <p className="text-center text-gray-600 text-sm mt-6">
                  All registered voters can login with their assigned voter ID
                </p>
              </div>
            </>
          )}

          {hasVotedUser && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-3xl p-8 shadow-lg text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-yellow-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-yellow-700" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Voted</h2>
                <p className="text-gray-600">
                  You have already completed your voting session. You can only view the live results now.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
