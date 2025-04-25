import React from 'react';
import { Link } from 'wouter';
import { Button } from '../components/ui/button';

const NotFound: React.FC = () => {
  return (
    <div className="container flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-extrabold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-6">Page Not Found</h2>
        <p className="text-gray-500 mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button>
            Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;