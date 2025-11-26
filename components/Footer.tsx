'use client';

interface FooterProps {
  className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
  return (
    <footer className={`bg-gray-900 text-white py-8 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="text-xl font-bold">NACOS Rivers State</span>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Nigerian Association of Computing Students - Rivers State Chapter
          </p>
          <div className="border-t border-gray-700 pt-4">
            <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
              Powered by Team at 
              <a 
                href="https://instagram.com/useqitt" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 font-medium transition-colors"
              >
                @useqitt
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}