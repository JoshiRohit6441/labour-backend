import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, Briefcase, Users, DollarSign, Bell, User, LogOut,
  Menu, X, MapPin
} from 'lucide-react';
import { useState } from 'react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isContractor = user?.role === 'CONTRACTOR';

  const userNavItems = [
    { path: '/user/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/user/jobs', icon: Briefcase, label: 'My Jobs' },
    { path: '/user/payments', icon: DollarSign, label: 'Payments' },
    { path: '/user/profile', icon: User, label: 'Profile' },
  ];

  const contractorNavItems = [
    { path: '/contractor/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/contractor/jobs', icon: Briefcase, label: 'My Jobs' },
    { path: '/contractor/nearby-jobs', icon: MapPin, label: 'Nearby Jobs' },
    { path: '/contractor/workers', icon: Users, label: 'Workers' },
    { path: '/contractor/earnings', icon: DollarSign, label: 'Earnings' },
    { path: '/contractor/profile', icon: User, label: 'Profile' },
  ];

  const navItems = isContractor ? contractorNavItems : userNavItems;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      <aside style={{
        width: mobileMenuOpen ? '16rem' : '0',
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        background: 'white',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.3s',
        overflow: 'hidden',
        zIndex: 40,
      }}
      className="sidebar">
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            LabourHire
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {isContractor ? 'Contractor Portal' : 'Customer Portal'}
          </p>
        </div>

        <nav style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  transition: 'all 0.2s',
                  background: isActive ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-primary)',
                  fontWeight: isActive ? '600' : '500',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem' }}>
          <button
            onClick={handleLogout}
            className="btn btn-outline"
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, marginLeft: mobileMenuOpen ? '16rem' : '0', transition: 'margin 0.3s' }}>
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'white',
          borderBottom: '1px solid var(--border)',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="btn"
            style={{ padding: '0.5rem' }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn" style={{ padding: '0.5rem', position: 'relative' }}>
              <Bell size={24} />
              <span style={{
                position: 'absolute',
                top: '0.25rem',
                right: '0.25rem',
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                background: 'var(--danger)',
              }}></span>
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              background: 'var(--bg-secondary)',
            }}>
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
              }}>
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                  {user?.firstName} {user?.lastName}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main style={{ padding: '1.5rem' }}>
          {children}
        </main>
      </div>

      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 30,
          }}
        />
      )}
    </div>
  );
}
