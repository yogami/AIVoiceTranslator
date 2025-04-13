import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, Smartphone, Globe, Headphones, Settings, Volume2, CheckCircle2 } from 'lucide-react';

const UsageGuide: React.FC = () => {
  return (
    <Card className="bg-white border shadow-sm">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4">How to Use Benedictaitor</h2>
        
        <div className="mb-6 text-sm text-gray-600">
          Follow these steps to start using the real-time translation platform:
        </div>
        
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">1. Allow Microphone Access</h3>
              <p className="text-sm text-gray-600 mt-1">
                When prompted, click "Allow" to grant microphone permissions. 
                This is necessary for capturing your speech in teacher mode.
              </p>
            </div>
          </div>
          
          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">2. Select Your Devices</h3>
              <p className="text-sm text-gray-600 mt-1">
                In Teacher mode, select your preferred microphone from the dropdown.
                In Student mode, ensure your speakers or headphones are working.
              </p>
            </div>
          </div>
          
          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">3. Choose Languages</h3>
              <p className="text-sm text-gray-600 mt-1">
                Teachers: Select your input language (e.g., English).
                Students: Select your preferred language for receiving translations.
              </p>
            </div>
          </div>
          
          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Volume2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">4. Start Broadcasting (Teacher)</h3>
              <p className="text-sm text-gray-600 mt-1">
                Toggle the microphone switch to start recording. Speak clearly 
                and at a moderate pace for best translation results.
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
                Audio translations will play automatically. Use the playback 
                controls to adjust volume or pause audio if needed.
              </p>
            </div>
          </div>
          
          {/* Step 6 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">6. Multi-Device Testing</h3>
              <p className="text-sm text-gray-600 mt-1">
                For testing with multiple devices, use the QR code page to easily
                open the student interface on your phone while using teacher mode
                on your computer.
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
            <li>For best results, use Chrome or Firefox</li>
            <li>Ensure your internet connection is stable</li>
            <li>If translations are delayed, try speaking more slowly</li>
            <li>Make sure your OpenAI API key is correctly configured</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default UsageGuide;