const Promotion = require('../models/Promotion');

class PromotionController {
  static getAllPromotions(req, res) {
    try {
      const promotions = Promotion.getAll();
      res.json({ success: true, data: promotions });
    } catch (error) {
      console.error('Error fetching promotions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static getPromotionById(req, res) {
    try {
      const { id } = req.params;
      const promotion = Promotion.getById(id);
      
      if (!promotion) {
        return res.status(404).json({ success: false, error: 'Promotion not found' });
      }
      
      res.json({ success: true, data: promotion });
    } catch (error) {
      console.error('Error fetching promotion:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static getActivePromotionByProductId(req, res) {
    try {
      const { productId } = req.params;
      console.log('🔍 Server: Checking promotion for product ID:', productId);
      
      const promotion = Promotion.getActiveByProductId(productId);
      
      console.log('📦 Server: Promotion found:', promotion ? promotion.name : 'None');
      
      if (promotion) {
        console.log('✅ Server: Returning promotion:', {
          id: promotion.id,
          name: promotion.name,
          discount_type: promotion.discount_type,
          discount_value: promotion.discount_value,
          is_active: promotion.is_active,
          start_date: promotion.start_date,
          end_date: promotion.end_date
        });
      }
      
      res.json({ success: true, data: promotion });
    } catch (error) {
      console.error('❌ Server: Error fetching active promotion:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static createPromotion(req, res) {
    try {
      const promotion = Promotion.create(req.body);
      res.status(201).json({ success: true, data: promotion });
    } catch (error) {
      console.error('Error creating promotion:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static updatePromotion(req, res) {
    try {
      const { id } = req.params;
      const promotion = Promotion.update(id, req.body);
      res.json({ success: true, data: promotion });
    } catch (error) {
      console.error('Error updating promotion:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static deletePromotion(req, res) {
    try {
      const { id } = req.params;
      Promotion.delete(id);
      res.json({ success: true, message: 'Promotion deleted successfully' });
    } catch (error) {
      console.error('Error deleting promotion:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static getActiveBillPromotion(req, res) {
    try {
      console.log('🔍 Server: Checking for active bill-level promotion');
      
      const promotion = Promotion.getActiveBillPromotion();
      
      console.log('📦 Server: Bill promotion found:', promotion ? promotion.name : 'None');
      
      if (promotion) {
        console.log('✅ Server: Returning bill promotion:', {
          id: promotion.id,
          name: promotion.name,
          discount_type: promotion.discount_type,
          discount_value: promotion.discount_value,
          is_active: promotion.is_active,
          start_date: promotion.start_date,
          end_date: promotion.end_date
        });
      }
      
      res.json({ success: true, data: promotion });
    } catch (error) {
      console.error('❌ Server: Error fetching active bill promotion:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = PromotionController;
