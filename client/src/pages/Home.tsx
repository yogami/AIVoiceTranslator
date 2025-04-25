import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Home: React.FC = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-500 to-green-500 text-transparent bg-clip-text">
          AIVoiceTranslator
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardHeader>
              <CardTitle>Teacher Interface</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">For teachers who want to broadcast their speech for translation.</p>
              <Link to="/teacher">
                <Button className="w-full">Go to Teacher Interface</Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Student Interface</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">For students who want to hear translations in their preferred language.</p>
              <Link to="/student">
                <Button className="w-full">Go to Student Interface</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>About AIVoiceTranslator</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              AIVoiceTranslator is a real-time classroom translation system that captures a teacher's speech,
              translates it into multiple languages, and delivers it to students with minimal latency.
            </p>
            <p>
              This creates an inclusive learning environment where students can learn in their preferred language
              while preserving the emotional tone of the teacher's delivery.
            </p>
          </CardContent>
        </Card>
        
        <div className="text-center">
          <Link to="/guide">
            <Button variant="outline">View Usage Guide</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;