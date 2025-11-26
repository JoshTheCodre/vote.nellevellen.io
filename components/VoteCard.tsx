'use client';

import { useState } from 'react';
import { ThumbsDown, Check } from 'lucide-react';
import { Candidate, castVote } from '@/lib/firebase';
import toast from 'react-hot-toast';

interface VoteCardProps {
  position: {
    id: string;
    title: string;
  };
  candidates: Candidate[];
  hasVoted: boolean;
  voterId: string;
  onVoteSuccess: () => void;
}

export default function VoteCard({ position, candidates, hasVoted, voterId, onVoteSuccess }: VoteCardProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<string>('');
  const [isVoting, setIsVoting] = useState(false);
  const [voted, setVoted] = useState(hasVoted);

  const handleVote = async () => {
    if (!selectedCandidate) {
      toast.error('⚠️ Please select a candidate');
      return;
    }

    setIsVoting(true);
    try {
      const candidate = candidates.find(c => c.id === selectedCandidate);
      if (!candidate) throw new Error('Candidate not found');

      await castVote(voterId, position.id, candidate.id, candidate.name);
      toast.success(`✓ You just voted for ${candidate.name}`);
      setVoted(true);
      onVoteSuccess();
    } catch (error) {
      console.error('Error casting vote:', error);
      toast.error('✗ Failed to cast vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleAbstain = async () => {
    if (!confirm(`Are you sure you want to pass on voting for ${position.title}? You cannot change this decision later.`)) {
      return;
    }

    setIsVoting(true);
    try {
      await castVote(voterId, position.id, 'PASS', 'Passed');
      toast.success(`✓ You have passed on ${position.title}`, {
        icon: '🔸',
        style: {
          background: '#f97316',
          color: '#fff',
        },
      });
      setVoted(true);
      onVoteSuccess();
    } catch (error) {
      console.error('Error recording pass:', error);
      toast.error('✗ Failed to record pass. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:border-green-300 transform hover:-translate-y-1">
      {voted && (
        <div className="mb-4 inline-flex items-center gap-2 bg-green-50 border border-green-300 px-3 py-1 rounded-full">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-green-600 text-sm font-semibold">Voted</span>
        </div>
      )}
      
      <div className="mb-4">
        <div className="h-1.5 w-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-1">{position.title}</h3>
        <p className="text-sm text-gray-600">Select your preferred candidate</p>
      </div>
      
      <select
        value={selectedCandidate}
        onChange={(e) => setSelectedCandidate(e.target.value)}
        className="w-full px-4 py-3 mb-4 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition"
        disabled={voted || isVoting}
      >
        <option value="" hidden>Choose candidate...</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>
      
      <div className="flex gap-2">
        <button
          onClick={handleVote}
          disabled={voted || isVoting}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg transition active:scale-95 shadow-md hover:shadow-lg"
        >
          {isVoting ? 'Voting...' : 'Vote Now'}
        </button>
        <button
          onClick={handleAbstain}
          disabled={voted || isVoting}
          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition active:scale-95 shadow-md hover:shadow-lg whitespace-nowrap"
        >
          <ThumbsDown className="w-4 h-4" />
          Pass
        </button>
      </div>
    </div>
  );
}
