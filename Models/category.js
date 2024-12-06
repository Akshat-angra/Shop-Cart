const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    product_id: {type: Number, required: true},
    name: {type: String, required: true},
    price: {type: Number, required: true},
    discounted_price: {type: Number},
    image: {type: String},
    category_id: {type: Number},
    tags: [String],
    stock: {type: Number, required: true},
    rating: {type: Number},
    description: {type: String}
});

const categorySchema = new mongoose.Schema({
    category_name: {type: String, required: true},
    products: [productSchema]
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
