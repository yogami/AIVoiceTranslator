import WebSocket from 'ws';

// This test creates both a teacher and student connection to test the complete flow
const wsUrl = 'ws://localhost:5000/ws';
const teacherWs = new WebSocket(wsUrl);
let studentWs;

teacherWs.on('open', function open() {
  console.log('TEACHER: Connected to WebSocket server');
  
  // Register as teacher with explicit browser TTS preference
  const registerMessage = {
    type: 'register',
    role: 'teacher',
    languageCode: 'en-US',
    settings: {
      ttsServiceType: 'browser' // Explicitly request browser TTS
    }
  };
  
  teacherWs.send(JSON.stringify(registerMessage));
  console.log('TEACHER: Sent register message with browser TTS preference');
  
  // Now connect a student in a different language
  console.log('Creating student connection...');
  studentWs = new WebSocket(wsUrl);
  
  studentWs.on('open', function() {
    console.log('STUDENT: Connected to WebSocket server');
    
    // Register as student with Spanish language
    const studentRegister = {
      type: 'register',
      role: 'student',
      languageCode: 'es' // Spanish
    };
    
    studentWs.send(JSON.stringify(studentRegister));
    console.log('STUDENT: Sent register message for Spanish language');
    
    // After student is connected, teacher sends a transcription
    setTimeout(() => {
      console.log('TEACHER: Sending transcription message...');
      
      // Now send a transcription
      const transcriptionMessage = {
        type: 'transcription',
        text: 'This is a test transcription that should use browser TTS service',
      };
      
      teacherWs.send(JSON.stringify(transcriptionMessage));
      console.log('TEACHER: Sent test transcription that should use browser TTS');
      
      // Allow more time for the server to process before closing
      setTimeout(() => {
        teacherWs.close();
        console.log('TEACHER: Connection closed');
        
        // Give a bit more time for the student to receive translation
        setTimeout(() => {
          if (studentWs) {
            studentWs.close();
            console.log('STUDENT: Connection closed');
          }
          console.log('Test completed');
        }, 1000);
      }, 3000);
    }, 1000);
  });
  
  studentWs.on('message', function incoming(data) {
    const message = JSON.parse(data);
    console.log('STUDENT RECEIVED:', message);
    
    // Check if we received a translation with the correct TTS service type
    if (message.type === 'translation') {
      console.log('🔍 CHECKING TRANSLATION:');
      console.log(`- TTS Service Type: ${message.ttsServiceType}`);
      console.log(`- useClientSpeech: ${message.useClientSpeech}`);
      console.log(`- Has speechParams: ${message.speechParams ? 'YES' : 'NO'}`);
      if (message.speechParams) {
        console.log(`- speechParams: ${JSON.stringify(message.speechParams)}`);
      }
      console.log(`- Has audioData: ${message.audioData ? 'YES' : 'NO'}`);
    }
  });
  
  studentWs.on('error', function(err) {
    console.error('STUDENT WebSocket error:', err);
  });
});

teacherWs.on('message', function incoming(data) {
  const message = JSON.parse(data);
  console.log('TEACHER RECEIVED:', message);
});

teacherWs.on('error', function error(err) {
  console.error('TEACHER WebSocket error:', err);
});