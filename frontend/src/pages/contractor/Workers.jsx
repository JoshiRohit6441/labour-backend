import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Plus, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContractorWorkers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    skills: [],
    hourlyRate: '',
    dailyRate: '',
  });
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const response = await api.get('/api/contractor/workers');
      setWorkers(response.data.workers || []);
    } catch (error) {
      toast.error('Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/contractor/workers', {
        ...formData,
        hourlyRate: parseFloat(formData.hourlyRate),
        dailyRate: parseFloat(formData.dailyRate),
      });
      toast.success('Worker added successfully!');
      setShowAddModal(false);
      setFormData({ firstName: '', lastName: '', phone: '', email: '', skills: [], hourlyRate: '', dailyRate: '' });
      fetchWorkers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add worker');
    }
  };

  const addSkill = (skill) => {
    if (skill && !formData.skills.includes(skill)) {
      setFormData({ ...formData, skills: [...formData.skills, skill] });
      setSkillInput('');
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700' }}>Workers</h1>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={20} />
            Add Worker
          </button>
        </div>

        {workers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.5, color: 'var(--text-secondary)' }} />
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>No workers yet</p>
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
              <Plus size={20} />
              Add Your First Worker
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))', gap: '1.5rem' }}>
            {workers.map((worker) => (
              <div key={worker.id} className="card">
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                    {worker.firstName} {worker.lastName}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{worker.phone}</p>
                </div>
                {worker.skills && worker.skills.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {worker.skills.map((skill) => (
                      <span key={skill} className="badge badge-primary">{skill}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {worker.hourlyRate && <span>₹{worker.hourlyRate}/hr</span>}
                  {worker.dailyRate && <span>₹{worker.dailyRate}/day</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <span className={`badge ${worker.isActive ? 'badge-success' : 'badge-danger'}`}>
                    {worker.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {worker.isVerified && <span className="badge badge-primary">Verified</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}>
            <div className="card" style={{ maxWidth: '32rem', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Add Worker</h2>
                <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddWorker} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="label">First Name</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">Email (Optional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Skills</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Add skill..."
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSkill(skillInput);
                        }
                      }}
                      className="input"
                    />
                    <button type="button" onClick={() => addSkill(skillInput)} className="btn btn-primary">
                      Add
                    </button>
                  </div>
                  {formData.skills.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      {formData.skills.map((skill) => (
                        <span key={skill} className="badge badge-success">
                          {skill}
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.25rem' }}
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="label">Hourly Rate (₹)</label>
                    <input
                      type="number"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Daily Rate (₹)</label>
                    <input
                      type="number"
                      value={formData.dailyRate}
                      onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    <Plus size={20} />
                    Add Worker
                  </button>
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-outline">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
