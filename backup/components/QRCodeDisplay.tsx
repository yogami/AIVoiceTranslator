import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, QrCode } from 'lucide-react';

interface QRCodeDisplayProps {
  url: string;
  title?: string;
  description?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ 
  url, 
  title = "Scan QR Code", 
  description = "Scan this code with your phone to open the interface." 
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateQRCode(url);
  }, [url]);

  const generateQRCode = async (text: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        width: 250,
        margin: 1,
        color: {
          dark: '#000',
          light: '#fff'
        }
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  };

  const copyUrlToClipboard = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Error copying to clipboard:', err);
    });
  };

  return (
    <Card className="bg-white border-2 border-primary/10 overflow-hidden">
      <CardContent className="p-4 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-3">
          <QrCode className="h-5 w-5 text-primary" />
          <h3 className="font-medium text-lg">{title}</h3>
        </div>
        
        <p className="text-sm text-gray-600 text-center mb-4">
          {description}
        </p>
        
        <div className="bg-white p-3 rounded-lg border mb-3">
          {qrDataUrl ? (
            <img 
              src={qrDataUrl} 
              alt="QR Code" 
              className="w-[200px] h-[200px]" 
            />
          ) : (
            <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100">
              Generating QR Code...
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
          <span className="font-medium">URL:</span>
          <span className="truncate max-w-[240px]">{url}</span>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full flex items-center justify-center gap-2"
          onClick={copyUrlToClipboard}
        >
          <Copy className="h-4 w-4" />
          {copied ? 'Copied!' : 'Copy URL'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default QRCodeDisplay;