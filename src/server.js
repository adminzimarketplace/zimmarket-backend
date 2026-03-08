require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Fix for Railway proxy
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(rateLimit({ windowMs: 60000, max: 200 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.json({ message: 'ZimMarket API is running!' }));
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'ZimMarket Pro API', time: new Date() }));

app.use('/api/v1/auth',          require('./routes/auth'));
app.use('/api/v1/products',      require('./routes/products'));
app.use('/api/v1/orders',        require('./routes/orders'));
app.use('/api/v1/payments',      require('./routes/payments'));
app.use('/api/v1/admin',         require('./routes/admin'));
app.use('/api/v1/seller',        require('./routes/seller'));
app.use('/api/v1/notifications', require('./routes/notifications'));
app.use('/api/v1/upload',        require('./routes/upload'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => res.status(500).json({ error: err.message || 'Server error' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('ZimMarket API running on port ' + PORT);
  // Run seed automatically on first start
  require('./utils/seed');
});
