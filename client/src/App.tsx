import { Router, Route } from 'wouter';
import Home from './components/Home';
import Teacher from './components/Teacher';
import Student from './components/Student';

function App() {
  return (
    <Router>
      <Route path="/">{() => <Home />}</Route>
      <Route path="/teacher">{() => <Teacher />}</Route>
      <Route path="/student">{() => <Student />}</Route>
    </Router>
  );
}

export default App; 