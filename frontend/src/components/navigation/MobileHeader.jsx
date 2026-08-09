import { GraduationCap, Menu } from 'lucide-react';

function MobileHeader({ controls, onOpen, open = false }) {
  return (
    <header
      className="mobile-header"
      inert={open ? '' : undefined}
      aria-hidden={open ? 'true' : undefined}
    >
      <div className="mobile-header__brand">
        <span className="brand-mark" aria-hidden="true"><GraduationCap size={22} /></span>
        <strong>StudyPilot</strong>
      </div>
      <button
        type="button"
        className="icon-button mobile-header__menu"
        onClick={onOpen}
        aria-label="Open navigation menu"
        aria-controls={controls}
        aria-expanded={open}
      >
        <Menu size={23} aria-hidden="true" />
      </button>
    </header>
  );
}

export default MobileHeader;
