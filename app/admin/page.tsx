'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Clock, Settings, Zap, BarChart, Play, StopCircle, RefreshCw, Save } from 'lucide-react';
import Footer from '@/components/Footer';
import { 
  getElectionConfig, 
  updateElectionConfig, 
  isElectionActive,
  ElectionConfig 
} from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [config, setConfig] = useState<ElectionConfig | null>(null);
  const [formData, setFormData] = useState({
    startTime: '',
    endTime: '',
    isActive: false,
    allowLateVoting: false
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    votesCast: 0,
    turnoutRate: 0,
    positions: 0
  });
  const [statusInfo, setStatusInfo] = useState({
    status: 'Loading...',
    timeRemaining: 'Loading...'
  });

  useEffect(() => {
    loadElectionStatus();
    loadElectionStats();

    const interval = setInterval(() => {
      loadElectionStatus();
      loadElectionStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadElectionStatus = async () => {
    try {
      const electionConfig = await getElectionConfig();
      
      if (!electionConfig) {
        const now = new Date();
        const defaultStart = new Date(now.getTime() + (1 * 60 * 60 * 1000));
        const defaultEnd = new Date(now.getTime() + (25 * 60 * 60 * 1000));
        
        setFormData({
          startTime: formatDateTimeLocal(defaultStart),
          endTime: formatDateTimeLocal(defaultEnd),
          isActive: false,
          allowLateVoting: false
        });
        
        setStatusInfo({
          status: 'Not Configured',
          timeRemaining: 'N/A'
        });
        
        return;
      }

      setConfig(electionConfig);
      setFormData({
        startTime: formatDateTimeLocal(new Date(electionConfig.startTime)),
        endTime: formatDateTimeLocal(new Date(electionConfig.endTime)),
        isActive: electionConfig.isActive || false,
        allowLateVoting: electionConfig.allowLateVoting || false
      });

      const active = await isElectionActive();
      const now = new Date();
      const startTime = new Date(electionConfig.startTime);
      const endTime = new Date(electionConfig.endTime);

      let status: string;
      let timeRemaining: string;

      if (!electionConfig.isActive) {
        status = 'Inactive';
        timeRemaining = 'Election Disabled';
      } else if (now < startTime) {
        status = 'Scheduled';
        timeRemaining = formatTimeRemaining(startTime.getTime() - now.getTime()) + ' until start';
      } else if (now > endTime) {
        status = 'Ended';
        timeRemaining = 'Election Ended';
      } else {
        status = 'Active';
        timeRemaining = formatTimeRemaining(endTime.getTime() - now.getTime()) + ' remaining';
      }

      setStatusInfo({ status, timeRemaining });
    } catch (error) {
      console.error('Error loading election status:', error);
      toast.error('Error loading election status');
    }
  };

  const loadElectionStats = async () => {
    try {
      const [usersSnap, votesSnap, positionsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'votes')),
        getDocs(collection(db, 'positions'))
      ]);

      const totalUsers = usersSnap.size;
      const totalVotes = votesSnap.size;

      const votes: any[] = [];
      votesSnap.forEach(doc => votes.push(doc.data()));
      const uniqueVoters = new Set(votes.map(vote => vote.voter_id)).size;

      const turnoutRate = totalUsers > 0 ? ((uniqueVoters / totalUsers) * 100).toFixed(1) : 0;

      setStats({
        totalUsers,
        votesCast: totalVotes,
        turnoutRate: Number(turnoutRate),
        positions: positionsSnap.size
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newConfig: ElectionConfig = {
      startTime: new Date(formData.startTime).toISOString(),
      endTime: new Date(formData.endTime).toISOString(),
      isActive: formData.isActive,
      allowLateVoting: formData.allowLateVoting
    };

    const startTime = new Date(newConfig.startTime);
    const endTime = new Date(newConfig.endTime);

    if (startTime >= endTime) {
      toast.error('End time must be after start time');
      return;
    }

    try {
      const success = await updateElectionConfig(newConfig);
      if (success) {
        toast.success('Election configuration updated successfully');
        loadElectionStatus();
      } else {
        toast.error('Failed to update election configuration');
      }
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Error updating configuration');
    }
  };

  const startElectionNow = async () => {
    const now = new Date();
    const endTime = new Date(now.getTime() + (24 * 60 * 60 * 1000));

    const newConfig: ElectionConfig = {
      startTime: now.toISOString(),
      endTime: endTime.toISOString(),
      isActive: true,
      allowLateVoting: false
    };

    try {
      const success = await updateElectionConfig(newConfig);
      if (success) {
        toast.success('Election started successfully!');
        loadElectionStatus();
      } else {
        toast.error('Failed to start election');
      }
    } catch (error) {
      console.error('Error starting election:', error);
      toast.error('Error starting election');
    }
  };

  const extendElection = async () => {
    if (!config) {
      toast.error('No election configuration found');
      return;
    }

    const currentEndTime = new Date(config.endTime);
    const newEndTime = new Date(currentEndTime.getTime() + (1 * 60 * 60 * 1000));

    const updatedConfig: ElectionConfig = {
      ...config,
      endTime: newEndTime.toISOString()
    };

    try {
      const success = await updateElectionConfig(updatedConfig);
      if (success) {
        toast.success('Election extended by 1 hour');
        loadElectionStatus();
      } else {
        toast.error('Failed to extend election');
      }
    } catch (error) {
      console.error('Error extending election:', error);
      toast.error('Error extending election');
    }
  };

  const stopElection = async () => {
    if (!confirm('Are you sure you want to stop the election? This action cannot be undone.')) {
      return;
    }

    if (!config) {
      toast.error('No election configuration found');
      return;
    }

    const updatedConfig: ElectionConfig = {
      ...config,
      isActive: false,
      endTime: new Date().toISOString()
    };

    try {
      const success = await updateElectionConfig(updatedConfig);
      if (success) {
        toast.success('Election stopped successfully');
        loadElectionStatus();
      } else {
        toast.error('Failed to stop election');
      }
    } catch (error) {
      console.error('Error stopping election:', error);
      toast.error('Error stopping election');
    }
  };

  const formatDateTimeLocal = (date: Date): string => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 16);
  };

  const formatTimeRemaining = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  return (
    <div className="bg-gradient-to-br from-green-50 via-white to-green-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Image src="/NACOS.png" alt="NACOS Logo" width={80} height={80} className="mx-auto mb-4 drop-shadow-lg" unoptimized />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Election Admin Panel</h1>
          <p className="text-gray-600">Manage election timing and settings</p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Current Status */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              Current Election Status
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="font-medium">Election Status</span>
                <span className="text-gray-700">{statusInfo.status}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="font-medium">Time Remaining</span>
                <span className="text-gray-700">{statusInfo.timeRemaining}</span>
              </div>
            </div>
          </div>

          {/* Election Timing Controls */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-green-600" />
              Election Timing Settings
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                    Election Start Time
                  </label>
                  <input
                    type="datetime-local"
                    id="startTime"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                    Election End Time
                  </label>
                  <input
                    type="datetime-local"
                    id="endTime"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Election Active</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.allowLateVoting}
                    onChange={(e) => setFormData({ ...formData, allowLateVoting: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Allow Late Voting</span>
                </label>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Update Settings
                </button>

                <button
                  type="button"
                  onClick={loadElectionStatus}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Status
                </button>
              </div>
            </form>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-600" />
              Quick Actions
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={startElectionNow}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Now
              </button>

              <button
                onClick={extendElection}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Extend 1 Hour
              </button>

              <button
                onClick={stopElection}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <StopCircle className="w-4 h-4" />
                Stop Election
              </button>
            </div>
          </div>

          {/* Election Statistics */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart className="w-5 h-5 text-green-600" />
              Election Statistics
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Total Users</p>
                <p className="text-2xl font-bold text-green-800">{stats.totalUsers}</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Votes Cast</p>
                <p className="text-2xl font-bold text-blue-800">{stats.votesCast}</p>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-600 font-medium">Turnout Rate</p>
                <p className="text-2xl font-bold text-yellow-800">{stats.turnoutRate}%</p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">Positions</p>
                <p className="text-2xl font-bold text-purple-800">{stats.positions}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
