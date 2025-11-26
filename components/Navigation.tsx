'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { markUserAsVoted } from '@/lib/firebase';

interface NavigationProps {
  userAvatar?: string;
  showResults?: boolean;
}

export default function Navigation({ userAvatar, showResults = true }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  console.log('Navigation - userAvatar prop:', userAvatar);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout? You will be marked as voted and cannot login again.')) {
      const voterId = sessionStorage.getItem('voterId');
      if (voterId) {
        try {
          await markUserAsVoted(voterId);
        } catch (error) {
          console.error('Error marking user as voted:', error);
        }
      }
      sessionStorage.clear();
      router.push('/');
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white/95 border-b border-gray-200 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900 hover:text-green-600 transition flex-shrink-0">
            <Image 
              src="/NACOS.png" 
              alt="NACOS Logo" 
              width={40} 
              height={40} 
              className="rounded-full drop-shadow object-cover"
            />
            <span>NACOS Rivers</span>
          </Link>
          
          <div className="hidden md:flex gap-8 items-center flex-1 justify-center">
            <Link 
              href="/voting" 
              className={`font-medium pb-1 border-b-2 whitespace-nowrap ${
                pathname === '/voting' 
                  ? 'text-gray-900 border-green-600' 
                  : 'text-gray-700 border-transparent hover:border-green-600'
              } transition-colors duration-200`}
            >
              Vote
            </Link>
            {showResults && (
              <Link 
                href="/results" 
                className={`font-medium pb-1 border-b-2 whitespace-nowrap ${
                  pathname === '/results' 
                    ? 'text-gray-900 border-green-600' 
                    : 'text-gray-700 border-transparent hover:border-green-600'
                } transition-colors duration-200`}
              >
                Live Results
              </Link>
            )}
          </div>
          
          {userAvatar && (
            <div className="hidden md:flex items-center gap-4 ml-auto flex-shrink-0">
              <Image 
                src={userAvatar} 
                alt="User Avatar" 
                width={40} 
                height={40} 
                className="rounded-full border-2 border-green-600 shadow-lg"
                unoptimized
              />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          )}
          
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-gray-900 hover:bg-gray-100 p-2 rounded-lg transition"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/90 px-4 py-3 border-t border-gray-200">
          {userAvatar && (
            <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <Image
                  src={userAvatar}
                  alt="User Avatar"
                  width={40}
                  height={40}
                  className="rounded-full border-2 border-green-600"
                  unoptimized
                />
                <span className="text-sm font-medium text-gray-900">
                  {sessionStorage.getItem('voterId')}
                </span>
              </div>
            </div>
          )}
          <Link 
            href="/voting" 
            className="block py-2.5 text-gray-900 hover:text-green-600 transition font-medium"
            onClick={() => setMobileMenuOpen(false)}
          >
            Vote
          </Link>
          {showResults && (
            <Link 
              href="/results" 
              className="block py-2.5 text-gray-700 hover:text-green-600 transition font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Live Results
            </Link>
          )}
          {userAvatar && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-2 py-2.5 text-red-600 hover:text-red-700 transition font-medium w-full"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
