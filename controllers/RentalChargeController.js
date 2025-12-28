const RentalCharge = require('../models/RentalCharge');

const RentalChargeController = {
  getAllRentalCharges: (req, res) => {
    try {
      const rentalCharges = RentalCharge.getAll();
      res.json({ data: rentalCharges });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getRentalChargeById: (req, res) => {
    try {
      const id = req.params.id;
      const rentalCharge = RentalCharge.getById(id);
      if (!rentalCharge) {
        return res.status(404).json({ error: 'Rental charge not found' });
      }
      res.json({ data: rentalCharge });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createRentalCharge: (req, res) => {
    try {
      const { rental_charge } = req.body;
      if (rental_charge === undefined || rental_charge === null || rental_charge === '') {
        return res.status(400).json({ error: 'Rental charge is required' });
      }

      const newRentalCharge = RentalCharge.create(rental_charge);
      res.status(201).json({
        message: 'Rental charge created successfully',
        data: newRentalCharge
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateRentalCharge: (req, res) => {
    try {
      const id = req.params.id;
      const { rental_charge } = req.body;
      if (rental_charge === undefined || rental_charge === null || rental_charge === '') {
        return res.status(400).json({ error: 'Rental charge is required' });
      }

      const updatedRentalCharge = RentalCharge.update(id, rental_charge);
      res.status(200).json({
        message: 'Rental charge updated successfully',
        data: updatedRentalCharge
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteRentalCharge: (req, res) => {
    try {
      const id = req.params.id;
      RentalCharge.delete(id);
      res.json({ message: 'Rental charge deleted successfully' });
    } catch (err) {
      console.error('Delete rental charge error:', err);
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = RentalChargeController;
