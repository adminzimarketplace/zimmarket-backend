const r=require('express').Router(), c=require('../controllers/productController'), {authenticate,requireSeller}=require('../middleware/auth');
r.get('/',c.listProducts); r.get('/categories',c.getCategories); r.get('/:id',c.getProduct); r.post('/',authenticate,requireSeller,c.createProduct); r.put('/:id',authenticate,requireSeller,c.updateProduct); r.delete('/:id',authenticate,requireSeller,c.deleteProduct);
module.exports=r;
