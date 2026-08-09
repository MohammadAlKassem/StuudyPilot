import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import MobileHeader from '../components/navigation/MobileHeader.jsx';
import Sidebar from '../components/navigation/Sidebar.jsx';
import { useAuth } from '../hooks/useAuth.js';

function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)');
    const closeAtDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener('change', closeAtDesktop);
    return () => desktop.removeEventListener('change', closeAtDesktop);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const drawer = document.getElementById('admin-sidebar');
    const menuButton = document.querySelector('[aria-controls="admin-sidebar"]');
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(
      () => drawer?.querySelector(focusableSelector)?.focus(),
      0,
    );
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const controls = [...drawer.querySelectorAll(focusableSelector)];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus?.();
    };
  }, [closeMenu, menuOpen]);

  const handleLogout = () => {
    closeMenu();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`app-shell app-shell--admin${menuOpen ? ' app-shell--menu-open' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <MobileHeader controls="admin-sidebar" open={menuOpen} onOpen={() => setMenuOpen(true)} />
      <div
        className="sidebar-drawer"
        role={menuOpen ? 'dialog' : undefined}
        aria-modal={menuOpen ? 'true' : undefined}
        aria-label={menuOpen ? 'Administrator navigation' : undefined}
      >
        <Sidebar
          id="admin-sidebar"
          role="admin"
          user={user}
          onNavigate={closeMenu}
          onLogout={handleLogout}
        />
      </div>
      {menuOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation menu"
          onClick={closeMenu}
        />
      )}
      <main
        className="app-main"
        id="main-content"
        inert={menuOpen ? '' : undefined}
        aria-hidden={menuOpen ? 'true' : undefined}
      >
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
