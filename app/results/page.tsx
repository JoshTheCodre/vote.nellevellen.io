'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Trophy, Clock } from 'lucide-react';
import { getPositions, getAllCandidates, Position, Candidate, Vote, ElectionConfig } from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, doc } from 'firebase/firestore';

interface CandidateResult extends Candidate {
  positionTitle: string;
  voteCount: number;
  percentage: number;
}

interface ElectionStatus {
  status: 'Not Configured' | 'Inactive' | 'Scheduled' | 'Active' | 'Ended';
  timeRemaining: string;
}

export default function ResultsPage() {
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [electionStatus, setElectionStatus] = useState<ElectionStatus | null>(null);

  // Calculate results from votes
  const calculateResults = (votes: Vote[]) => {
    const voteCountMap = new Map<string, number>();

    votes.forEach(vote => {
      if (vote.candidate_id && vote.position_id && vote.candidate_id !== 'PASS') {
        const key = vote.candidate_id;
        voteCountMap.set(key, (voteCountMap.get(key) || 0) + 1);
      }
    });

    const resultsData: CandidateResult[] = candidates
      .map(candidate => {
        const positionData = positions.find(p => p.id === candidate.position_id);
        const voteCount = voteCountMap.get(candidate.id) || 0;
        const positionVotes = votes.filter(v => v.position_id === candidate.position_id && v.candidate_id && v.candidate_id !== 'PASS').length;

        return {
          ...candidate,
          positionTitle: positionData?.title || 'Unknown Position',
          voteCount,
          percentage: positionVotes > 0 ? (voteCount / positionVotes) * 100 : 0
        };
      })
      .sort((a, b) => {
        if (a.position_id !== b.position_id) {
          return positions.findIndex(p => p.id === a.position_id) - positions.findIndex(p => p.id === b.position_id);
        }
        return b.voteCount - a.voteCount;
      });

    setResults(resultsData);
    setIsLoading(false);
  };

  // Format time remaining
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

  // Update election status
  const updateElectionStatus = (config: ElectionConfig) => {
    const now = new Date();
    const startTime = new Date(config.startTime);
    const endTime = new Date(config.endTime);

    let status: ElectionStatus['status'];
    let timeRemaining: string;

    if (!config.isActive) {
      status = 'Inactive';
      timeRemaining = 'Election Disabled';
    } else if (now < startTime) {
      status = 'Scheduled';
      timeRemaining = `Starts in ${formatTimeRemaining(startTime.getTime() - now.getTime())}`;
    } else if (now > endTime) {
      status = 'Ended';
      timeRemaining = 'Voting has ended';
    } else {
      status = 'Active';
      timeRemaining = `${formatTimeRemaining(endTime.getTime() - now.getTime())} remaining`;
    }

    setElectionStatus({ status, timeRemaining });
  };

  useEffect(() => {
    let unsubscribeVotes: (() => void) | null = null;
    let unsubscribeConfig: (() => void) | null = null;

    const loadInitialData = async () => {
      try {
        // Load positions and candidates once
        const [positionsData, candidatesData] = await Promise.all([
          getPositions(),
          getAllCandidates()
        ]);
        setPositions(positionsData);
        setCandidates(candidatesData);

        // Set up listener for election config
        const configUnsubscribe = onSnapshot(
          doc(db, 'admin', 'election_config'),
          (snapshot) => {
            if (snapshot.exists()) {
              const config = snapshot.data() as ElectionConfig;
              updateElectionStatus(config);
            } else {
              setElectionStatus({
                status: 'Not Configured',
                timeRemaining: 'No election configured'
              });
            }
          },
          (error) => {
            console.error('Error listening to election config:', error);
            setElectionStatus({
              status: 'Not Configured',
              timeRemaining: 'Unable to load status'
            });
          }
        );
        unsubscribeConfig = configUnsubscribe;

        // Set up single real-time listener for votes AFTER initial data loads
        const votesQuery = query(collection(db, 'votes'));
        unsubscribeVotes = onSnapshot(votesQuery, (snapshot) => {
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

          // Calculate results with the loaded positions and candidates
          const voteCountMap = new Map<string, number>();
          votes.forEach(vote => {
            if (vote.candidate_id && vote.position_id && vote.candidate_id !== 'PASS') {
              const key = vote.candidate_id;
              voteCountMap.set(key, (voteCountMap.get(key) || 0) + 1);
            }
          });

          const resultsData: CandidateResult[] = candidatesData
            .map(candidate => {
              const positionData = positionsData.find(p => p.id === candidate.position_id);
              const voteCount = voteCountMap.get(candidate.id) || 0;
              const positionVotes = votes.filter(v => v.position_id === candidate.position_id && v.candidate_id && v.candidate_id !== 'PASS').length;

              return {
                ...candidate,
                positionTitle: positionData?.title || 'Unknown Position',
                voteCount,
                percentage: positionVotes > 0 ? (voteCount / positionVotes) * 100 : 0
              };
            })
            .sort((a, b) => {
              if (a.position_id !== b.position_id) {
                return positionsData.findIndex(p => p.id === a.position_id) - positionsData.findIndex(p => p.id === b.position_id);
              }
              return b.voteCount - a.voteCount;
            });

          setResults(resultsData);
          setIsLoading(false);
        }, (error) => {
          console.error('Error listening to votes:', error);
          setIsLive(false);
        });
      } catch (error) {
        console.error('Error loading initial data:', error);
        setIsLoading(false);
      }
    };

    loadInitialData();

    return () => {
      if (unsubscribeVotes) unsubscribeVotes();
      if (unsubscribeConfig) unsubscribeConfig();
    };
  }, []);

  return (
    <div className="min-h-screen text-white">
      <Navigation showResults={true} />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Election Status Banner */}
          {electionStatus && (
            <div className="mb-6">
              <div className={`rounded-lg border-2 p-4 flex items-center justify-between ${
                electionStatus.status === 'Active' 
                  ? 'bg-green-50 border-green-300' 
                  : electionStatus.status === 'Ended'
                  ? 'bg-red-50 border-red-300'
                  : electionStatus.status === 'Scheduled'
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-gray-50 border-gray-300'
              }`}>
                <div className="flex items-center gap-3">
                  <Clock className={`w-5 h-5 ${
                    electionStatus.status === 'Active'
                      ? 'text-green-600'
                      : electionStatus.status === 'Ended'
                      ? 'text-red-600'
                      : electionStatus.status === 'Scheduled'
                      ? 'text-blue-600'
                      : 'text-gray-600'
                  }`} />
                  <div>
                    <p className={`font-semibold text-sm ${
                      electionStatus.status === 'Active'
                        ? 'text-green-700'
                        : electionStatus.status === 'Ended'
                        ? 'text-red-700'
                        : electionStatus.status === 'Scheduled'
                        ? 'text-blue-700'
                        : 'text-gray-700'
                    }`}>
                      {electionStatus.status}
                    </p>
                    <p className={`text-xs ${
                      electionStatus.status === 'Active'
                        ? 'text-green-600'
                        : electionStatus.status === 'Ended'
                        ? 'text-red-600'
                        : electionStatus.status === 'Scheduled'
                        ? 'text-blue-600'
                        : 'text-gray-600'
                    }`}>
                      {electionStatus.timeRemaining}
                    </p>
                  </div>
                </div>
                {electionStatus.status === 'Active' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-green-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-semibold text-green-700">LIVE</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Trophy className="w-8 h-8" /> All Candidates
              </h2>
              {isLive && electionStatus?.status === 'Active' && (
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
