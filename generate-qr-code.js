// Generate a QR code for accessing the student interface
import QRCode from 'qrcode';
import fs from 'fs';

// Get the Replit URL from the current workspace browser URL
const url = 'https://34522ab7-4880-49aa-98ce-1ae5e45aa9cc-00-67qrwrk3v299.picard.replit.dev';
const studentUrl = `${url}/client/public/simple-student.html`;

console.log('Generating QR code for URL:', studentUrl);

// Generate QR code as a data URL
QRCode.toDataURL(studentUrl, {
  errorCorrectionLevel: 'H',
  margin: 1,
  width: 400,
  color: {
    dark: '#000000',
    light: '#ffffff'
  }
}, (err, dataUrl) => {
  if (err) {
    console.error('Error generating QR code:', err);
    return;
  }
  
  // Remove data URL prefix to get only base64 content
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  
  // Save QR code as PNG
  fs.writeFileSync('student-interface-qr.png', Buffer.from(base64Data, 'base64'));
  
  console.log('QR code saved as student-interface-qr.png');
  console.log('Student interface URL:', studentUrl);
});