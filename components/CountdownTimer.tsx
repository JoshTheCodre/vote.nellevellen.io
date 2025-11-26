'use client';

import { useEffect, useState } from 'react';
import { getElectionConfig, ElectionConfig } from '@/lib/firebase';

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState<string>('Loading...');
  const [config, setConfig] = useState<ElectionConfig | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const electionConfig = await getElectionConfig();
      setConfig(electionConfig);
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (!config?.endTime) {
      setTimeLeft('NOT CONFIGURED');
      return;
    }

    const electionEndTime = new Date(config.endTime).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const timeDiff = electionEndTime - now;

      if (timeDiff <= 0) {
        setTimeLeft('ELECTION ENDED');
        return;
      }

      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [config]);

  return (
    <div className="bg-green-50 px-6 py-3 rounded-full border border-green-200">
      <p className="text-sm text-gray-600">Election Ends In</p>
      <p className="text-2xl font-bold text-green-600">{timeLeft}</p>
    </div>
  );
}
