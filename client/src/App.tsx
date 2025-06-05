import React from 'react';
import { Router, Route, Switch } from 'wouter';
import Home from './components/Home';
import Teacher from './components/Teacher';
import Student from './components/Student';
import Diagnostics from './components/Diagnostics';

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/teacher" component={Teacher} />
        <Route path="/student" component={Student} />
        <Route path="/diagnostics" component={Diagnostics} />
      </Switch>
    </Router>
  );
}

export default App; 