import React from 'react';
import { Link } from "wouter";
import UsageGuide from '@/components/UsageGuide';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen } from 'lucide-react';

const UsageGuidePage: React.FC = () => {
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <header className="bg-white shadow-sm p-4">
        <div className="container mx-auto">
          <h1 className="text-xl font-bold text-primary">Benedictaitor</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="mb-4 flex items-center">
          <Link href="/">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-primary ml-4 flex items-center">
            <BookOpen className="h-5 w-5 mr-2" />
            Usage Guide
          </h1>
        </div>
        
        <UsageGuide />
        
        <div className="mt-6 flex justify-center">
          <Link href="/">
            <Button size="lg" className="font-medium">
              Return to Home
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default UsageGuidePage;