import { Route, Routes } from 'react-router-dom';
import BuilderPage from './pages/BuilderPage';
import PublicFormPage from './pages/PublicFormPage';
import './App.css';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<BuilderPage />} />
      <Route path="/form/:slug" element={<PublicFormPage />} />
    </Routes>
  );
};

export default App;
