const RentalBooking = require('../models/RentalBooking');

const RentalBookingController = {
  /**
   * Get all rental bookings
   */
  getAllBookings: (req, res) => {
    try {
      const bookings = RentalBooking.getAll();
      res.json({ data: bookings });
    } catch (err) {
      console.error('Get all rental bookings error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Get rental booking by ID
   */
  getBookingById: (req, res) => {
    try {
      const id = req.params.id;
      const booking = RentalBooking.getById(id);
      
      if (!booking) {
        return res.status(404).json({ error: 'Rental booking not found' });
      }
      
      res.json({ data: booking });
    } catch (err) {
      console.error('Get rental booking by ID error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Get rental bookings by member ID
   */
  getBookingsByMemberId: (req, res) => {
    try {
      const memberId = req.params.memberId;
      const bookings = RentalBooking.getByMemberId(memberId);
      res.json({ data: bookings });
    } catch (err) {
      console.error('Get rental bookings by member ID error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Check for overlapping bookings
   */
  checkOverlap: (req, res) => {
    try {
      const { start_datetime, end_datetime, exclude_id } = req.body;

      if (!start_datetime || !end_datetime) {
        return res.status(400).json({ error: 'Start and end datetime are required' });
      }

      const hasOverlap = RentalBooking.checkOverlap(start_datetime, end_datetime, exclude_id);
      
      if (hasOverlap) {
        const overlappingBookings = RentalBooking.getOverlappingBookings(start_datetime, end_datetime, exclude_id);
        return res.json({ 
          hasOverlap: true, 
          overlappingBookings,
          message: 'This time slot overlaps with existing booking(s)'
        });
      }

      res.json({ hasOverlap: false, message: 'Time slot is available' });
    } catch (err) {
      console.error('Check overlap error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Create a new rental booking
   */
  createBooking: (req, res) => {
    try {
      const bookingData = req.body;

      // Validate required fields
      if (!bookingData.member_id) {
        return res.status(400).json({ error: 'Member ID is required' });
      }
      if (!bookingData.member_name) {
        return res.status(400).json({ error: 'Member name is required' });
      }
      if (!bookingData.start_datetime) {
        return res.status(400).json({ error: 'Start datetime is required' });
      }
      if (!bookingData.end_datetime) {
        return res.status(400).json({ error: 'End datetime is required' });
      }
      if (!bookingData.duration_hours || bookingData.duration_hours <= 0) {
        return res.status(400).json({ error: 'Valid duration in hours is required' });
      }
      if (!bookingData.amount || bookingData.amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      const newBooking = RentalBooking.create(bookingData);
      res.status(201).json({
        message: 'Rental booking created successfully',
        data: newBooking
      });
    } catch (err) {
      console.error('Create rental booking error:', err);
      
      if (err.message && err.message.includes('OVERLAP_ERROR')) {
        const overlappingBookings = RentalBooking.getOverlappingBookings(
          req.body.start_datetime,
          req.body.end_datetime
        );
        return res.status(409).json({ 
          error: 'Time slot conflict',
          message: 'This time slot overlaps with an existing booking',
          overlappingBookings
        });
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Update a rental booking
   */
  updateBooking: (req, res) => {
    try {
      const id = req.params.id;
      const bookingData = req.body;

      const updatedBooking = RentalBooking.update(id, bookingData);
      res.status(200).json({
        message: 'Rental booking updated successfully',
        data: updatedBooking
      });
    } catch (err) {
      console.error('Update rental booking error:', err);
      
      if (err.message && err.message.includes('OVERLAP_ERROR')) {
        return res.status(409).json({ 
          error: 'Time slot conflict',
          message: 'This time slot overlaps with an existing booking'
        });
      }
      
      if (err.message === 'Rental booking not found') {
        return res.status(404).json({ error: err.message });
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Delete a rental booking
   */
  deleteBooking: (req, res) => {
    try {
      const id = req.params.id;
      RentalBooking.delete(id);
      res.json({ message: 'Rental booking deleted successfully' });
    } catch (err) {
      console.error('Delete rental booking error:', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Get bookings by date range
   */
  getBookingsByDateRange: (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Start and end dates are required' });
      }

      const bookings = RentalBooking.getByDateRange(start_date, end_date);
      res.json({ data: bookings });
    } catch (err) {
      console.error('Get bookings by date range error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Get active bookings
   */
  getActiveBookings: (req, res) => {
    try {
      const bookings = RentalBooking.getActive();
      res.json({ data: bookings });
    } catch (err) {
      console.error('Get active bookings error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = RentalBookingController;
