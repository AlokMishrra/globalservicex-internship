import { Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import BuilderPage from './pages/BuilderPage';
import PublicFormPage from './pages/PublicFormPage';
import PublicFormsPage from './pages/PublicFormsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminProtectedRoute from './pages/AdminProtectedRoute';
import AdminHomePage from './pages/AdminHomePage';
import AdminStatsPage from './pages/AdminStatsPage';
import AdminFormsPage from './pages/AdminFormsPage';
import AdminSubmissionsPage from './pages/AdminSubmissionsPage';
import './App.css';

const App = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="app-shell">
      <nav className="site-nav">
        <a href="https://globalservicex.in" className="logo">
          <img src="/logo.png" alt="Global ServiceX" className="logo-img" />
        </a>

        {/* Desktop Navigation */}
        <div className="nav-links">
          <a href="https://globalservicex.in/#hero" className="nav-link">Home</a>
          <a href="https://globalservicex.in/#services" className="nav-link">Services</a>
          <a href="https://globalservicex.in/#about" className="nav-link">About</a>
          <a href="https://globalservicex.in/blog" className="nav-link">Blog</a>
          <a href="https://globalservicex.in/careers" className="nav-link">
            Careers
            <span className="badge">New</span>
          </a>
          <a href="https://globalservicex.in/contact" target="_blank" rel="noreferrer" className="contact-pill">
            Get Started
          </a>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
          <div className="mobile-menu">
            <button className="mobile-menu-close" onClick={closeMobileMenu} aria-label="Close menu">
              ✕
            </button>
            <a href="https://globalservicex.in/#hero" className="mobile-nav-link" onClick={closeMobileMenu}>
              Home
            </a>
            <a href="https://globalservicex.in/#services" className="mobile-nav-link" onClick={closeMobileMenu}>
              Services
            </a>
            <a href="https://globalservicex.in/#about" className="mobile-nav-link" onClick={closeMobileMenu}>
              About
            </a>
            <a href="https://globalservicex.in/blog" className="mobile-nav-link" onClick={closeMobileMenu}>
              Blog
            </a>
            <a href="https://globalservicex.in/careers" className="mobile-nav-link" onClick={closeMobileMenu}>
              <span>Careers</span>
              <span className="badge">New</span>
            </a>
            <a href="https://globalservicex.in/contact" target="_blank" rel="noreferrer" className="mobile-nav-link primary-link" onClick={closeMobileMenu}>
              Get Started
            </a>
          </div>
        </>
      )}

      <Routes>
        <Route path="/" element={<PublicFormsPage />} />
        <Route path="/gsxi/login" element={<AdminLoginPage />} />
        <Route
          path="/gsxi"
          element={
            <AdminProtectedRoute>
              <AdminHomePage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/gsxi/create"
          element={
            <AdminProtectedRoute>
              <BuilderPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/gsxi/stats"
          element={
            <AdminProtectedRoute>
              <AdminStatsPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/gsxi/forms"
          element={
            <AdminProtectedRoute>
              <AdminFormsPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/gsxi/submissions"
          element={
            <AdminProtectedRoute>
              <AdminSubmissionsPage />
            </AdminProtectedRoute>
          }
        />
        <Route path="/form/:slug" element={<PublicFormPage />} />
      </Routes>
    </div>
  );
};

export default App;
