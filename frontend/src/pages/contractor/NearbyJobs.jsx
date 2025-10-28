import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { MapPin, Users, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NearbyJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quotingJobId, setQuotingJobId] = useState(null);
  const [quoteData, setQuoteData] = useState({ amount: '', notes: '', estimatedArrival: '' });

  useEffect(() => {
    fetchNearbyJobs();
  }, []);

  const fetchNearbyJobs = async () => {
    try {
      const response = await api.get('/api/contractor/nearby-jobs');
      setJobs(response.data.jobs || []);
    } catch (error) {
      toast.error('Failed to load nearby jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuote = async (jobId) => {
    if (!quoteData.amount) {
      toast.error('Please enter quote amount');
      return;
    }

    try {
      await api.post(`/api/contractor/jobs/${jobId}/quotes`, {
        amount: parseFloat(quoteData.amount),
        notes: quoteData.notes,
        estimatedArrival: quoteData.estimatedArrival,
      });
      toast.success('Quote submitted successfully!');
      setQuotingJobId(null);
      setQuoteData({ amount: '', notes: '', estimatedArrival: '' });
      fetchNearbyJobs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit quote');
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
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Nearby Jobs</h1>

        {jobs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <MapPin size={48} style={{ margin: '0 auto 1rem', opacity: 0.5, color: 'var(--text-secondary)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>No nearby jobs available</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {jobs.map((job) => (
              <div key={job.id} className="card">
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>{job.title}</h3>
                    <span className="badge badge-primary">{job.jobType}</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{job.description}</p>

                  <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    <span>
                      <Users size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      {job.numberOfWorkers} workers
                    </span>
                    <span>
                      <MapPin size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      {job.city}, {job.state}
                    </span>
                    {job.estimatedDuration && (
                      <span>
                        <Clock size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                        {job.estimatedDuration} hours
                      </span>
                    )}
                  </div>

                  {job.requiredSkills && job.requiredSkills.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      {job.requiredSkills.map((skill) => (
                        <span key={skill} className="badge badge-primary">{skill}</span>
                      ))}
                    </div>
                  )}
                </div>

                {quotingJobId === job.id ? (
                  <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label className="label">Quote Amount (₹)</label>
                        <input
                          type="number"
                          placeholder="Your quote"
                          value={quoteData.amount}
                          onChange={(e) => setQuoteData({ ...quoteData, amount: e.target.value })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label">Estimated Arrival</label>
                        <input
                          type="text"
                          placeholder="e.g., 2 hours"
                          value={quoteData.estimatedArrival}
                          onChange={(e) => setQuoteData({ ...quoteData, estimatedArrival: e.target.value })}
                          className="input"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Notes (Optional)</label>
                      <textarea
                        placeholder="Additional information..."
                        value={quoteData.notes}
                        onChange={(e) => setQuoteData({ ...quoteData, notes: e.target.value })}
                        className="input"
                        rows="2"
                      ></textarea>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleSubmitQuote(job.id)} className="btn btn-primary">
                        <Send size={20} />
                        Submit Quote
                      </button>
                      <button onClick={() => setQuotingJobId(null)} className="btn btn-outline">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setQuotingJobId(job.id)} className="btn btn-primary">
                    Submit Quote
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
