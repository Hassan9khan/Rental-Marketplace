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


app.get('/', (req, res) => {
  res.json({ message: "RentSphere API is live and running!" });
});

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
      { 
        title: "Luxury 2-Bed City Apartment", 
        category: "Real Estate", 
        pricePerDay: 45, 
        location: "Downtown", 
        imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600", 
        description: "Modern furnished flat close to metro transit with high-speed fiber internet.", 
        avgRating: 5.0, 
        reviewCount: 1 
      },
      { 
        title: "Beachside Studio Villa", 
        category: "Real Estate", 
        pricePerDay: 85, 
        location: "Coastal Bay", 
        imageUrl: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=600", 
        description: "Private beach access, ocean-view patio, and dedicated workspace setup.", 
        avgRating: 4.8, 
        reviewCount: 2 
      },
      { 
        title: "Tesla Model 3 Long Range", 
        category: "Vehicles", 
        pricePerDay: 70, 
        location: "Airport Hub", 
        imageUrl: "https://images.unsplash.com/photo-1536700503339-1e4b06520771?w=600", 
        description: "Full self-driving enabled, pristine interior, and free supercharging included.", 
        avgRating: 4.9, 
        reviewCount: 4 
      },
      { 
        title: "Yamaha MT-07 Naked Bike", 
        category: "Vehicles", 
        pricePerDay: 35, 
        location: "Midtown", 
        imageUrl: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600", 
        description: "Agile 689cc twin cylinder street motorcycle with helmet and phone mount.", 
        avgRating: 4.7, 
        reviewCount: 1 
      },
      { 
        title: "Sony A7 IV + 24-70mm GM Lens", 
        category: "Equipment", 
        pricePerDay: 30, 
        location: "Media City", 
        imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600", 
        description: "Pro 4K60p video and 33MP hybrid photo setup with two 128GB fast SD cards.", 
        avgRating: 5.0, 
        reviewCount: 3 
      },
      { 
        title: "DJI Mavic 3 Pro Cine Drone", 
        category: "Equipment", 
        pricePerDay: 40, 
        location: "Tech District", 
        imageUrl: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=600", 
        description: "Hasselblad triple-camera drone with 3 flight batteries and an ND filter kit.", 
        avgRating: 4.9, 
        reviewCount: 2 
      },
      { 
        title: "PlayStation 5 Pro + 2 DualSense", 
        category: "Electronics", 
        pricePerDay: 15, 
        location: "Gulshan Hub", 
        imageUrl: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600", 
        description: "Loaded with competitive sports and action titles, plus high-speed controller charging dock.", 
        avgRating: 4.8, 
        reviewCount: 5 
      },
      { 
        title: "Apple MacBook Pro M3 Max (64GB)", 
        category: "Electronics", 
        pricePerDay: 50, 
        location: "Clifton", 
        imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600", 
        description: "High-performance editing rig for heavy 4K/8K ProRes exports and machine learning models.", 
        avgRating: 5.0, 
        reviewCount: 2 
      },
      { 
        title: "Black-Tie Designer Tuxedo Set", 
        category: "Fashion", 
        pricePerDay: 25, 
        location: "DHA Phase 6", 
        imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600", 
        description: "Italian wool tailored tuxedo with silk lapels, cufflinks, and adjustable bow tie.", 
        avgRating: 4.6, 
        reviewCount: 1 
      },
      { 
        title: "Traditional Handcrafted Bridal Lehenga", 
        category: "Fashion", 
        pricePerDay: 60, 
        location: "Tariq Road", 
        imageUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600", 
        description: "Intricately hand-embroidered velvet attire complete with matching organza dupatta.", 
        avgRating: 5.0, 
        reviewCount: 3 
      },
      { 
        title: "4-Person Mountain Camping Kit", 
        category: "Sports", 
        pricePerDay: 18, 
        location: "North Suburbs", 
        imageUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600", 
        description: "Weatherproof 4-season tent, 2 sub-zero sleeping bags, camping stove, and lanterns.", 
        avgRating: 4.7, 
        reviewCount: 2 
      },
      { 
        title: "Inflatable Stand-Up Paddleboard", 
        category: "Sports", 
        pricePerDay: 22, 
        location: "Marina Point", 
        imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600", 
        description: "Complete touring SUP board set with dual-action hand pump, carbon paddle, and safety leash.", 
        avgRating: 4.9, 
        reviewCount: 1 
      }
    ]);

    // Initial reviews
    await Review.create({
      listingId: createdListings[0]._id,
      reviewerName: "Zainab Malik",
      rating: 5,
      comment: "Incredible view, quiet, and spotless cleanliness. Host was super responsive!"
    });

    res.send("Database re-seeded with all 12 marketplace listings and reviews!");
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