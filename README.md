# NACOS Rivers Voting Portal - Next.js

This is a Next.js conversion of the NACOS Rivers voting portal application with Firebase backend.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

Create a `.env.local` file in the root directory with your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Login page
│   ├── globals.css        # Global styles
│   ├── voting/            # Voting page
│   ├── results/           # Results page
│   └── admin/             # Admin panel
├── components/            # Reusable React components
│   ├── Navigation.tsx
│   ├── CountdownTimer.tsx
│   └── VoteCard.tsx
├── lib/                   # Utility libraries
│   └── firebase.ts        # Firebase configuration and functions
├── public/                # Static assets
│   └── NACOS.png
└── package.json
```

## Features

- 🔐 Secure voter authentication
- 🗳️ Real-time voting system
- 📊 Live election results
- ⚙️ Admin panel for election management
- 📱 Fully responsive design
- 🔥 Firebase Firestore backend
- ⚡ Built with Next.js 14 and TypeScript

## Technology Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Firebase Firestore
- **UI Icons**: Lucide React
- **Notifications**: React Hot Toast

## License

Private - NACOS Rivers State Chapter
