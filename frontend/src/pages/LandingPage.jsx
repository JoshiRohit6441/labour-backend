import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Users, Clock, Shield, Star, Briefcase, MapPin } from 'lucide-react';
import { useEffect } from 'react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      if (user.role === 'USER') {
        navigate('/user/dashboard');
      } else if (user.role === 'CONTRACTOR') {
        navigate('/contractor/dashboard');
      }
    }
  }, [user, navigate]);

  const features = [
    {
      icon: Clock,
      title: 'Instant or Scheduled',
      description: 'Get workers immediately or schedule for later',
    },
    {
      icon: Shield,
      title: 'Verified Workers',
      description: 'All workers are background-checked and verified',
    },
    {
      icon: Star,
      title: 'Rated & Reviewed',
      description: 'See ratings and reviews from other customers',
    },
    {
      icon: MapPin,
      title: 'Location Based',
      description: 'Find workers near your location',
    },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{
        background: 'white',
        borderBottom: '1px solid var(--border)',
        padding: '1rem 0',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            LabourHire
          </h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => navigate('/login')} className="btn btn-outline">
              Sign In
            </button>
            <button onClick={() => navigate('/register')} className="btn btn-primary">
              Get Started
            </button>
          </div>
        </div>
      </header>

      <section style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '5rem 0',
      }}>
        <div className="container">
          <div style={{ maxWidth: '48rem', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1.5rem', lineHeight: '1.2' }}>
              Find Skilled Workers for Your Daily Needs
            </h1>
            <p style={{ fontSize: '1.25rem', marginBottom: '2rem', opacity: 0.95, lineHeight: '1.8' }}>
              Connect with verified contractors and skilled workers. Get instant quotes or schedule work for later.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/register')}
                className="btn"
                style={{ background: 'white', color: '#667eea', fontSize: '1.125rem', padding: '1rem 2rem' }}
              >
                <Users size={24} />
                I Need Workers
                <ArrowRight size={24} />
              </button>
              <button
                onClick={() => navigate('/register')}
                className="btn"
                style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white', fontSize: '1.125rem', padding: '1rem 2rem', backdropFilter: 'blur(10px)' }}
              >
                <Briefcase size={24} />
                I'm a Contractor
                <ArrowRight size={24} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '5rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2.25rem', fontWeight: '700', marginBottom: '1rem' }}>
              Why Choose LabourHire?
            </h2>
            <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', maxWidth: '42rem', margin: '0 auto' }}>
              We make hiring daily workers simple, safe, and efficient
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
            gap: '2rem',
          }}>
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="card"
                  style={{
                    textAlign: 'center',
                    transition: 'transform 0.3s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow)';
                  }}
                >
                  <div style={{
                    width: '4rem',
                    height: '4rem',
                    margin: '0 auto 1.5rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon size={32} color="white" />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    {feature.title}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '5rem 0',
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: '700', marginBottom: '1.5rem' }}>
            Ready to Get Started?
          </h2>
          <p style={{ fontSize: '1.125rem', marginBottom: '2rem', opacity: 0.95 }}>
            Join thousands of satisfied customers and contractors
          </p>
          <button
            onClick={() => navigate('/register')}
            className="btn"
            style={{ background: 'white', color: '#667eea', fontSize: '1.125rem', padding: '1rem 2rem' }}
          >
            Create Free Account
            <ArrowRight size={24} />
          </button>
        </div>
      </section>

      <footer style={{
        background: 'var(--text-primary)',
        color: 'white',
        padding: '2rem 0',
        textAlign: 'center',
      }}>
        <div className="container">
          <p style={{ opacity: 0.8 }}>
            © 2025 LabourHire. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
