'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clock, Settings, Zap, BarChart, Play, StopCircle, RefreshCw, Save, Plus, Edit2, Trash2, Users, ClipboardList, Download, ExternalLink } from 'lucide-react';
import Footer from '@/components/Footer';
import { 
  getElectionConfig, 
  updateElectionConfig, 
  isElectionActive,
  ElectionConfig,
  getPositions,
  getAllCandidates,
  Position,
  Candidate,
  addCandidate,
  updateCandidate,
  deleteCandidate,
  addPosition,
  updatePosition,
  deletePosition
} from '@/lib/firebase';
import { collection, getDocs, onSnapshot, query } from 'firebase/firestore';
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

  // Admin authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Candidate management state
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [candidateForm, setCandidateForm] = useState({
    name: '',
    position_id: ''
  });

  // Position management state
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionForm, setPositionForm] = useState({
    title: '',
    order: 0
  });
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());

  // Verify admin key
  const verifyAdminKey = async () => {
    if (!adminKeyInput.trim()) {
      toast.error('Please enter an admin key');
      return;
    }

    setIsVerifying(true);
    try {
      const adminDoc = await getDocs(collection(db, 'admin'));
      let storedKey = '';
      
      adminDoc.forEach(doc => {
        if (doc.id === 'access_key') {
          storedKey = doc.data().key;
        }
      });

      if (adminKeyInput === storedKey) {
        setIsAuthenticated(true);
        toast.success('Access granted!');
      } else {
        toast.error('Invalid admin key');
      }
    } catch (error) {
      console.error('Error verifying key:', error);
      toast.error('Error verifying admin key');
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    loadElectionStatus();
    loadElectionStats();
    loadPositionsAndCandidates();

    // Real-time listeners for candidates and positions
    const candidatesQuery = query(collection(db, 'candidates'));
    const positionsQuery = query(collection(db, 'positions'));

    const unsubscribeCandidates = onSnapshot(candidatesQuery, (snapshot) => {
      const candidatesData: Candidate[] = [];
      snapshot.forEach(doc => {
        candidatesData.push({ id: doc.id, ...doc.data() } as Candidate);
      });
      setCandidates(candidatesData);
    });

    const unsubscribePositions = onSnapshot(positionsQuery, (snapshot) => {
      const positionsData: Position[] = [];
      snapshot.forEach(doc => {
        positionsData.push({ id: doc.id, ...doc.data() } as Position);
      });
      setPositions(positionsData.sort((a, b) => a.order - b.order));
    });

    const interval = setInterval(() => {
      loadElectionStatus();
      loadElectionStats();
    }, 30000);

    return () => {
      clearInterval(interval);
      unsubscribeCandidates();
      unsubscribePositions();
    };
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

  const loadPositionsAndCandidates = async () => {
    try {
      const [positionsData, candidatesData] = await Promise.all([
        getPositions(),
        getAllCandidates()
      ]);
      setPositions(positionsData);
      setCandidates(candidatesData);
    } catch (error) {
      console.error('Error loading positions and candidates:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!confirm('Are you sure you want to update the election settings?')) {
      return;
    }

    const newConfig: ElectionConfig = {
      startTime: new Date(formData.startTime).toISOString(),
      endTime: new Date(formData.endTime).toISOString(),
      isActive: true,
      allowLateVoting: false
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
    if (!confirm('Are you sure you want to start the election now?')) {
      return;
    }

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

    if (!confirm('Are you sure you want to extend the election by 10 minutes?')) {
      return;
    }

    const currentEndTime = new Date(config.endTime);
    const newEndTime = new Date(currentEndTime.getTime() + (10 * 60 * 1000));

    const updatedConfig: ElectionConfig = {
      ...config,
      endTime: newEndTime.toISOString()
    };

    try {
      const success = await updateElectionConfig(updatedConfig);
      if (success) {
        toast.success('Election extended by 10 minutes');
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

  // Candidate management functions
  const openAddCandidate = () => {
    setEditingCandidate(null);
    setCandidateForm({ name: '', position_id: '' });
    setShowCandidateModal(true);
  };

  const openEditCandidate = (candidate: Candidate) => {
    setEditingCandidate(candidate);
    setCandidateForm({ name: candidate.name, position_id: candidate.position_id });
    setShowCandidateModal(true);
  };

  const handleCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!candidateForm.name.trim() || !candidateForm.position_id) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      let success;
      if (editingCandidate) {
        success = await updateCandidate(editingCandidate.id, candidateForm.name.trim(), candidateForm.position_id);
        if (success) {
          toast.success('Candidate updated successfully');
        }
      } else {
        success = await addCandidate(candidateForm.name.trim(), candidateForm.position_id);
        if (success) {
          toast.success('Candidate added successfully');
        }
      }

      if (success) {
        setShowCandidateModal(false);
        setCandidateForm({ name: '', position_id: '' });
        setEditingCandidate(null);
      } else {
        toast.error('Failed to save candidate');
      }
    } catch (error) {
      console.error('Error saving candidate:', error);
      toast.error('Error saving candidate');
    }
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Are you sure you want to delete ${candidateName}?`)) {
      return;
    }

    try {
      const success = await deleteCandidate(candidateId);
      if (success) {
        toast.success('Candidate deleted successfully');
      } else {
        toast.error('Failed to delete candidate');
      }
    } catch (error) {
      console.error('Error deleting candidate:', error);
      toast.error('Error deleting candidate');
    }
  };

  // Toggle position expansion
  const togglePosition = (positionId: string) => {
    const newExpanded = new Set(expandedPositions);
    if (newExpanded.has(positionId)) {
      newExpanded.delete(positionId);
    } else {
      newExpanded.add(positionId);
    }
    setExpandedPositions(newExpanded);
  };

  // Position management functions
  const openAddPosition = () => {
    setEditingPosition(null);
    const maxOrder = positions.length > 0 ? Math.max(...positions.map(p => p.order)) : 0;
    setPositionForm({ title: '', order: maxOrder + 1 });
    setShowPositionModal(true);
  };

  const openEditPosition = (position: Position) => {
    setEditingPosition(position);
    setPositionForm({ title: position.title, order: position.order });
    setShowPositionModal(true);
  };

  const handlePositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!positionForm.title.trim()) {
      toast.error('Please enter a position title');
      return;
    }

    try {
      let success;
      if (editingPosition) {
        success = await updatePosition(editingPosition.id, positionForm.title.trim(), positionForm.order);
        if (success) {
          toast.success('Position updated successfully');
        }
      } else {
        success = await addPosition(positionForm.title.trim(), positionForm.order);
        if (success) {
          toast.success('Position added successfully');
        }
      }

      if (success) {
        setShowPositionModal(false);
        setPositionForm({ title: '', order: 0 });
        setEditingPosition(null);
      } else {
        toast.error('Failed to save position');
      }
    } catch (error) {
      console.error('Error saving position:', error);
      toast.error('Error saving position');
    }
  };

  const handleDeletePosition = async (positionId: string, positionTitle: string) => {
    const positionCandidates = candidates.filter(c => c.position_id === positionId);
    const candidateCount = positionCandidates.length;
    
    const confirmMessage = candidateCount > 0
      ? `Are you sure you want to delete "${positionTitle}"?\n\nWARNING: This will also delete ${candidateCount} candidate${candidateCount > 1 ? 's' : ''} in this position:\n${positionCandidates.map(c => '• ' + c.name).join('\n')}\n\nThis action cannot be undone.`
      : `Are you sure you want to delete "${positionTitle}"?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // Delete all candidates in this position first
      if (candidateCount > 0) {
        const deletePromises = positionCandidates.map(candidate => 
          deleteCandidate(candidate.id)
        );
        await Promise.all(deletePromises);
      }

      // Then delete the position
      const success = await deletePosition(positionId);
      if (success) {
        toast.success(`Position and ${candidateCount} candidate${candidateCount > 1 ? 's' : ''} deleted successfully`);
      } else {
        toast.error('Failed to delete position');
      }
    } catch (error) {
      console.error('Error deleting position:', error);
      toast.error('Error deleting position');
    }
  };

  // Download results as CSV
  const downloadResults = async () => {
    try {
      toast.loading('Generating PDF...');
      
      // Dynamically import jsPDF (client-side only)
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      // Fetch all votes
      const votesSnap = await getDocs(collection(db, 'votes'));
      const votes: any[] = [];
      votesSnap.forEach(doc => votes.push(doc.data()));

      // Filter out PASS votes and count
      const validVotes = votes.filter(vote => vote.candidate_id !== 'PASS');
      const voteCount: Record<string, number> = {};
      validVotes.forEach(vote => {
        voteCount[vote.candidate_id] = (voteCount[vote.candidate_id] || 0) + 1;
      });

      // Create PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Load and prepare logo for letterhead and watermark
      let logoImageData = '';
      try {
        // Convert the public image to base64 for embedding
        const response = await fetch('/NACOS.png');
        const blob = await response.blob();
        const reader = new FileReader();
        
        logoImageData = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        // Add letterhead logo on first page (centered at top)
        doc.addImage(logoImageData, 'PNG', pageWidth / 2 - 15, 10, 30, 30);
      } catch (e) {
        console.error('Failed to load logo:', e);
      }
      
      // Function to add watermark to current page
      const addWatermark = () => {
        if (logoImageData) {
          doc.saveGraphicsState();
          doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
          // Center watermark (larger, faded)
          const watermarkSize = 80;
          doc.addImage(
            logoImageData,
            'PNG',
            pageWidth / 2 - watermarkSize / 2,
            pageHeight / 2 - watermarkSize / 2,
            watermarkSize,
            watermarkSize
          );
          doc.restoreGraphicsState();
        }
      };
      
      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('NACOS RIVERS STATE', pageWidth / 2, 50, { align: 'center' });
      doc.setFontSize(16);
      doc.text('Election Results', pageWidth / 2, 58, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 65, { align: 'center' });
      
      // Add a line separator
      doc.setLineWidth(0.5);
      doc.line(20, 70, pageWidth - 20, 70);
      
      let yPosition = 80;
      
      // Add results for each position
      positions.forEach((position, index) => {
        const positionCandidates = candidates.filter(c => c.position_id === position.id);
        const positionVotes = validVotes.filter(v => v.position_id === position.id).length;
        
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Position title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${position.title}`, 20, yPosition);
        yPosition += 8;
        
        // Sort candidates by vote count
        const sortedCandidates = positionCandidates
          .map(candidate => ({
            name: candidate.name,
            votes: voteCount[candidate.id] || 0,
            percentage: positionVotes > 0 ? ((voteCount[candidate.id] || 0) / positionVotes * 100).toFixed(1) + '%' : '0.0%'
          }))
          .sort((a, b) => b.votes - a.votes);
        
        // Create table
        autoTable(doc, {
          startY: yPosition,
          head: [['Candidate', 'Votes', 'Percentage']],
          body: sortedCandidates.map(c => [c.name, c.votes.toString(), c.percentage]),
          foot: [[`Total Votes: ${positionVotes}`, '', '']],
          theme: 'grid',
          headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
          footStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: 'bold' },
          margin: { left: 20, right: 20 },
          styles: { fontSize: 10 }
        });
        
        yPosition = (doc as any).lastAutoTable.finalY + 10;
        
        // Add watermark after table (so it appears on top)
        addWatermark();
      });
      
      // Summary statistics
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Election Summary', 20, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Registered Voters: ${stats.totalUsers}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Total Votes Cast: ${stats.votesCast}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Voter Turnout: ${stats.turnoutRate}%`, 20, yPosition);
      
      // Add final watermark to last page
      addWatermark();
      
      // Save PDF
      doc.save(`nacos-election-results-${new Date().toISOString().split('T')[0]}.pdf`);

      toast.dismiss();
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error downloading results:', error);
      toast.dismiss();
      toast.error('Failed to download PDF');
    }
  };

  return (
    <div className="bg-gradient-to-br from-green-50 via-white to-green-50 min-h-screen">
      {!isAuthenticated ? (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <Image src="/NACOS.png" alt="NACOS Logo" width={80} height={80} className="rounded-full shadow-lg" unoptimized />
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Portal</h1>
              <p className="text-gray-600">Enter your admin key to continue</p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="adminKey" className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Key
                </label>
                <input
                  type="password"
                  id="adminKey"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && verifyAdminKey()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Enter admin key"
                  disabled={isVerifying}
                />
              </div>

              <button
                onClick={verifyAdminKey}
                disabled={isVerifying}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-md hover:shadow-lg"
              >
                {isVerifying ? 'Verifying...' : 'Access Admin Panel'}
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-6">
              🔒 Admin key can only be changed in Firestore database
            </p>
          </div>
        </div>
      ) : (
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Image src="/NACOS.png" alt="NACOS Logo" width={80} height={80} className="mx-auto mb-4 drop-shadow-lg" unoptimized />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Election Admin Panel</h1>
          <p className="text-gray-600">Manage election timing and settings</p>
          
          {/* Quick Actions Bar */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/results"
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-green-500 text-green-700 rounded-lg hover:bg-green-50 transition-all duration-200 font-medium shadow-sm hover:shadow-md group"
            >
              <BarChart className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>View Live Results</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            
            <button
              onClick={downloadResults}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md group"
            >
              <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
              <span>Download Results</span>
            </button>
          </div>
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
                Extend 10 Minutes
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

          {/* Position and Candidate Management - Unified */}
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-green-600" />
                Manage Positions & Candidates
              </h2>
              <button
                onClick={openAddPosition}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Position
              </button>
            </div>

            <div className="space-y-3">
              {positions.map((position) => {
                const positionCandidates = candidates.filter(c => c.position_id === position.id);
                const isExpanded = expandedPositions.has(position.id);
                
                return (
                  <div key={position.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Position Header */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <button
                        onClick={() => togglePosition(position.id)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <svg
                          className={`w-5 h-5 text-gray-600 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div>
                          <p className="font-semibold text-gray-800">{position.title}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                              </svg>
                              Order {position.order}
                            </span>
                            <span>•</span>
                            <span>{positionCandidates.length} candidate{positionCandidates.length !== 1 ? 's' : ''}</span>
                          </p>
                        </div>
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditPosition(position)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit Position"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePosition(position.id, position.title)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Position"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Candidates List - Collapsible */}
                    {isExpanded && (
                      <div className="bg-white border-t border-gray-200">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                              <Users className="w-4 h-4 text-green-600" />
                              Candidates in this Position
                            </h3>
                            <button
                              onClick={() => {
                                setEditingCandidate(null);
                                setCandidateForm({ name: '', position_id: position.id });
                                setShowCandidateModal(true);
                              }}
                              className="text-sm bg-green-100 hover:bg-green-200 text-green-700 font-medium py-1 px-3 rounded-md transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Candidate
                            </button>
                          </div>

                          {positionCandidates.length > 0 ? (
                            <div className="space-y-2">
                              {positionCandidates.map((candidate) => (
                                <div
                                  key={candidate.id}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-100"
                                >
                                  <p className="font-medium text-gray-800">{candidate.name}</p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => openEditCandidate(candidate)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="Edit Candidate"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCandidate(candidate.id, candidate.name)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="Delete Candidate"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-center text-gray-500 text-sm py-4">
                              No candidates in this position yet
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {positions.length === 0 && (
                <p className="text-center text-gray-500 py-8">No positions available. Create one to get started!</p>
              )}
            </div>
          </div>
        </div>
      
      {/* Candidate Modal */}
      {showCandidateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              {editingCandidate ? 'Edit Candidate' : 'Add New Candidate'}
            </h3>
            <form onSubmit={handleCandidateSubmit} className="space-y-4">
              <div>
                <label htmlFor="candidateName" className="block text-sm font-medium text-gray-700 mb-2">
                  Candidate Name
                </label>
                <input
                  type="text"
                  id="candidateName"
                  value={candidateForm.name}
                  onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Enter candidate name"
                  required
                />
              </div>

              <div>
                <label htmlFor="positionSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Position
                </label>
                <select
                  id="positionSelect"
                  value={candidateForm.position_id}
                  onChange={(e) => setCandidateForm({ ...candidateForm, position_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="">-- Select Position --</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  {editingCandidate ? 'Update' : 'Add'} Candidate
                </button>
                <button
                  type="button"
                  onClick={() => setShowCandidateModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Position Modal */}
      {showPositionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              {editingPosition ? 'Edit Position' : 'Add New Position'}
            </h3>
            <form onSubmit={handlePositionSubmit} className="space-y-4">
              <div>
                <label htmlFor="positionTitle" className="block text-sm font-medium text-gray-700 mb-2">
                  Position Title
                </label>
                <input
                  type="text"
                  id="positionTitle"
                  value={positionForm.title}
                  onChange={(e) => setPositionForm({ ...positionForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g. President, Vice President"
                  required
                />
              </div>

              <div>
                <label htmlFor="positionOrder" className="block text-sm font-medium text-gray-700 mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  id="positionOrder"
                  value={positionForm.order}
                  onChange={(e) => setPositionForm({ ...positionForm, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  min="1"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  {editingPosition ? 'Update' : 'Add'} Position
                </button>
                <button
                  type="button"
                  onClick={() => setShowPositionModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <Footer />
      </div>
      )}
    </div>
  );
}
