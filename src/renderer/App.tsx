import React from 'react';
import PersonForm from './components/PersonForm';
import SailorsForm from './components/SailorForm';

const App = () => {
  return (
      <div>
          <h1>Person Management</h1>
          <PersonForm />

          <h1>Sailor Managmet</h1>
          <SailorsForm />
      </div>
  );
};

export default App;
