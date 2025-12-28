const Category = require('../models/Category');

const CategoryController = {
    getAllCategories: (req, res) => {
        try {
            const filters = {};

            // Check for is_visible filter in query params
            if (req.query.is_visible !== undefined) {
                filters.is_visible = req.query.is_visible === 'true' || req.query.is_visible === '1';
            }

            const categories = Category.getAll(filters);
            res.json({ data: categories });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getCategoryById: (req, res) => {
        try {
            const id = req.params.id;
            const category = Category.getById(id);
            if (!category) {
                return res.status(404).json({ error: 'Category not found' });
            }
            res.json({ data: category });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createCategory: (req, res) => {
        try {
            const { name, next_course, in_web_shop, is_visible } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const category = Category.create(name, next_course, in_web_shop, is_visible);
            res.status(201).json({
                message: 'Category created successfully',
                data: category
            });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    updateCategory: (req, res) => {
        try {
            const id = req.params.id;
            const { name, next_course, in_web_shop, is_visible } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const category = Category.update(id, name, next_course, in_web_shop, is_visible);
            res.status(200).json({
                message: 'Category updated successfully',
                data: category
            });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    deleteCategory: (req, res) => {
        try {
            const id = req.params.id;
            Category.delete(id);
            res.json({ message: 'Category deleted successfully' });
        } catch (err) {
            console.error('Delete category error:', err);
            // Check if it's a foreign key constraint error
            if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
                return res.status(400).json({
                    error: 'Cannot delete category because it has associated products. Please delete or reassign the products first.'
                });
            }
            res.status(500).json({ error: err.message });
        }
    },

    moveUp: (req, res) => {
        try {
            const id = req.params.id;
            const result = Category.moveUp(id);

            if (!result) {
                return res.status(400).json({ error: 'Cannot move up' });
            }

            res.json({
                message: 'Category moved up successfully',
                data: result
            });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    moveDown: (req, res) => {
        try {
            const id = req.params.id;
            const result = Category.moveDown(id);

            if (!result) {
                return res.status(400).json({ error: 'Cannot move down' });
            }

            res.json({
                message: 'Category moved down successfully',
                data: result
            });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = CategoryController;
