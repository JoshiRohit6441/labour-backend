import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Briefcase, Users, DollarSign, Star, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContractorDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    totalEarnings: 0,
    rating: 0,
  });
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [jobsResponse, profileResponse] = await Promise.all([
        api.get('/api/contractor/jobs?limit=5'),
        api.get('/api/contractor/profile'),
      ]);

      const jobs = jobsResponse.data.jobs || [];
      const profile = profileResponse.data.contractor;

      setRecentJobs(jobs);
      setStats({
        totalJobs: profile?.totalJobs || 0,
        activeJobs: jobs.filter(j => ['ACCEPTED', 'IN_PROGRESS'].includes(j.status)).length,
        completedJobs: profile?.completedJobs || 0,
        totalEarnings: 0,
        rating: profile?.rating || 0,
      });
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ borderTopColor: '#2563eb' }}></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>Contractor Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your jobs and workers</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Briefcase size={24} color="white" />
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Total Jobs</p>
                <p style={{ fontSize: '1.75rem', fontWeight: '700' }}>{stats.totalJobs}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Users size={24} color="white" />
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Active Jobs</p>
                <p style={{ fontSize: '1.75rem', fontWeight: '700' }}>{stats.activeJobs}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <DollarSign size={24} color="white" />
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Completed</p>
                <p style={{ fontSize: '1.75rem', fontWeight: '700' }}>{stats.completedJobs}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Star size={24} color="white" />
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Rating</p>
                <p style={{ fontSize: '1.75rem', fontWeight: '700' }}>{stats.rating.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <button onClick={() => navigate('/contractor/nearby-jobs')} className="btn btn-primary" style={{ padding: '1.5rem' }}>
            <MapPin size={24} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '700', fontSize: '1.125rem' }}>Browse Nearby Jobs</div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Find jobs near your location</div>
            </div>
          </button>

          <button onClick={() => navigate('/contractor/workers')} className="btn btn-secondary" style={{ padding: '1.5rem' }}>
            <Users size={24} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '700', fontSize: '1.125rem' }}>Manage Workers</div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Add and organize your team</div>
            </div>
          </button>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>Recent Jobs</h2>
          {recentJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <Briefcase size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>No jobs yet. Start by browsing nearby jobs!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recentJobs.map((job) => (
                <div key={job.id} className="card" style={{ border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{job.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {job.city} • {job.numberOfWorkers} workers
                      </p>
                    </div>
                    <span className={`badge ${job.status === 'COMPLETED' ? 'badge-success' : 'badge-primary'}`}>
                      {job.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
