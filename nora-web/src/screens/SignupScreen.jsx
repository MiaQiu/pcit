import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Common child conditions for PCIT
const CONDITION_OPTIONS = [
  'ADHD (Diagnosed)',
  'ADHD (Suspected)',
  'ODD (Oppositional Defiant Disorder)',
  'Anxiety',
  'Autism Spectrum Disorder',
  'Behavioral Challenges',
  'Developmental Delay',
  'No Specific Condition',
  'Other'
];

// Generate birth year options (ages 2-12, which is typical for PCIT)
const BIRTH_YEAR_OPTIONS = (() => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 2; i <= 12; i++) {
    years.push(currentYear - i);
  }
  return years;
})();

function SignupScreen() {
  const navigate = useNavigate();
  const { signup, error: authError } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    childName: '',
    childBirthYear: '',
    childConditions: [],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleConditionToggle = (condition) => {
    setFormData(prev => {
      const newConditions = prev.childConditions.includes(condition)
        ? prev.childConditions.filter(c => c !== condition)
        : [...prev.childConditions, condition];
      return { ...prev, childConditions: newConditions };
    });
    setError('');
  };

  const validateForm = () => {
    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return false;
    }

    if (!formData.childName || !formData.childBirthYear) {
      setError('Please provide child information (name and birth year)');
      return false;
    }

    if (formData.childConditions.length === 0) {
      setError('Please select at least one condition or "No Specific Condition"');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      setError('Password must contain uppercase, lowercase, and number');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const result = await signup(
      formData.email,
      formData.password,
      formData.name,
      formData.childName,
      parseInt(formData.childBirthYear),
      formData.childConditions
    );
    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Signup failed');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create Account</h1>
        <p style={styles.subtitle}>Start your PCIT coaching journey</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {(error || authError) && (
            <div style={styles.error}>
              {error || authError}
            </div>
          )}

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Your Information</h3>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Your Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                style={styles.input}
                placeholder="Enter your name"
                disabled={loading}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                style={styles.input}
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                style={styles.input}
                placeholder="At least 8 characters"
                disabled={loading}
              />
              <small style={styles.hint}>
                Must include uppercase, lowercase, and number
              </small>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                style={styles.input}
                placeholder="Re-enter password"
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Child Information</h3>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Child's Name *</label>
              <input
                type="text"
                name="childName"
                value={formData.childName}
                onChange={handleChange}
                style={styles.input}
                placeholder="Enter child's name"
                disabled={loading}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Child's Birth Year *</label>
              <select
                name="childBirthYear"
                value={formData.childBirthYear}
                onChange={handleChange}
                style={styles.select}
                disabled={loading}
              >
                <option value="">Select birth year</option>
                {BIRTH_YEAR_OPTIONS.map(year => {
                  const age = new Date().getFullYear() - year;
                  return (
                    <option key={year} value={year}>
                      {year} (Age {age})
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Child's Condition(s) *</label>
              <small style={styles.hint}>Select all that apply</small>
              <div style={styles.checkboxGroup}>
                {CONDITION_OPTIONS.map(condition => (
                  <label key={condition} style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.childConditions.includes(condition)}
                      onChange={() => handleConditionToggle(condition)}
                      style={styles.checkbox}
                      disabled={loading}
                    />
                    <span style={styles.checkboxText}>{condition}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Already have an account?{' '}
            <Link to="/login" style={styles.link}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '8px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '32px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #eee',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '4px',
  },
  error: {
    backgroundColor: '#fee',
    color: '#c33',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '14px',
    border: '1px solid #fcc',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '12px',
    color: '#666',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '8px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  checkboxText: {
    fontSize: '14px',
    color: '#333',
  },
  button: {
    backgroundColor: '#4CAF50',
    color: 'white',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '14px',
    color: '#666',
  },
  link: {
    color: '#4CAF50',
    textDecoration: 'none',
    fontWeight: '500',
  },
};

export default SignupScreen;
