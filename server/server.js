const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Schemas & Models
const listingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  pricePerDay: { type: Number, required: true },
  location: { type: String, required: true },
  imageUrl: { type: String, required: true },
  description: { type: String, required: true },
  avgRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  renterName: { type: String, required: true },
  renterEmail: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  basePrice: { type: Number, required: true },
  serviceFee: { type: Number, required: true },
  securityDeposit: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['Confirmed', 'Completed', 'Cancelled'], default: 'Confirmed' },
  createdAt: { type: Date, default: Date.now }
});

const reviewSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  reviewerName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Listing = mongoose.model('Listing', listingSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Review = mongoose.model('Review', reviewSchema);

// 2. Listing Routes
app.get('/api/listings', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};
    if (category && category !== 'All') query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };
    
    const listings = await Listing.find(query).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/listings', async (req, res) => {
  try {
    const { title, category, pricePerDay, location, imageUrl, description } = req.body;
    const listing = new Listing({
      title,
      category,
      pricePerDay: Number(pricePerDay),
      location,
      imageUrl,
      description
    });
    await listing.save();
    res.status(201).json(listing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/listings/:id/reserved-dates', async (req, res) => {
  try {
    const bookings = await Booking.find({
      listingId: req.params.id,
      status: 'Confirmed'
    }).select('startDate endDate');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Reviews Routes
app.get('/api/listings/:id/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ listingId: req.params.id }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/listings/:id/reviews', async (req, res) => {
  try {
    const { reviewerName, rating, comment } = req.body;
    const listingId = req.params.id;

    const review = new Review({
      listingId,
      reviewerName,
      rating: Number(rating),
      comment
    });
    await review.save();

    // Recalculate listing average rating
    const allReviews = await Review.find({ listingId });
    const avg = allReviews.reduce((acc, curr) => acc + curr.rating, 0) / allReviews.length;
    
    await Listing.findByIdAndUpdate(listingId, {
      avgRating: parseFloat(avg.toFixed(1)),
      reviewCount: allReviews.length
    });

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Booking Routes
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().populate('listingId').sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { listingId, renterName, renterEmail, startDate, endDate } = req.body;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ message: 'End date must be strictly after start date' });
    }

    const conflict = await Booking.findOne({
      listingId,
      status: 'Confirmed',
      $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }]
    });

    if (conflict) {
      return res.status(409).json({ message: 'Selected dates overlap with an existing confirmed booking.' });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const basePrice = days * listing.pricePerDay;
    const serviceFee = Math.round(basePrice * 0.05);
    const securityDeposit = Math.round(basePrice * 0.10);
    const totalPrice = basePrice + serviceFee + securityDeposit;

    const booking = new Booking({
      listingId,
      renterName,
      renterEmail,
      startDate: start,
      endDate: end,
      basePrice,
      serviceFee,
      securityDeposit,
      totalPrice,
      status: 'Confirmed'
    });

    await booking.save();
    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bookings/:id', async (req, res) => {
  try {
    const { renterName, renterEmail, startDate, endDate, status } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (status) booking.status = status;
    if (renterName) booking.renterName = renterName.trim();
    if (renterEmail) booking.renterEmail = renterEmail.trim();

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(booking.startDate);
      const end = endDate ? new Date(endDate) : new Date(booking.endDate);

      if (start >= end) {
        return res.status(400).json({ message: 'End date must be strictly after start date' });
      }

      const conflict = await Booking.findOne({
        _id: { $ne: req.params.id },
        listingId: booking.listingId,
        status: 'Confirmed',
        $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }]
      });

      if (conflict) {
        return res.status(409).json({ message: 'Item already booked for these new dates' });
      }

      const listing = await Listing.findById(booking.listingId);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      booking.startDate = start;
      booking.endDate = end;
      booking.basePrice = days * listing.pricePerDay;
      booking.serviceFee = Math.round(booking.basePrice * 0.05);
      booking.securityDeposit = Math.round(booking.basePrice * 0.10);
      booking.totalPrice = booking.basePrice + booking.serviceFee + booking.securityDeposit;
    }

    await booking.save();
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Financial & Host Analytics Endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const stats = await Booking.aggregate([
      {
        $group: {
          _id: null,
          totalGMV: { $sum: '$totalPrice' },
          totalBaseVolume: { $sum: '$basePrice' },
          totalServiceFees: { $sum: '$serviceFee' },
          totalDeposits: { $sum: '$securityDeposit' },
          totalBookings: { $sum: 1 },
          confirmedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] }, 1, 0] }
          },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats.length > 0 ? stats[0] : {
      totalGMV: 0,
      totalBaseVolume: 0,
      totalServiceFees: 0,
      totalDeposits: 0,
      totalBookings: 0,
      confirmedBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Seeder Route
app.get('/api/seed', async (req, res) => {
  try {
    await Listing.deleteMany({});
    await Review.deleteMany({});
    const createdListings = await Listing.insertMany([
      { title: "Luxury 2-Bed City Apartment", category: "Real Estate", pricePerDay: 45, location: "Downtown", imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600", description: "Modern furnished flat close to metro transit.", avgRating: 5.0, reviewCount: 1 },
      { title: "Beachside Studio Villa", category: "Real Estate", pricePerDay: 85, location: "Coastal Bay", imageUrl: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=600", description: "Private beach access and ocean view patio.", avgRating: 4.8, reviewCount: 1 },
      { title: "Tesla Model 3 Long Range", category: "Vehicles", pricePerDay: 70, location: "Airport Hub", imageUrl: "https://images.unsplash.com/photo-1536700503339-1e4b06520771?w=600", description: "Full self-driving enabled, pristine interior.", avgRating: 4.9, reviewCount: 1 },
      { title: "Sony A7 IV + 24-70mm GM Lens", category: "Equipment", pricePerDay: 30, location: "Media City", imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600", description: "Pro 4K video setup with two SD cards.", avgRating: 5.0, reviewCount: 1 }
    ]);

    // Add initial reviews
    await Review.create({
      listingId: createdListings[0]._id,
      reviewerName: "Zainab Malik",
      rating: 5,
      comment: "Incredible view and spotless cleanliness. Host was very communicative!"
    });

    res.send("Database re-seeded with listings and sample reviews!");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch(err => console.error("Database error:", err));
}

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;