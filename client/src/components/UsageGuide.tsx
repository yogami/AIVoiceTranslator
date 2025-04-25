import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, Smartphone, Globe, Headphones, Settings, Volume2, CheckCircle2 } from 'lucide-react';

const UsageGuide: React.FC = () => {
  return (
    <Card className="bg-white border shadow-sm">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4">How to Use AIVoiceTranslator</h2>
        
        <div className="mb-6 text-sm text-gray-600">
          Follow these steps to use our lightweight multilingual classroom translation system:
        </div>
        
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">1. Choose the Right Interface</h3>
              <p className="text-sm text-gray-600 mt-1">
                Use the <strong>Teacher Interface</strong> on your computer to speak and broadcast.
                Share the <strong>Student Interface</strong> with students to receive translations.
              </p>
            </div>
          </div>
          
          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">2. Allow Microphone Access</h3>
              <p className="text-sm text-gray-600 mt-1">
                When prompted in the Teacher Interface, click "Allow" to grant microphone permissions.
                This is necessary for capturing your speech.
              </p>
            </div>
          </div>
          
          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">3. Select Languages</h3>
              <p className="text-sm text-gray-600 mt-1">
                Teachers: Use English (en-US) as your input language.
                Students: Select your preferred language for receiving translations (Spanish, German, etc.).
              </p>
            </div>
          </div>
          
          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Volume2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">4. Start Speaking (Teacher)</h3>
              <p className="text-sm text-gray-600 mt-1">
                In the Teacher Interface, click "Start Recording" and speak clearly.
                Your speech will be automatically transcribed and sent to students.
              </p>
            </div>
          </div>
          
          {/* Step 5 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">5. Receive Translations (Student)</h3>
              <p className="text-sm text-gray-600 mt-1">
                Students will see both the original English text and the translated text
                in their chosen language in real time.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-8 bg-blue-50 p-4 rounded-md border border-blue-100">
          <h3 className="font-medium text-blue-700 mb-2 flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Troubleshooting Tips
          </h3>
          <ul className="list-disc pl-5 text-sm space-y-1 text-gray-700">
            <li>If the microphone doesn't work, check browser permissions</li>
            <li>For best results, use Chrome on desktop for the Teacher Interface</li>
            <li>Ensure your internet connection is stable</li>
            <li>If translations are delayed, try speaking more slowly</li>
            <li>Make sure your OpenAI API key is correctly configured</li>
            <li>If connections drop, refresh the page to reconnect automatically</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default UsageGuide;