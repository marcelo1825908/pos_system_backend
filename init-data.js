const db = require('./config/database');
const Category = require('./models/Category');
const Product = require('./models/Product');
// Check if categories exist, if not create some sample ones
const categories = Category.getAll();

if (categories.length === 0) {
  Category.create('Beverages');
  Category.create('Starters');
  Category.create('Main Course');
  Category.create('Desserts');
} else {
  console.log('Categories already exist.');
}

// Check if products exist, if not create some sample ones
const products = Product.getAll();
if (products.length === 0) {  
  // Get categories to reference
  const allCategories = Category.getAll();
  
  // Find the "Beverages" category
  const beveragesCategory = allCategories.find(c => c.name === 'Beverages');
  const startersCategory = allCategories.find(c => c.name === 'Starters');
  
  if (beveragesCategory) {
    Product.create({
      name: 'Coca-Cola',
      price: 2.99,
      category_id: beveragesCategory.id,
      vat_takeout: 0,
      vat_eat_in: 0,
      in_web_shop: 0,
      display_index: 0
    });
    
    Product.create({
      name: 'Orange Juice',
      price: 3.49,
      category_id: beveragesCategory.id,
      vat_takeout: 0,
      vat_eat_in: 0,
      in_web_shop: 0,
      display_index: 0
    });
  } else {
    // If Beverages category doesn't exist, use the first available category
    if (allCategories.length > 0) {
      Product.create({
        name: 'Coca-Cola',
        price: 2.99,
        category_id: allCategories[0].id,
        vat_takeout: 0,
        vat_eat_in: 0,
        in_web_shop: 0,
        display_index: 0
      });
      
      Product.create({
        name: 'Orange Juice',
        price: 3.49,
        category_id: allCategories[0].id,
        vat_takeout: 0,
        vat_eat_in: 0,
        in_web_shop: 0,
        display_index: 0
      });
    }
  }
  
  if (startersCategory) {
    Product.create({
      name: 'Caesar Salad',
      price: 7.99,
      category_id: startersCategory.id,
      vat_takeout: 0,
      vat_eat_in: 0,
      in_web_shop: 0,
      display_index: 0
    });
  }
  } else {
  console.log('Products already exist.');
}

