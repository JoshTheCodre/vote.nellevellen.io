'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Trophy } from 'lucide-react';
import { getPositions, getAllCandidates, Position, Candidate, Vote } from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

interface CandidateResult extends Candidate {
  positionTitle: string;
  voteCount: number;
  percentage: number;
}

export default function ResultsPage() {
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Load positions and candidates once
    const loadInitialData = async () => {
      const [positionsData, candidatesData] = await Promise.all([
        getPositions(),
        getAllCandidates()
      ]);
      setPositions(positionsData);
      setCandidates(candidatesData);
    };

    loadInitialData();

    // Set up real-time listener for votes
    const votesQuery = query(collection(db, 'votes'));
    const unsubscribe = onSnapshot(votesQuery, (snapshot) => {
      setIsLive(true);
      const votes: Vote[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          voter_id: data.voter_id || '',
          position_id: data.position_id || '',
          candidate_id: data.candidate_id || '',
          candidate_name: data.candidate_name || '',
          timestamp: data.timestamp || ''
        } as Vote;
      });

      calculateResults(votes);
    }, (error) => {
      console.error('Error listening to votes:', error);
      setIsLive(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Recalculate when positions or candidates change
    if (positions.length > 0 && candidates.length > 0) {
      // Trigger initial calculation
      const votesQuery = query(collection(db, 'votes'));
      const unsubscribe = onSnapshot(votesQuery, (snapshot) => {
        const votes: Vote[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            voter_id: data.voter_id || '',
            position_id: data.position_id || '',
            candidate_id: data.candidate_id || '',
            candidate_name: data.candidate_name || '',
            timestamp: data.timestamp || ''
          } as Vote;
        });
        calculateResults(votes);
      });

      return () => unsubscribe();
    }
  }, [positions, candidates]);

  const calculateResults = (votes: Vote[]) => {
    if (positions.length === 0 || candidates.length === 0) return;

    try {
      // Filter out "PASS" votes
      const validVotes = votes.filter((vote: Vote) => vote.candidate_id !== 'PASS');

      // Count votes per candidate
      const voteCount: Record<string, number> = {};
      validVotes.forEach((vote: Vote) => {
        voteCount[vote.candidate_id] = (voteCount[vote.candidate_id] || 0) + 1;
      });

      // Calculate total votes for percentages
      const totalVotes = validVotes.length;

      // Map candidates with their results
      const candidateResults: CandidateResult[] = candidates.map((candidate: Candidate) => {
        const position = positions.find((p: Position) => p.id === candidate.position_id);
        const candidateVotes = voteCount[candidate.id] || 0;
        const percentage = totalVotes > 0 ? (candidateVotes / totalVotes) * 100 : 0;

        return {
          ...candidate,
          positionTitle: position?.title || 'Unknown',
          voteCount: candidateVotes,
          percentage: parseFloat(percentage.toFixed(1))
        };
      });

      setResults(candidateResults);
      setIsLoading(false);
    } catch (error) {
      console.error('Error calculating results:', error);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <Navigation showResults={true} />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Trophy className="w-8 h-8" /> All Candidates
              </h2>
              {isLive && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold text-green-700">LIVE</span>
                </div>
              )}
            </div>
            
            {isLoading ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading results...</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-gray-900">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-6 py-4 font-semibold text-gray-900">#</th>
                        <th className="text-left px-6 py-4 font-semibold text-gray-900">Name</th>
                        <th className="text-left px-6 py-4 font-semibold text-gray-900">Position</th>
                        <th className="text-right px-6 py-4 font-semibold text-gray-900">Votes %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((candidate, idx) => (
                        <tr key={candidate.id} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                          <td className="px-6 py-3 font-medium text-gray-900">{idx + 1}</td>
                          <td className="px-6 py-3 text-gray-900">{candidate.name}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{candidate.positionTitle}</td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <div className="w-32 bg-gray-200 rounded-full h-2 border border-gray-300">
                                <div
                                  className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${candidate.percentage}%` }}
                                />
                              </div>
                              <span className="font-semibold text-green-600 min-w-12 text-right">
                                {candidate.percentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {results.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            No voting data available yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
