import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Plus, X, MapPin, Calendar, Clock, Users, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateJob() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    jobType: 'SCHEDULED',
    address: '',
    city: '',
    state: '',
    pincode: '',
    latitude: 0,
    longitude: 0,
    scheduledDate: '',
    scheduledTime: '',
    estimatedDuration: '',
    numberOfWorkers: 1,
    requiredSkills: [],
    budget: '',
  });
  const [skillInput, setSkillInput] = useState('');

  const commonSkills = [
    'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Mason',
    'Cleaner', 'Helper', 'Driver', 'Gardener', 'Welder'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const addSkill = (skill) => {
    if (skill && !formData.requiredSkills.includes(skill)) {
      setFormData({
        ...formData,
        requiredSkills: [...formData.requiredSkills, skill],
      });
      setSkillInput('');
    }
  };

  const removeSkill = (skill) => {
    setFormData({
      ...formData,
      requiredSkills: formData.requiredSkills.filter((s) => s !== skill),
    });
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      toast.loading('Getting your location...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          toast.dismiss();
          toast.success('Location obtained!');
        },
        () => {
          toast.dismiss();
          toast.error('Could not get location');
        }
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.requiredSkills.length === 0) {
      toast.error('Please add at least one skill');
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      toast.error('Please provide location coordinates');
      return;
    }

    setLoading(true);

    try {
      const jobData = {
        ...formData,
        numberOfWorkers: parseInt(formData.numberOfWorkers),
        estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
      };

      const response = await api.post('/api/user/jobs', jobData);
      toast.success('Job created successfully!');
      navigate(`/user/jobs/${response.data.job.id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>Create New Job</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Post a job and get quotes from contractors</p>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label className="label">Job Type</label>
            <select
              name="jobType"
              value={formData.jobType}
              onChange={handleChange}
              className="input"
              required
            >
              <option value="IMMEDIATE">Immediate - Need workers now</option>
              <option value="SCHEDULED">Scheduled - Plan for later</option>
              <option value="BIDDING">Bidding - Get multiple quotes</option>
            </select>
          </div>

          <div>
            <label className="label">
              <Briefcase size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
              Job Title
            </label>
            <input
              type="text"
              name="title"
              placeholder="e.g., Need plumber for bathroom repair"
              value={formData.title}
              onChange={handleChange}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              name="description"
              placeholder="Describe the work in detail..."
              value={formData.description}
              onChange={handleChange}
              className="input"
              rows="4"
              required
            ></textarea>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label">
                <Users size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                Number of Workers
              </label>
              <input
                type="number"
                name="numberOfWorkers"
                min="1"
                value={formData.numberOfWorkers}
                onChange={handleChange}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label">
                <Clock size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                Estimated Duration (hours)
              </label>
              <input
                type="number"
                name="estimatedDuration"
                placeholder="Optional"
                value={formData.estimatedDuration}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>

          {formData.jobType !== 'IMMEDIATE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="label">
                  <Calendar size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  Scheduled Date
                </label>
                <input
                  type="date"
                  name="scheduledDate"
                  value={formData.scheduledDate}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Scheduled Time</label>
                <input
                  type="time"
                  name="scheduledTime"
                  value={formData.scheduledTime}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>
          )}

          <div>
            <label className="label">Required Skills</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {commonSkills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => addSkill(skill)}
                  className="badge badge-primary"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Plus size={14} />
                  {skill}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Or type custom skill..."
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
            {formData.requiredSkills.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                {formData.requiredSkills.map((skill) => (
                  <span key={skill} className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">
              <MapPin size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
              Location
            </label>
            <input
              type="text"
              name="address"
              placeholder="Full address"
              value={formData.address}
              onChange={handleChange}
              className="input"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label">City</label>
              <input
                type="text"
                name="city"
                placeholder="City"
                value={formData.city}
                onChange={handleChange}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label">State</label>
              <input
                type="text"
                name="state"
                placeholder="State"
                value={formData.state}
                onChange={handleChange}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label">Pincode</label>
              <input
                type="text"
                name="pincode"
                placeholder="Pincode"
                value={formData.pincode}
                onChange={handleChange}
                className="input"
                required
                pattern="[0-9]{6}"
              />
            </div>
          </div>

          <div>
            <label className="label">Coordinates</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem' }}>
              <input
                type="number"
                name="latitude"
                placeholder="Latitude"
                value={formData.latitude}
                onChange={handleChange}
                className="input"
                step="any"
                required
              />
              <input
                type="number"
                name="longitude"
                placeholder="Longitude"
                value={formData.longitude}
                onChange={handleChange}
                className="input"
                step="any"
                required
              />
              <button type="button" onClick={getCurrentLocation} className="btn btn-secondary">
                <MapPin size={20} />
                Get Location
              </button>
            </div>
          </div>

          <div>
            <label className="label">Budget (Optional)</label>
            <input
              type="number"
              name="budget"
              placeholder="Your expected budget in ₹"
              value={formData.budget}
              onChange={handleChange}
              className="input"
              step="0.01"
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Creating Job...
                </>
              ) : (
                <>
                  <Plus size={20} />
                  Create Job
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/user/jobs')}
              className="btn btn-outline"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
