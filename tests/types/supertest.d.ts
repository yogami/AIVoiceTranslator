declare module 'supertest' {
  import { SuperAgentTest } from 'superagent';
  
  export default function request(app: any): SuperAgentTest;
  
  export interface SuperAgentTest {
    get(url: string): SuperAgentTest;
    post(url: string): SuperAgentTest;
    put(url: string): SuperAgentTest;
    delete(url: string): SuperAgentTest;
    send(data: any): SuperAgentTest;
    expect(status: number): SuperAgentTest;
    expect(callback: (res: any) => void): SuperAgentTest;
  }
}
