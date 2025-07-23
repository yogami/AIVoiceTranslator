import { Router, Route } from 'wouter';
import Home from './components/Home';
import Teacher from './components/Teacher';

function App() {
  return (
    <Router>
      <Route path="/">{() => <Home />}</Route>
      <Route path="/teacher">{() => <Teacher />}</Route>
    </Router>
  );
}

export default App; 