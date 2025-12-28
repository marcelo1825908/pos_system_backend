const Customer = require('../models/Customer');

class CustomerController {
  static getAllCustomers(req, res) {
    try {
      const customers = Customer.getAll();
      res.json({ data: customers });
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static getCustomerById(req, res) {
    try {
      const customer = Customer.getById(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      res.json({ data: customer });
    } catch (error) {
      console.error('Error fetching customer:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static searchCustomers(req, res) {
    try {
      const searchTerm = req.query.q || '';
      const customers = Customer.search(searchTerm);
      res.json({ data: customers });
    } catch (error) {
      console.error('Error searching customers:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static createCustomer(req, res) {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const customer = Customer.create(req.body);
      res.status(201).json({
        message: 'Customer created successfully',
        data: customer
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static updateCustomer(req, res) {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const customer = Customer.update(req.params.id, req.body);
      res.json({
        message: 'Customer updated successfully',
        data: customer
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static deleteCustomer(req, res) {
    try {
      Customer.delete(req.params.id);
      res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
      console.error('Error deleting customer:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = CustomerController;
