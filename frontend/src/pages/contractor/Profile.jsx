import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContractorProfile() {
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: '',
    businessAddress: '',
    businessCity: '',
    businessState: '',
    businessPincode: '',
    coverageRadius: 20,
  });
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/contractor/profile');
      if (response.data.contractor) {
        setFormData(response.data.contractor);
        setHasProfile(true);
      }
    } catch (error) {
      console.log('No profile yet');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (hasProfile) {
        await api.put('/api/contractor/profile', formData);
        toast.success('Profile updated successfully!');
      } else {
        await api.post('/api/contractor/profile', formData);
        toast.success('Profile created successfully!');
        setHasProfile(true);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Business Profile</h1>

        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label className="label">Business Name</label>
            <input
              type="text"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Business Type</label>
            <input
              type="text"
              value={formData.businessType}
              onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Business Address</label>
            <input
              type="text"
              value={formData.businessAddress}
              onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
              className="input"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label">City</label>
              <input
                type="text"
                value={formData.businessCity}
                onChange={(e) => setFormData({ ...formData, businessCity: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">State</label>
              <input
                type="text"
                value={formData.businessState}
                onChange={(e) => setFormData({ ...formData, businessState: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Pincode</label>
              <input
                type="text"
                value={formData.businessPincode}
                onChange={(e) => setFormData({ ...formData, businessPincode: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Coverage Radius (km): {formData.coverageRadius}</label>
            <input
              type="range"
              min="5"
              max="50"
              value={formData.coverageRadius}
              onChange={(e) => setFormData({ ...formData, coverageRadius: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={20} />
                {hasProfile ? 'Update Profile' : 'Create Profile'}
              </>
            )}
          </button>
        </form>
      </div>
    </Layout>
  );
}
