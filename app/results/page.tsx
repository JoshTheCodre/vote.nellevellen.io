'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Trophy } from 'lucide-react';
import { getPositions, getAllCandidates, getVotingResults, Position, Candidate, Vote } from '@/lib/firebase';

interface CandidateResult extends Candidate {
  positionTitle: string;
  voteCount: number;
  percentage: number;
}

export default function ResultsPage() {
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResults();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      loadResults();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadResults = async () => {
    try {
      // Fetch all data
      const [positions, candidates, votes] = await Promise.all([
        getPositions(),
        getAllCandidates(),
        getVotingResults()
      ]);

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
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <Navigation showResults={true} />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 flex items-center gap-3">
              <Trophy className="w-8 h-8" /> All Candidates
            </h2>
            
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
