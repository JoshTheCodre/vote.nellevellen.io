'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ClipboardList } from 'lucide-react';
import Navigation from '@/components/Navigation';
import CountdownTimer from '@/components/CountdownTimer';
import VoteCard from '@/components/VoteCard';
import Footer from '@/components/Footer';
import { getPositions, getCandidatesForPosition, getUserVotes, markUserAsVoted, Position, Candidate } from '@/lib/firebase';
import toast from 'react-hot-toast';

interface PositionWithCandidates extends Position {
  candidates: Candidate[];
}

export default function VotingPage() {
  const router = useRouter();
  const [voterId, setVoterId] = useState<string>('');
  const [voterAvatar, setVoterAvatar] = useState<string>('');
  const [positions, setPositions] = useState<PositionWithCandidates[]>([]);
  const [votedPositions, setVotedPositions] = useState<Set<string>>(new Set());
  const [voteCount, setVoteCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const storedVoterId = sessionStorage.getItem('voterId');
    const storedAvatar = sessionStorage.getItem('voterAvatar');

    console.log('Voting page - VoterID:', storedVoterId);
    console.log('Voting page - Avatar URL:', storedAvatar);

    if (!storedVoterId || !storedAvatar) {
      router.push('/');
      return;
    }

    setVoterId(storedVoterId);
    setVoterAvatar(storedAvatar);

    // Mark that user is on voting page
    sessionStorage.setItem('onVotingPage', 'true');

    // Load data
    loadVotingData(storedVoterId);

    // Handle page unload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionStorage.getItem('onVotingPage') === 'true') {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave the election? You will be logged out and cannot login again.';
      }
    };

    const handleUnload = async () => {
      if (sessionStorage.getItem('onVotingPage') === 'true' && storedVoterId) {
        try {
          await markUserAsVoted(storedVoterId);
        } catch (error) {
          console.error('Error marking user as voted:', error);
        }
        sessionStorage.clear();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [router]);

  const loadVotingData = async (userId: string) => {
    try {
      // Load positions
      const positionsData = await getPositions();
      
      // Load candidates for each position
      const positionsWithCandidates = await Promise.all(
        positionsData.map(async (position) => {
          const candidates = await getCandidatesForPosition(position.id);
          return { ...position, candidates };
        })
      );

      setPositions(positionsWithCandidates);

      // Load user votes
      const userVotes = await getUserVotes(userId);
      const votedPositionIds = new Set(userVotes.map(vote => vote.position_id));
      setVotedPositions(votedPositionIds);
      setVoteCount(userVotes.length);
    } catch (error) {
      console.error('Error loading voting data:', error);
      toast.error('Failed to load voting data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoteSuccess = async () => {
    // Reload user votes
    if (voterId) {
      const userVotes = await getUserVotes(voterId);
      const votedPositionIds = new Set(userVotes.map(vote => vote.position_id));
      setVotedPositions(votedPositionIds);
      setVoteCount(userVotes.length);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading voting portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Navigation userAvatar={voterAvatar} showResults={false} />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <section className="text-center mb-16">
            <div className="flex justify-center mb-8">
              <Image
                src="/NACOS.png"
                alt="NACOS Logo"
                width={192}
                height={192}
                className="rounded-full border-4 border-white shadow-2xl object-cover"
                unoptimized
              />
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold mb-4 text-gray-900 drop-shadow-lg leading-tight">
              NACOS Rivers
            </h1>
            <p className="text-xl sm:text-2xl text-gray-700 mb-2">Official Voting Portal</p>
            <p className="text-base sm:text-lg text-gray-600 mb-6">
              Nigerian Association of Computing Students - Rivers State Chapter
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <CountdownTimer />
            </div>
          </section>

          <section id="positions" className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-gray-900 flex items-center gap-3">
              <ClipboardList className="w-8 h-8" /> All Positions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {positions.map((position) => (
                <VoteCard
                  key={position.id}
                  position={position}
                  candidates={position.candidates}
                  hasVoted={votedPositions.has(position.id)}
                  voterId={voterId}
                  onVoteSuccess={handleVoteSuccess}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      <div className="fixed bottom-8 right-8 z-30 bg-white text-gray-900 rounded-full p-4 shadow-2xl border-2 border-green-600 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-green-600 font-medium">Votes Cast</p>
          <p className="text-2xl font-bold text-green-600">{voteCount}</p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
