import WebSocket, { WebSocketServer as WSS } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { type AudioSessionManager } from '../services/managers/AudioSessionManager';

class WebSocketServer {
    private wss: WSS;
    private clients: Map<string, WebSocket>;
    private audioSessionManager: AudioSessionManager;

    constructor(wss: WSS, audioSessionManager: AudioSessionManager) {
        this.wss = wss;
        this.clients = new Map();
        this.audioSessionManager = audioSessionManager;

        this.wss.on('connection', (ws: WebSocket) => {
            const wsId = uuidv4();
            this.clients.set(wsId, ws);
            console.log(`New WebSocket connection established with wsId: ${wsId}`);

            ws.on('message', (message: string) => {
                try {
                    const data = JSON.parse(message);
                    const { type, role, classroomCode, language, code } = data;

                    if (type === 'register') {
                        if (role === 'teacher') {
                            const newClassroomCode = this.audioSessionManager.createClassroom(wsId);
                            ws.send(JSON.stringify({ type: 'teacherRegistered', classroomCode: newClassroomCode }));
                            console.log(`Teacher registered for wsId ${wsId}, classroomCode: ${newClassroomCode}`);
                        } else if (role === 'student' && (classroomCode || code)) {
                            const studentClassroomCode = classroomCode || code;
                            console.log(`Student attempting to join classroom ${studentClassroomCode} for wsId ${wsId}`);
                            const result = this.audioSessionManager.addStudentToClassroom(wsId, studentClassroomCode, language || 'N/A');
                            if (result.success) {
                                ws.send(JSON.stringify({ type: 'classroomJoined', classroomCode: studentClassroomCode, teacherLanguage: result.teacherLanguage }));
                                console.log(`Student wsId ${wsId} joined classroom ${studentClassroomCode} with language ${language || 'N/A'}`);
                                const teacherWs = this.clients.get(result.teacherWsId!);
                                if (teacherWs) {
                                    teacherWs.send(JSON.stringify({ type: 'studentJoined', studentId: wsId, studentLanguage: language || 'N/A' }));
                                }
                            } else {
                                ws.send(JSON.stringify({ type: 'error', message: result.error }));
                                console.error(`Student wsId ${wsId} failed to join classroom ${studentClassroomCode}: ${result.error}`);
                            }
                        }
                    } else if (type === 'audioMessage') {
                        console.log(`Received audioMessage from ${wsId} for language ${language}`);
                    } else if (type === 'changeLanguage') {
                        if (role === 'student' && language) {
                            const updateResult = this.audioSessionManager.updateStudentLanguage(wsId, language);
                            if (updateResult.success) {
                                ws.send(JSON.stringify({ type: 'languageChanged', language: language, message: 'Language updated successfully' }));
                                console.log(`Student ${wsId} changed language to ${language}`);
                                if (updateResult.teacherWsId) {
                                    const teacherWs = this.clients.get(updateResult.teacherWsId);
                                    if (teacherWs) {
                                        teacherWs.send(JSON.stringify({ type: 'studentLanguageChanged', studentId: wsId, newLanguage: language }));
                                    }
                                }
                            } else {
                                ws.send(JSON.stringify({ type: 'error', message: updateResult.error }));
                                console.error(`Student ${wsId} failed to change language: ${updateResult.error}`);
                            }
                        }
                    } else {
                        console.log(`Received unknown message type: ${type} from wsId ${wsId}`);
                    }
                } catch (error) {
                    console.error(`Failed to process message from wsId ${wsId}: ${message}. Error: ${(error as Error).message}`);
                }
            });

            ws.on('close', () => {
                console.log(`WebSocket connection closed for wsId: ${wsId}`);
                this.handleDisconnection(wsId);
                this.clients.delete(wsId);
            });

            ws.on('error', (error: Error) => {
                console.error(`WebSocket error for wsId ${wsId}: ${error.message}`);
                this.handleDisconnection(wsId);
                this.clients.delete(wsId);
            });
        });

        console.log('WebSocket server initialized');
    }

    private handleDisconnection(wsId: string): void {
        const sessionInfo = this.audioSessionManager.removeParticipant(wsId);
        if (sessionInfo) {
            console.log(`Participant ${wsId} disconnected from classroom ${sessionInfo.classroomCode}. Role: ${sessionInfo.role}`);
            if (sessionInfo.role === 'student' && sessionInfo.teacherWsId) {
                const teacherWs = this.clients.get(sessionInfo.teacherWsId);
                if (teacherWs) {
                    teacherWs.send(JSON.stringify({ type: 'studentLeft', studentId: wsId }));
                }
            } else if (sessionInfo.role === 'teacher') {
                if (sessionInfo.studentWsIds && sessionInfo.studentWsIds.length > 0) {
                    sessionInfo.studentWsIds.forEach(studentId => {
                        const studentWs = this.clients.get(studentId);
                        if (studentWs) {
                            studentWs.send(JSON.stringify({ type: 'teacherLeft', classroomCode: sessionInfo.classroomCode, message: 'Teacher has left the session.' }));
                        }
                    });
                }
                console.log(`Teacher ${wsId} left, classroom ${sessionInfo.classroomCode} is now closed.`);
            }
        }
    }

    public sendToClient(clientId: string, message: object): boolean {
        const client = this.clients.get(clientId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
            return true;
        }
        console.error(`Failed to send message to client ${clientId}: Client not found or connection not open.`);
        return false;
    }

    public broadcastToClassroom(classroomCode: string, message: object, excludeId?: string): void {
        const classroom = this.audioSessionManager.getClassroom(classroomCode);
        if (classroom) {
            if (classroom.teacherWsId && classroom.teacherWsId !== excludeId) {
                this.sendToClient(classroom.teacherWsId, message);
            }
            classroom.studentSessions.forEach(student => {
                if (student.wsId !== excludeId) {
                    this.sendToClient(student.wsId, message);
                }
            });
        }
    }
}

export default WebSocketServer; 