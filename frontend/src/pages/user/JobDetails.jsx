import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { MapPin, Clock, Users, DollarSign, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const response = await api.get(`/api/user/jobs/${jobId}`);
      setJob(response.data.job);
      setQuotes(response.data.job.quotes || []);
    } catch (error) {
      toast.error('Failed to load job details');
      navigate('/user/jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptQuote = async (quoteId) => {
    try {
      await api.post(`/api/user/jobs/${jobId}/quotes/${quoteId}/accept`);
      toast.success('Quote accepted! Processing payment...');
      fetchJobDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to accept quote');
    }
  };

  const handleCancelJob = async () => {
    if (!confirm('Are you sure you want to cancel this job?')) return;

    try {
      await api.delete(`/api/user/jobs/${jobId}`);
      toast.success('Job cancelled successfully');
      navigate('/user/jobs');
    } catch (error) {
      toast.error('Failed to cancel job');
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

  if (!job) return null;

  return (
    <Layout>
      <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
        <button onClick={() => navigate('/user/jobs')} className="btn btn-outline" style={{ marginBottom: '1.5rem' }}>
          ← Back to Jobs
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>{job.title}</h1>
                <span className={`badge ${job.status === 'COMPLETED' ? 'badge-success' : 'badge-primary'}`}>
                  {job.status}
                </span>
              </div>
              {job.status === 'PENDING' && (
                <button onClick={handleCancelJob} className="btn btn-danger">
                  <X size={20} />
                  Cancel Job
                </button>
              )}
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.7' }}>
              {job.description}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <Users size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  Workers Needed
                </p>
                <p style={{ fontWeight: '600' }}>{job.numberOfWorkers}</p>
              </div>

              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <Clock size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  Duration
                </p>
                <p style={{ fontWeight: '600' }}>{job.estimatedDuration || 'N/A'} hours</p>
              </div>

              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <MapPin size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  Location
                </p>
                <p style={{ fontWeight: '600' }}>{job.city}, {job.state}</p>
              </div>

              {job.budget && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    <DollarSign size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                    Budget
                  </p>
                  <p style={{ fontWeight: '600' }}>₹{job.budget.toLocaleString()}</p>
                </div>
              )}
            </div>

            {job.requiredSkills && job.requiredSkills.length > 0 && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontWeight: '600', marginBottom: '0.75rem' }}>Required Skills</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {job.requiredSkills.map((skill) => (
                    <span key={skill} className="badge badge-primary">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {quotes.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>
                Received Quotes ({quotes.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {quotes.map((quote) => (
                  <div key={quote.id} className="card" style={{ border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                          ₹{quote.amount.toLocaleString()}
                        </p>
                        {quote.estimatedArrival && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                            <Clock size={14} style={{ display: 'inline' }} /> Arrival: {quote.estimatedArrival}
                          </p>
                        )}
                        {quote.notes && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {quote.notes}
                          </p>
                        )}
                      </div>
                      {!quote.isAccepted && job.status === 'QUOTED' && (
                        <button
                          onClick={() => handleAcceptQuote(quote.id)}
                          className="btn btn-primary"
                        >
                          <Check size={20} />
                          Accept Quote
                        </button>
                      )}
                      {quote.isAccepted && (
                        <span className="badge badge-success">Accepted</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
