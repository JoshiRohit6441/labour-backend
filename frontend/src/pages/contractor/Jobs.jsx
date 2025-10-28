import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContractorJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await api.get('/api/contractor/jobs');
      setJobs(response.data.jobs || []);
    } catch (error) {
      toast.error('Failed to load jobs');
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
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>My Jobs</h1>

        {jobs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Briefcase size={48} style={{ margin: '0 auto 1rem', opacity: 0.5, color: 'var(--text-secondary)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>No jobs yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {jobs.map((job) => (
              <div key={job.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>{job.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      {job.city} • {job.numberOfWorkers} workers • {new Date(job.createdAt).toLocaleDateString()}
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
    </Layout>
  );
}
