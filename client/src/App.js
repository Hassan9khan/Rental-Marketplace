import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://rental-marketplace-api.vercel.app/api' // Your Vercel backend link
  : 'http://localhost:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('listings'); // 'listings' | 'bookings' | 'analytics'
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [category, setCategory] = useState('All');
  
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [reviewModalItem, setReviewModalItem] = useState(null);
  const [itemReviews, setItemReviews] = useState([]);
  const [reservedIntervals, setReservedIntervals] = useState([]);
  const [showAddListing, setShowAddListing] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  // New Booking State
  const [renterName, setRenterName] = useState('');
  const [renterEmail, setRenterEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bookingStatus, setBookingStatus] = useState(null);

  // Add Review State
  const [reviewerName, setReviewerName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState(null);

  // Host Listing Creation State
  const [newTitle, setNewTitle] = useState('');
  const [newCat, setNewCat] = useState('Equipment');
  const [newPrice, setNewPrice] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newImg, setNewImg] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [addMsg, setAddMsg] = useState(null);

  // Edit Booking State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editStatusMsg, setEditStatusMsg] = useState(null);

  useEffect(() => {
    if (activeTab === 'listings') {
      fetchListings();
    } else if (activeTab === 'bookings') {
      fetchBookings();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, category, search]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/listings?category=${category}&search=${search}`);
      setListings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/bookings`);
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/analytics`);
      setAnalytics(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openRentModal = async (item) => {
    setSelectedItem(item);
    setStartDate('');
    setEndDate('');
    setBookingStatus(null);
    try {
      const res = await axios.get(`${API_URL}/listings/${item._id}/reserved-dates`);
      setReservedIntervals(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openReviewsModal = async (item) => {
    setReviewModalItem(item);
    setReviewMsg(null);
    try {
      const res = await axios.get(`${API_URL}/listings/${item._id}/reviews`);
      setItemReviews(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const calculatePrice = () => {
    if (!startDate || !endDate || !selectedItem) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) return null;
    
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const base = days * selectedItem.pricePerDay;
    const serviceFee = Math.round(base * 0.05);
    const deposit = Math.round(base * 0.10);
    const total = base + serviceFee + deposit;
    return { days, base, serviceFee, deposit, total };
  };

  const pricing = calculatePrice();

  const handleBooking = async (e) => {
    e.preventDefault();
    setBookingStatus(null);
    try {
      await axios.post(`${API_URL}/bookings`, {
        listingId: selectedItem._id,
        renterName,
        renterEmail,
        startDate,
        endDate
      });
      setBookingStatus({ type: 'success', text: 'Reservation confirmed successfully!' });
      setTimeout(() => {
        setSelectedItem(null);
        setActiveTab('bookings');
      }, 1200);
    } catch (err) {
      setBookingStatus({ type: 'error', text: err.response?.data?.message || 'Booking conflict or error' });
    }
  };

  const handleAddReview = async (e) => {
    e.preventDefault();
    setReviewMsg(null);
    try {
      const res = await axios.post(`${API_URL}/listings/${reviewModalItem._id}/reviews`, {
        reviewerName,
        rating: reviewRating,
        comment: reviewComment
      });
      setItemReviews([res.data, ...itemReviews]);
      setReviewComment('');
      setReviewerName('');
      setReviewMsg({ type: 'success', text: 'Review published!' });
      fetchListings(); // Update average star rating
    } catch (err) {
      setReviewMsg({ type: 'error', text: 'Failed to post review.' });
    }
  };

  const handleAddListing = async (e) => {
    e.preventDefault();
    setAddMsg(null);
    try {
      await axios.post(`${API_URL}/listings`, {
        title: newTitle,
        category: newCat,
        pricePerDay: Number(newPrice),
        location: newLocation,
        imageUrl: newImg,
        description: newDesc
      });
      setAddMsg({ type: 'success', text: 'Listing published live to marketplace!' });
      setTimeout(() => {
        setShowAddListing(false);
        setAddMsg(null);
        fetchListings();
      }, 1200);
    } catch (err) {
      setAddMsg({ type: 'error', text: err.response?.data?.message || 'Failed to add listing' });
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await axios.put(`${API_URL}/bookings/${id}`, { status });
      fetchBookings();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleDeleteBooking = async (id) => {
    if (!window.confirm('Delete this booking record permanently?')) return;
    try {
      await axios.delete(`${API_URL}/bookings/${id}`);
      setBookings(bookings.filter(b => b._id !== id));
    } catch (err) {
      alert('Failed to delete booking');
    }
  };

  const openEditModal = (booking) => {
    setEditingBooking(booking);
    setEditName(booking.renterName || '');
    setEditEmail(booking.renterEmail || '');
    setEditStart(booking.startDate ? new Date(booking.startDate).toISOString().split('T')[0] : '');
    setEditEnd(booking.endDate ? new Date(booking.endDate).toISOString().split('T')[0] : '');
    setEditStatusMsg(null);
  };

  const handleUpdateBooking = async (e) => {
    e.preventDefault();
    setEditStatusMsg(null);
    const payload = {};
    if (editName.trim()) payload.renterName = editName.trim();
    if (editEmail.trim()) payload.renterEmail = editEmail.trim();
    if (editStart) payload.startDate = editStart;
    if (editEnd) payload.endDate = editEnd;

    try {
      await axios.put(`${API_URL}/bookings/${editingBooking._id}`, payload);
      setEditStatusMsg({ type: 'success', text: 'Booking successfully updated!' });
      setTimeout(() => {
        setEditingBooking(null);
        fetchBookings();
      }, 1000);
    } catch (err) {
      setEditStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update booking' });
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Navbar */}
      <nav style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '14px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>R</div>
          <span style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>RentSphere</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            {['listings', 'bookings', 'analytics'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  textTransform: 'capitalize',
                  backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
                  color: activeTab === tab ? '#0f172a' : '#64748b',
                  boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {tab === 'listings' ? 'Explore Listings' : tab === 'bookings' ? 'My Bookings' : 'Financials'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddListing(true)}
            style={{ padding: '9px 16px', borderRadius: '8px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
          >
            + List an Item
          </button>
        </div>
      </nav>

      {/* VIEW 1: LISTINGS */}
      {activeTab === 'listings' && (
        <>
          <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', padding: '40px 20px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 10px 0' }}>Find & Rent Any Asset In Seconds</h1>
            <p style={{ fontSize: '15px', color: '#94a3b8', margin: '0 0 24px 0' }}>Verified peer-to-peer equipment, real estate, and vehicle rentals.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }} style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: '10px', padding: '4px 6px' }}>
              <input
                type="text"
                placeholder="Search listings..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 14px', fontSize: '14px', color: '#1e293b' }}
              />
              <button type="submit" style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                Search
              </button>
            </form>
          </div>

          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', overflowX: 'auto' }}>
              {['All', 'Real Estate', 'Vehicles', 'Equipment', 'Electronics', 'Fashion', 'Sports'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '24px',
                    border: category === cat ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: category === cat ? '#2563eb' : '#ffffff',
                    color: category === cat ? '#ffffff' : '#475569',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Loading marketplace...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                {listings.map((item) => (
                  <div key={item._id} style={{ background: '#ffffff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                    <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '190px', objectFit: 'cover' }} />
                    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>{item.category} • {item.location}</span>
                        <span 
                          onClick={() => openReviewsModal(item)}
                          style={{ fontSize: '12px', fontWeight: '700', color: '#d97706', cursor: 'pointer' }}
                        >
                          ★ {item.avgRating || 5.0} ({item.reviewCount || 0})
                        </span>
                      </div>
                      <h3 style={{ fontSize: '17px', fontWeight: '700', margin: '0 0 6px 0', color: '#0f172a' }}>{item.title}</h3>
                      <p style={{ fontSize: '13px', color: '#475569', flex: 1, margin: '0 0 16px 0' }}>{item.description}</p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                        <div>
                          <span style={{ fontSize: '18px', fontWeight: '800' }}>${item.pricePerDay}</span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}> / day</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => openReviewsModal(item)}
                            style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '8px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}
                          >
                            Reviews
                          </button>
                          <button
                            onClick={() => openRentModal(item)}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 2: BOOKINGS */}
      {activeTab === 'bookings' && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Confirmed Bookings & Status</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Manage reservations, update status workflows, or modify details.</p>

          <div style={{ display: 'grid', gap: '16px' }}>
            {bookings.map((b) => (
              <div key={b._id} style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={b.status}
                      onChange={(e) => handleStatusUpdate(b._id, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: '16px', fontSize: '12px', fontWeight: '700', border: '1px solid #cbd5e1' }}
                    >
                      <option value="Confirmed">Confirmed</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Ref: {b._id.slice(-6)}</span>
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', margin: '8px 0 4px 0' }}>{b.listingId?.title || 'Rental Item'}</h3>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>Renter: <strong>{b.renterName}</strong> ({b.renterEmail})</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Dates: <strong>{new Date(b.startDate).toLocaleDateString()}</strong> — <strong>{new Date(b.endDate).toLocaleDateString()}</strong></div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Base: ${b.basePrice} | Fee: ${b.serviceFee}</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>${b.totalPrice}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => openEditModal(b)} style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDeleteBooking(b._id)} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: FINANCIAL & HOST ANALYTICS */}
      {activeTab === 'analytics' && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Platform Financials & Host Metrics</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '28px' }}>Real-time Gross Merchandise Value (GMV), platform fee cuts, and transactional volume computed from MongoDB.</p>

          {analytics ? (
            <div>
              {/* Financial Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Gross Merchandise Value</div>
                  <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', margin: '8px 0' }}>${analytics.totalGMV}</div>
                  <div style={{ fontSize: '12px', color: '#059669' }}>Total customer spend processed</div>
                </div>

                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Platform Net Revenue (5%)</div>
                  <div style={{ fontSize: '30px', fontWeight: '800', color: '#2563eb', margin: '8px 0' }}>${analytics.totalServiceFees}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Platform commission retained</div>
                </div>

                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Escrowed Deposits (10%)</div>
                  <div style={{ fontSize: '30px', fontWeight: '800', color: '#d97706', margin: '8px 0' }}>${analytics.totalDeposits}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Refundable security held</div>
                </div>

                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Reservations</div>
                  <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', margin: '8px 0' }}>{analytics.totalBookings}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Across all categories</div>
                </div>
              </div>

              {/* Status Breakdown Table */}
              <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>Transaction Lifecycle Breakdown</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#065f46' }}>CONFIRMED</span>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>{analytics.confirmedBookings}</div>
                  </div>
                  <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af' }}>COMPLETED</span>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>{analytics.completedBookings}</div>
                  </div>
                  <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', border: '1px solid #fecaca' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>CANCELLED</span>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626', marginTop: '4px' }}>{analytics.cancelledBookings}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p>Loading analytics...</p>
          )}
        </div>
      )}

      {/* MODAL: REVIEWS DRAWER */}
      {reviewModalItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '28px', width: '480px', maxWidth: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Reviews & Ratings</h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>{reviewModalItem.title}</p>
              </div>
              <button onClick={() => setReviewModalItem(null)} style={{ background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>

            {reviewMsg && (
              <div style={{ padding: '8px 12px', marginBottom: '12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', background: reviewMsg.type === 'error' ? '#fee2e2' : '#dcfce7', color: reviewMsg.type === 'error' ? '#991b1b' : '#166534' }}>
                {reviewMsg.text}
              </div>
            )}

            {/* Submit New Review */}
            <form onSubmit={handleAddReview} style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Leave a Review</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input type="text" placeholder="Your Name" required value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }} />
                <select value={reviewRating} onChange={(e) => setReviewRating(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}>
                  <option value={5}>5 Stars ★★★★★</option>
                  <option value={4}>4 Stars ★★★★☆</option>
                  <option value={3}>3 Stars ★★★☆☆</option>
                  <option value={2}>2 Stars ★★☆☆☆</option>
                  <option value={1}>1 Star ★☆☆☆☆</option>
                </select>
              </div>
              <textarea placeholder="Write your experience..." required rows={2} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', resize: 'none' }} />
              <button type="submit" style={{ marginTop: '8px', padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>Submit Review</button>
            </form>

            {/* Review List */}
            <h4 style={{ fontSize: '14px', margin: '0 0 10px 0' }}>Past Renter Reviews ({itemReviews.length})</h4>
            {itemReviews.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#64748b' }}>No reviews yet. Be the first to leave one!</p>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {itemReviews.map((r) => (
                  <div key={r._id} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px' }}>{r.reviewerName}</strong>
                      <span style={{ fontSize: '12px', color: '#d97706' }}>{'★'.repeat(r.rating)}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#475569', margin: '6px 0 0 0' }}>{r.comment}</p>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: BOOKING */}
      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '28px', width: '450px', maxWidth: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0' }}>Reserve {selectedItem.title}</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px 0' }}>Rate: ${selectedItem.pricePerDay} / day</p>

            {reservedIntervals.length > 0 && (
              <div style={{ background: '#fef3c7', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', color: '#92400e' }}>
                <strong>Currently Booked Dates:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {reservedIntervals.map((int, i) => (
                    <li key={i}>{new Date(int.startDate).toLocaleDateString()} to {new Date(int.endDate).toLocaleDateString()}</li>
                  ))}
                </ul>
              </div>
            )}

            {bookingStatus && (
              <div style={{ padding: '10px', marginBottom: '14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', background: bookingStatus.type === 'error' ? '#fee2e2' : '#dcfce7', color: bookingStatus.type === 'error' ? '#991b1b' : '#166534' }}>
                {bookingStatus.text}
              </div>
            )}

            <form onSubmit={handleBooking} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Full Name" required value={renterName} onChange={(e) => setRenterName(e.target.value)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              <input type="email" placeholder="Email Address" required value={renterEmail} onChange={(e) => setRenterEmail(e.target.value)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>START DATE</label>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>END DATE</label>
                  <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
              </div>

              {pricing && (
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span>${selectedItem.pricePerDay} × {pricing.days} days:</span><strong>${pricing.base}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#64748b' }}><span>Platform Service Fee (5%):</span><span>${pricing.serviceFee}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b' }}><span>Refundable Deposit (10%):</span><span>${pricing.deposit}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontSize: '15px' }}><span style={{ fontWeight: '700' }}>Estimated Total:</span><span style={{ fontWeight: '800', color: '#2563eb' }}>${pricing.total}</span></div>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Confirm Reservation</button>
                <button type="button" onClick={() => setSelectedItem(null)} style={{ padding: '10px 14px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HOST ADD LISTING */}
      {showAddListing && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '28px', width: '460px', maxWidth: '92%' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0' }}>Post a New Rental Asset</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>List items or real estate on the marketplace.</p>

            {addMsg && (
              <div style={{ padding: '10px', marginBottom: '14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', background: addMsg.type === 'error' ? '#fee2e2' : '#dcfce7', color: addMsg.type === 'error' ? '#991b1b' : '#166534' }}>
                {addMsg.text}
              </div>
            )}

            <form onSubmit={handleAddListing} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Title (e.g. DJI Drone 4K)" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select value={newCat} onChange={(e) => setNewCat(e.target.value)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff' }}>
                  {['Real Estate', 'Vehicles', 'Equipment', 'Electronics', 'Fashion', 'Sports'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" placeholder="Price/Day ($)" required value={newPrice} onChange={(e) => setNewPrice(e.target.value)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              <input type="text" placeholder="Location (e.g. North Suburbs)" required value={newLocation} onChange={(e) => setNewLocation(e.target.value)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              <input type="url" placeholder="Image URL (Unsplash or direct JPG/PNG)" required value={newImg} onChange={(e) => setNewImg(e.target.value)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              <textarea placeholder="Description & condition details..." required rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'none' }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Publish Listing</button>
                <button type="button" onClick={() => setShowAddListing(false)} style={{ padding: '10px 14px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT BOOKING */}
      {editingBooking && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '28px', width: '420px', maxWidth: '90%' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0' }}>Modify Booking</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>{editingBooking.listingId?.title}</p>

            {editStatusMsg && (
              <div style={{ padding: '10px', marginBottom: '14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', background: editStatusMsg.type === 'error' ? '#fee2e2' : '#dcfce7', color: editStatusMsg.type === 'error' ? '#991b1b' : '#166534' }}>
                {editStatusMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdateBooking} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Full Name" required value={editName} onChange={(e) => setEditName(e.target.value)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              <input type="email" placeholder="Email Address" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>START DATE</label>
                  <input type="date" required value={editStart} onChange={(e) => setEditStart(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>END DATE</label>
                  <input type="date" required value={editEnd} onChange={(e) => setEditEnd(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Save Changes</button>
                <button type="button" onClick={() => setEditingBooking(null)} style={{ padding: '10px 14px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}