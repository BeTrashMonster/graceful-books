import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'https://api.audacious.money';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  supportKey: string;
  accountStatus: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserProduct {
  id: string;
  productId: string;
  name: string;
  slug: string;
  status: string;
  activatedAt: string;
  expiresAt: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_usd: number;
  active: boolean;
}

interface CPGLaunchSignup {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  business_name: string | null;
  created_at: string;
  notified_at: string | null;
  converted_to_user_id: string | null;
  unsubscribed_at: string | null;
}

interface HomeEmailSignup {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  created_at: string;
  unsubscribed_at: string | null;
}

interface BookkeepingSignup {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  created_at: string;
  unsubscribed_at: string | null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [cpgSignups, setCpgSignups] = useState<CPGLaunchSignup[]>([]);
  const [homeSignups, setHomeSignups] = useState<HomeEmailSignup[]>([]);
  const [bookkeepingSignups, setBookkeepingSignups] = useState<BookkeepingSignup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userProducts, setUserProducts] = useState<Record<string, UserProduct[]>>({});
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [showAddProduct, setShowAddProduct] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Get admin session
  const getAdminSession = () => {
    const sessionData = sessionStorage.getItem('graceful_books_admin_session');
    if (!sessionData) {
      navigate('/admin/login');
      return null;
    }
    return JSON.parse(sessionData);
  };

  const session = getAdminSession();

  // Fetch users and products
  useEffect(() => {
    const fetchData = async () => {
      if (!session) return;

      try {
        // Fetch users
        const usersResponse = await fetch(`${API_URL}/admin/users`, {
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        });

        const usersData = await usersResponse.json();

        if (!usersResponse.ok) {
          throw new Error(usersData.error?.message || 'Failed to fetch users');
        }

        setUsers(usersData.data.users);

        // Fetch CPG launch signups
        const cpgSignupsResponse = await fetch(`${API_URL}/admin/cpg-launch-signups`, {
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        });

        const cpgSignupsData = await cpgSignupsResponse.json();

        if (cpgSignupsResponse.ok) {
          setCpgSignups(cpgSignupsData.data.signups || []);
        }

        // Fetch home email signups
        const homeSignupsResponse = await fetch(`${API_URL}/admin/home-email-signups`, {
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        });

        const homeSignupsData = await homeSignupsResponse.json();

        if (homeSignupsResponse.ok) {
          setHomeSignups(homeSignupsData.data.signups || []);
        }

        // Fetch bookkeeping signups
        const bookkeepingSignupsResponse = await fetch(`${API_URL}/admin/bookkeeping-signups`, {
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        });

        const bookkeepingSignupsData = await bookkeepingSignupsResponse.json();

        if (bookkeepingSignupsResponse.ok) {
          setBookkeepingSignups(bookkeepingSignupsData.data.signups || []);
        }

        // Fetch all products
        const productsResponse = await fetch(`${API_URL}/products`);
        const productsData = await productsResponse.json();

        if (productsResponse.ok) {
          setAllProducts(productsData.data || []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/me/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to change password');
      }

      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('graceful_books_admin_session');
    navigate('/admin/login');
  };

  const fetchUserProducts = async (userId: string) => {
    if (!session) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/products`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setUserProducts((prev) => ({ ...prev, [userId]: data.data.products || [] }));
      } else {
        console.error('Error fetching user products:', data.error?.message);
        setUserProducts((prev) => ({ ...prev, [userId]: [] }));
        alert(`Error loading products: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error fetching user products:', err);
      setUserProducts((prev) => ({ ...prev, [userId]: [] }));
      alert(`Error loading products: ${err.message}`);
    }
  };

  const handleToggleUser = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      if (!userProducts[userId]) {
        await fetchUserProducts(userId);
      }
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!session) return;

    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      const data = await response.json();

      console.log('Delete response:', { status: response.status, data });

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || JSON.stringify(data);
        console.error('Delete failed:', errorMsg);
        throw new Error(errorMsg);
      }

      // Remove user from list and close if expanded
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (expandedUserId === userId) {
        setExpandedUserId(null);
      }
      // Clean up user products from state
      setUserProducts((prev) => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
      alert('User deleted successfully');
    } catch (err: any) {
      console.error('Delete user error:', err);
      alert(`Error deleting user: ${err.message}`);
    }
  };

  const handleAddProduct = async (userId: string) => {
    if (!session || !selectedProductId) {
      alert('Please select a product first');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          productId: selectedProductId,
          status: 'active',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to add product');
      }

      // Refresh user products
      await fetchUserProducts(userId);
      setShowAddProduct(null);
      setSelectedProductId('');
      alert('Product added successfully!');
    } catch (err: any) {
      console.error('Error adding product:', err);
      alert(`Error adding product: ${err.message}`);
    }
  };

  const handleRemoveProduct = async (userId: string, productId: string, productName: string) => {
    if (!session) return;

    if (!confirm(`Remove ${productName} from this user?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to remove product');
      }

      // Refresh user products
      await fetchUserProducts(userId);
      alert('Product removed successfully!');
    } catch (err: any) {
      console.error('Error removing product:', err);
      alert(`Error removing product: ${err.message}`);
    }
  };

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Admin Dashboard
            </h1>
            <p style={{ color: '#6b7280' }}>
              Welcome, {session?.admin?.firstName || 'Admin'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => setShowPasswordChange(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Change Password
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* CPG Launch Signups Table */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            marginBottom: '2rem',
          }}
        >
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f0f9ff' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#4b006e' }}>
              🚀 CPG Product Costing Tool Launch Signups ({cpgSignups.length})
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              May 4th, 2026 Launch
            </p>
          </div>

          {cpgSignups.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              No launch signups yet
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Business</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Signed Up</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cpgSignups.map((signup) => (
                    <tr key={signup.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>
                        {signup.first_name} {signup.last_name || ''}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{signup.email}</td>
                      <td style={{ padding: '0.75rem' }}>{signup.business_name || '-'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {new Date(signup.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: signup.unsubscribed_at
                              ? '#fee2e2'
                              : signup.converted_to_user_id
                              ? '#dcfce7'
                              : '#fef3c7',
                            color: signup.unsubscribed_at
                              ? '#991b1b'
                              : signup.converted_to_user_id
                              ? '#16a34a'
                              : '#92400e',
                          }}
                        >
                          {signup.unsubscribed_at
                            ? 'Unsubscribed'
                            : signup.converted_to_user_id
                            ? 'Converted'
                            : 'Waiting'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Home Page Email Waitlist Signups */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            marginBottom: '2rem',
          }}
        >
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f0fdf4' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#4b006e' }}>
              📧 Home Page Waitlist Signups ({homeSignups.length})
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Full bookkeeping suite launch waitlist
            </p>
          </div>

          {homeSignups.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              No waitlist signups yet
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Signed Up</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {homeSignups.map((signup) => (
                    <tr key={signup.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>
                        {signup.first_name} {signup.last_name || ''}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{signup.email}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {new Date(signup.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: signup.unsubscribed_at ? '#fee2e2' : '#fef3c7',
                            color: signup.unsubscribed_at ? '#991b1b' : '#92400e',
                          }}
                        >
                          {signup.unsubscribed_at ? 'Unsubscribed' : 'Waiting'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bookkeeping Suite Waitlist Signups */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            marginBottom: '2rem',
          }}
        >
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fef3c7' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#4b006e' }}>
              📚 Bookkeeping Suite Waitlist Signups ({bookkeepingSignups.length})
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Full bookkeeping suite launch waitlist
            </p>
          </div>

          {bookkeepingSignups.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              No waitlist signups yet
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Signed Up</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookkeepingSignups.map((signup) => (
                    <tr key={signup.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>
                        {signup.first_name} {signup.last_name || ''}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{signup.email}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {new Date(signup.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: signup.unsubscribed_at ? '#fee2e2' : '#fef3c7',
                            color: signup.unsubscribed_at ? '#991b1b' : '#92400e',
                          }}
                        >
                          {signup.unsubscribed_at ? 'Unsubscribed' : 'Waiting'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Users ({users.length})</h2>
          </div>

          {error && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.875rem' }}>
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, width: '40px' }}></th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                    Company
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                    Support Key
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                    Status
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                    Created
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <>
                    <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <button
                          onClick={() => handleToggleUser(user.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            padding: '0.25rem',
                          }}
                        >
                          {expandedUserId === user.id ? '▼' : '▶'}
                        </button>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {user.firstName} {user.lastName}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{user.email}</td>
                      <td style={{ padding: '0.75rem' }}>{user.companyName || '-'}</td>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {user.supportKey}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor:
                              user.accountStatus === 'active' ? '#dcfce7' : '#fee2e2',
                            color: user.accountStatus === 'active' ? '#16a34a' : '#dc2626',
                          }}
                        >
                          {user.accountStatus}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          style={{
                            padding: '0.375rem 0.75rem',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {expandedUserId === user.id && (
                      <tr key={`${user.id}-products`} style={{ backgroundColor: '#f9fafb' }}>
                        <td colSpan={8} style={{ padding: '1rem' }}>
                          <div style={{ marginLeft: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h4 style={{ fontWeight: 600, fontSize: '0.875rem' }}>Products</h4>
                              <button
                                onClick={() => setShowAddProduct(user.id)}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                }}
                              >
                                + Add Product
                              </button>
                            </div>

                            {showAddProduct === user.id && (
                              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'white', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <select
                                    value={selectedProductId}
                                    onChange={(e) => setSelectedProductId(e.target.value)}
                                    style={{
                                      flex: 1,
                                      padding: '0.5rem',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.875rem',
                                    }}
                                  >
                                    <option value="">Select a product...</option>
                                    {allProducts && allProducts.length > 0 ? (
                                      allProducts
                                        .filter(p => !userProducts[user.id]?.find(up => up.productId === p.id))
                                        .map((product) => (
                                          <option key={product.id} value={product.id}>
                                            {product.name}
                                          </option>
                                        ))
                                    ) : (
                                      <option value="" disabled>No products available</option>
                                    )}
                                  </select>
                                  <button
                                    onClick={() => handleAddProduct(user.id)}
                                    disabled={!selectedProductId}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      backgroundColor: selectedProductId ? '#16a34a' : '#e5e7eb',
                                      color: selectedProductId ? 'white' : '#6b7280',
                                      border: 'none',
                                      borderRadius: '0.375rem',
                                      cursor: selectedProductId ? 'pointer' : 'not-allowed',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    Add
                                  </button>
                                  <button
                                    onClick={() => { setShowAddProduct(null); setSelectedProductId(''); }}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      backgroundColor: '#e5e7eb',
                                      color: '#374151',
                                      border: 'none',
                                      borderRadius: '0.375rem',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {userProducts[user.id] && userProducts[user.id].length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {userProducts[user.id].map((product) => (
                                  <div
                                    key={product.id}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.75rem',
                                      backgroundColor: 'white',
                                      borderRadius: '0.375rem',
                                      border: '1px solid #e5e7eb',
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                        {product.name}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                        Status: <span
                                          style={{
                                            fontWeight: 600,
                                            color: product.status === 'active' ? '#16a34a' : '#6b7280',
                                          }}
                                        >
                                          {product.status}
                                        </span>
                                        {' • '}
                                        Activated: {new Date(product.activatedAt).toLocaleDateString()}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleRemoveProduct(user.id, product.productId, product.name)}
                                      style={{
                                        padding: '0.375rem 0.75rem',
                                        backgroundColor: '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.375rem',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                      }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                                No products assigned
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Password Change Modal */}
        {showPasswordChange && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
            }}
            onClick={() => setShowPasswordChange(false)}
          >
            <div
              style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '0.5rem',
                maxWidth: '400px',
                width: '100%',
                margin: '1rem',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                Change Password
              </h3>

              {passwordError && (
                <div
                  style={{
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                >
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div
                  style={{
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                >
                  Password changed successfully!
                </div>
              )}

              <form onSubmit={handlePasswordChange}>
                <div style={{ marginBottom: '1rem' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                    }
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}
                  />
                  <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
                    8+ chars, uppercase, lowercase, number, special character
                  </p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                    }
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowPasswordChange(false)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  >
                    Change Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
