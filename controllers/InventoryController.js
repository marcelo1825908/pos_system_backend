const InventoryModel = require('../models/InventoryModel');
const InventoryHelper = require('../helpers/InventoryHelpers');

const InventoryController = {

createInventory: async (req, res) => {
  console.log("Request body:", req.body);
  const { product_id, qty } = req.body;

  try {
    // Check if product already exists in inventory
    const existingItem = await InventoryModel.getByProductId(product_id);

    if (existingItem) {
      // Product exists → update quantity
      const newQty = existingItem.qty + qty;
      await InventoryModel.update(existingItem.id, newQty);
      res.json({ success: true, id: existingItem.id, qty: newQty });
    } else {
      // Product does not exist → create new
      const id = await InventoryModel.create(product_id, qty);
      res.json({ success: true, id, qty });
    }
  } catch (err) {
    console.error("Failed to create/update inventory:", err);
    res.status(500).json({ success: false, message: 'Failed to create/update inventory' });
  }
},

  getInventoryById: async (req, res) => {
    try {
      const data = await InventoryModel.getById(req.params.id);
      if (!data) return res.status(404).json({ success: false, message: 'Inventory not found' });
      data.availableQty = await InventoryHelper.getAvailableQty(data.product_id);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  getAllInventory: async (req, res) => {
    try {
      const allItems = await InventoryModel.getAll();
      const data = await Promise.all(allItems.map(async item => ({
        ...item,
        availableQty: await InventoryHelper.getAvailableQty(item.product_id)
      })));
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  updateInventory: async (req, res) => {
    try {
      const { qty } = req.body;
      const changes = await InventoryModel.update(req.params.id, qty);
      if (!changes) return res.status(404).json({ success: false, message: 'Inventory not found' });
      res.json({ success: true, message: 'Inventory updated' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to update inventory' });
    }
  },

  deleteInventory: async (req, res) => {
    try {
      const changes = await InventoryModel.delete(req.params.id);
      if (!changes) return res.status(404).json({ success: false, message: 'Inventory not found' });
      res.json({ success: true, message: 'Inventory deleted' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to delete inventory' });
    }
  }

};

module.exports = InventoryController;
