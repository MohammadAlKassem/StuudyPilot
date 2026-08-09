import {
  BookOpen,
  BrainCircuit,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  ShieldCheck,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const STUDENT_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/notes', label: 'Quick Notes', icon: NotebookPen },
  { to: '/ai-planner', label: 'AI Planner', icon: BrainCircuit },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Admin Dashboard', icon: ShieldCheck },
];

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'S') + (parts.length > 1 ? parts.at(-1)[0] : '');
}

function Sidebar({ id, onLogout, onNavigate, role, user }) {
  const links = role === 'admin' ? ADMIN_LINKS : STUDENT_LINKS;

  return (
    <aside className="sidebar" id={id} aria-label="Primary navigation">
      <div className="sidebar__brand">
        <span className="brand-mark" aria-hidden="true"><GraduationCap size={25} /></span>
        <span>
          <strong>StudyPilot</strong>
          <small>AI Study Planner</small>
        </span>
      </div>

      <nav className="sidebar__nav">
        <p className="sidebar__section-label">Workspace</p>
        {links.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user">
          <span className="avatar" aria-hidden="true">{initials(user?.name).toUpperCase()}</span>
          <span className="sidebar__user-copy">
            <strong>{user?.name || 'StudyPilot user'}</strong>
            <small>{role === 'admin' ? 'Administrator' : 'Student'}</small>
          </span>
        </div>
        <button type="button" className="sidebar__logout" onClick={onLogout}>
          <LogOut size={19} aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
