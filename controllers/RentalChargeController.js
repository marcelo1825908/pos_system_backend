const RentalCharge = require('../models/RentalCharge');

const RentalChargeController = {
  getAllRentalCharges: async (req, res) => {
    try {
      console.log('🚀 getAllRentalCharges - Starting...');
      const rentalCharges = await RentalCharge.getAll();
      console.log('📦 getAllRentalCharges - raw result from model:', rentalCharges);
      console.log('📦 getAllRentalCharges - JSON stringified:', JSON.stringify(rentalCharges, null, 2));
      console.log('📦 getAllRentalCharges - type:', typeof rentalCharges, 'isArray:', Array.isArray(rentalCharges));
      console.log('📦 getAllRentalCharges - length:', Array.isArray(rentalCharges) ? rentalCharges.length : 'N/A');
      
      if (Array.isArray(rentalCharges) && rentalCharges.length > 0) {
        console.log('📦 getAllRentalCharges - first item:', rentalCharges[0]);
        console.log('📦 getAllRentalCharges - first item stringified:', JSON.stringify(rentalCharges[0], null, 2));
        console.log('📦 getAllRentalCharges - first item keys:', Object.keys(rentalCharges[0]));
        console.log('📦 getAllRentalCharges - first item values:', Object.values(rentalCharges[0]));
        // Check all possible property names
        console.log('📦 getAllRentalCharges - first item.rental_charge:', rentalCharges[0].rental_charge);
        console.log('📦 getAllRentalCharges - first item.charge_amount:', rentalCharges[0].charge_amount);
        console.log('📦 getAllRentalCharges - first item properties:', Object.getOwnPropertyNames(rentalCharges[0]));
      } else {
        console.log('⚠️ getAllRentalCharges - Empty array or not an array');
      }
      
      const response = { data: rentalCharges };
      console.log('📤 getAllRentalCharges - Sending response:', JSON.stringify(response, null, 2));
      res.json(response);
    } catch (err) {
      console.error('❌ Error getting rental charges:', err);
      console.error('❌ Error stack:', err.stack);
      res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  },

  getRentalChargeById: async (req, res) => {
    try {
      const id = req.params.id;
      const rentalCharge = await RentalCharge.getById(id);
      if (!rentalCharge) {
        return res.status(404).json({ error: 'Rental charge not found' });
      }
      res.json({ data: rentalCharge });
    } catch (err) {
      console.error('Error getting rental charge by id:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createRentalCharge: async (req, res) => {
    try {
      const { rental_charge } = req.body;
      if (rental_charge === undefined || rental_charge === null || rental_charge === '') {
        return res.status(400).json({ error: 'Rental charge is required' });
      }

      const newRentalCharge = await RentalCharge.create(rental_charge);
      res.status(201).json({
        message: 'Rental charge created successfully',
        data: newRentalCharge
      });
    } catch (err) {
      console.error('Error creating rental charge:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateRentalCharge: async (req, res) => {
    try {
      const id = req.params.id;
      const { rental_charge } = req.body;
      if (rental_charge === undefined || rental_charge === null || rental_charge === '') {
        return res.status(400).json({ error: 'Rental charge is required' });
      }

      const updatedRentalCharge = await RentalCharge.update(id, rental_charge);
      res.status(200).json({
        message: 'Rental charge updated successfully',
        data: updatedRentalCharge
      });
    } catch (err) {
      console.error('Error updating rental charge:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteRentalCharge: async (req, res) => {
    try {
      const id = req.params.id;
      await RentalCharge.delete(id);
      res.json({ message: 'Rental charge deleted successfully' });
    } catch (err) {
      console.error('Delete rental charge error:', err);
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = RentalChargeController;
